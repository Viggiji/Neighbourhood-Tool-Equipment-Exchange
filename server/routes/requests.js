/**
 * NTEE — Booking & Requests Routes
 * ─────────────────────────────────────────────────────────────
 * POST   /api/requests           – submit borrow request (atomic overlap check)
 * GET    /api/requests/incoming  – owner: requests for my tools (?status=pending|all)
 * GET    /api/requests/outgoing  – borrower: my submitted requests
 * PATCH  /api/requests/:id/accept  – owner accepts → creates rental atomically
 * PATCH  /api/requests/:id/reject  – owner rejects
 * PATCH  /api/requests/:id/cancel  – borrower cancels pending request
 */

const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { eventBus, EVENTS } = require('../services/eventBus');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────
// POST /api/requests
// Submit a borrow request.
//
// ATOMIC OVERLAP CHECK — uses a Supabase RPC (PostgreSQL function)
// to query for overlapping accepted/pending requests in the same
// transaction as the INSERT, mathematically eliminating double-booking.
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { toolId, startDate, endDate, message } = req.body;
  const borrowerId = req.user.id;

  if (!toolId || !startDate || !endDate) {
    return res.status(400).json({ message: 'toolId, startDate, and endDate are required.' });
  }

  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) {
    return res.status(400).json({ message: 'Invalid date range.' });
  }
  // Cannot request for the past
  if (start < new Date(new Date().toDateString())) {
    return res.status(400).json({ message: 'Start date cannot be in the past.' });
  }

  try {
    const db = getDb();

    // 1. Fetch the tool and its owner
    const { data: tool, error: toolErr } = await db
      .from('tools')
      .select('id, user_id, title, status')
      .eq('id', toolId)
      .maybeSingle();

    if (toolErr || !tool) {
      return res.status(404).json({ message: 'Tool not found.' });
    }
    if (tool.user_id === borrowerId) {
      return res.status(400).json({ message: 'You cannot borrow your own tool.' });
    }
    if (tool.status === 'Unavailable') {
      return res.status(409).json({ message: 'This tool is currently marked unavailable by the owner.' });
    }

    // 2. Atomic overlap check + insert via PostgreSQL function
    //    The function runs inside a single transaction:
    //      BEGIN
    //        IF overlapping accepted/pending rows exist → RAISE EXCEPTION
    //        INSERT INTO borrow_requests …
    //      COMMIT
    //    This is the only safe way to prevent race conditions.
    const { data: result, error: rpcErr } = await db.rpc('create_borrow_request', {
      p_tool_id:    toolId,
      p_borrower_id: borrowerId,
      p_owner_id:   tool.user_id,
      p_start_date: startDate,
      p_end_date:   endDate,
      p_message:    message || null,
    });

    if (rpcErr) {
      // PostgreSQL RAISE EXCEPTION surfaces here
      if (rpcErr.message?.includes('overlapping')) {
        return res.status(409).json({ message: 'These dates overlap with an existing request or rental for this tool.' });
      }
      throw rpcErr;
    }

    // result is the newly created borrow_request row
    const newRequest = result;

    // 3. Fetch borrower name for notification payload
    const { data: borrower } = await db
      .from('users')
      .select('full_name')
      .eq('id', borrowerId)
      .maybeSingle();

    // 4. Emit event asynchronously — does NOT block the response
    eventBus.emit(EVENTS.BOOKING_REQUESTED, {
      request:      newRequest,
      borrowerName: borrower?.full_name || 'A neighbor',
      toolTitle:    tool.title,
    });

    return res.status(201).json({ message: 'Borrow request submitted.', request: newRequest });

  } catch (err) {
    console.error('[POST /requests] Error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/requests/incoming — owner sees requests for their tools
// ─────────────────────────────────────────────────────────────
router.get('/incoming', async (req, res) => {
  try {
    const db = getDb();
    const statusFilter = req.query.status || 'pending';
    let query = db
      .from('borrow_requests')
      .select(`
        id, tool_id, borrower_id, start_date, end_date, message, status, created_at,
        tools   ( id, title, image_url, category ),
        borrower:users!borrow_requests_borrower_id_fkey ( id, full_name, block_code )
      `)
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ requests: data });
  } catch (err) {
    console.error('[GET /requests/incoming]', err);
    return res.status(500).json({ message: 'Failed to fetch requests.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/requests/outgoing — borrower sees their own requests
// ─────────────────────────────────────────────────────────────
router.get('/outgoing', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('borrow_requests')
      .select(`
        id, tool_id, owner_id, start_date, end_date, message, status, created_at,
        tools ( title, image_url, category ),
        owner:users!borrow_requests_owner_id_fkey ( id, full_name, block_code )
      `)
      .eq('borrower_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ requests: data });
  } catch (err) {
    console.error('[GET /requests/outgoing]', err);
    return res.status(500).json({ message: 'Failed to fetch requests.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/requests/:id/accept
// Owner accepts → atomically creates a rental row and updates
// the request & tool status in one Supabase transaction (via RPC).
// ─────────────────────────────────────────────────────────────
router.patch('/:id/accept', async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const db = getDb();

    // Verify ownership
    const { data: request, error: reqErr } = await db
      .from('borrow_requests')
      .select('*, tools(title)')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !request) return res.status(404).json({ message: 'Request not found.' });
    if (request.owner_id !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });
    if (request.status !== 'pending') return res.status(409).json({ message: `Request is already ${request.status}.` });

    // Accept via RPC: creates rental, updates request status, sets tool status to 'Rented'
    const { data: rental, error: rpcErr } = await db.rpc('accept_borrow_request', {
      p_request_id: requestId,
    });

    if (rpcErr) throw rpcErr;

    // Fetch owner name for notification
    const { data: owner } = await db.from('users').select('full_name').eq('id', req.user.id).maybeSingle();

    eventBus.emit(EVENTS.BOOKING_ACCEPTED, {
      rental,
      ownerName: owner?.full_name || 'The owner',
      toolTitle: request.tools?.title || 'the tool',
    });

    return res.json({ message: 'Request accepted. Rental created.', rental });

  } catch (err) {
    console.error('[PATCH /requests/:id/accept]', err);
    return res.status(500).json({ message: 'Failed to accept request.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/requests/:id/reject
// ─────────────────────────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const db = getDb();

    const { data: request } = await db
      .from('borrow_requests')
      .select('*, tools(title)')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.owner_id !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });
    if (request.status !== 'pending') return res.status(409).json({ message: `Request is already ${request.status}.` });

    const { error } = await db
      .from('borrow_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;

    const { data: owner } = await db.from('users').select('full_name').eq('id', req.user.id).maybeSingle();

    eventBus.emit(EVENTS.BOOKING_REJECTED, {
      request: { ...request, status: 'rejected' },
      ownerName: owner?.full_name || 'The owner',
      toolTitle: request.tools?.title || 'the tool',
    });

    return res.json({ message: 'Request rejected.' });

  } catch (err) {
    console.error('[PATCH /requests/:id/reject]', err);
    return res.status(500).json({ message: 'Failed to reject request.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/requests/:id/cancel — borrower cancels their own pending request
// ─────────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const db = getDb();

    const { data: request } = await db
      .from('borrow_requests')
      .select('id, borrower_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.borrower_id !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });
    if (request.status !== 'pending') return res.status(409).json({ message: `Cannot cancel a ${request.status} request.` });

    const { error } = await db
      .from('borrow_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;

    return res.json({ message: 'Request cancelled.' });

  } catch (err) {
    console.error('[PATCH /requests/:id/cancel]', err);
    return res.status(500).json({ message: 'Failed to cancel request.' });
  }
});

module.exports = router;
