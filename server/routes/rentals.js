/**
 * NTEE — Rentals Routes
 * ─────────────────────────────────────────────────────────────
 * GET   /api/rentals/my               – borrower: all my rentals (with hasReview)
 * GET   /api/rentals/owner            – owner: rentals of my tools (with hasReview)
 * PATCH /api/rentals/:id/submit-return  – borrower submits 3-point return checklist + note
 * PATCH /api/rentals/:id/confirm-return – owner confirms handback → tool Available, Completed
 * PATCH /api/rentals/:id/return         – backwards-compatible alias
 */

const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { eventBus, EVENTS } = require('../services/eventBus');

const router = express.Router();
router.use(authenticateToken);

const EXTENDED_SELECT_MY = `
  id, tool_id, borrow_request_id, start_date, due_date, return_submitted_at, return_checklist, return_note, returned_at, status, created_at,
  tools ( id, title, image_url, category, deposit_amount ),
  owner:users!rentals_owner_id_fkey ( id, full_name, block_code )
`;

const BASE_SELECT_MY = `
  id, tool_id, borrow_request_id, start_date, due_date, returned_at, status, created_at,
  tools ( id, title, image_url, category, deposit_amount ),
  owner:users!rentals_owner_id_fkey ( id, full_name, block_code )
`;

const EXTENDED_SELECT_OWNER = `
  id, tool_id, borrow_request_id, start_date, due_date, return_submitted_at, return_checklist, return_note, returned_at, status, created_at,
  tools ( id, title, image_url, category, deposit_amount ),
  borrower:users!rentals_borrower_id_fkey ( id, full_name, block_code )
`;

const BASE_SELECT_OWNER = `
  id, tool_id, borrow_request_id, start_date, due_date, returned_at, status, created_at,
  tools ( id, title, image_url, category, deposit_amount ),
  borrower:users!rentals_borrower_id_fkey ( id, full_name, block_code )
`;

function isMissingColumnError(error) {
  const msg = (error?.message || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || msg.includes('column') && msg.includes('does not exist');
}

async function attachReviewedFlag(db, rentals, reviewerId) {
  const returnedIds = (rentals || [])
    .filter(r => r.status === 'returned')
    .map(r => r.id);

  let reviewedRentalIds = new Set();
  if (returnedIds.length > 0) {
    const { data: reviews } = await db
      .from('reviews')
      .select('rental_id')
      .in('rental_id', returnedIds)
      .eq('reviewer_id', reviewerId);
    reviewedRentalIds = new Set((reviews || []).map(r => r.rental_id));
  }

  return (rentals || []).map(r => ({
    ...r,
    hasReview: reviewedRentalIds.has(r.id),
  }));
}

// ─────────────────────────────────────────────────────────────
// GET /api/rentals/my — Borrower: all my rentals, newest first
// ─────────────────────────────────────────────────────────────
router.get('/my', async (req, res) => {
  try {
    const db = getDb();
    let { data, error } = await db
      .from('rentals')
      .select(EXTENDED_SELECT_MY)
      .eq('borrower_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await db
        .from('rentals')
        .select(BASE_SELECT_MY)
        .eq('borrower_id', req.user.id)
        .order('created_at', { ascending: false }));
    }

    if (error) throw error;

    const rentals = await attachReviewedFlag(db, data, req.user.id);
    return res.json({ rentals });
  } catch (err) {
    console.error('[GET /rentals/my]', err);
    return res.status(500).json({ message: 'Failed to fetch rentals.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/rentals/owner — Owner: rentals of my tools, newest first
// ─────────────────────────────────────────────────────────────
router.get('/owner', async (req, res) => {
  try {
    const db = getDb();
    let { data, error } = await db
      .from('rentals')
      .select(EXTENDED_SELECT_OWNER)
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await db
        .from('rentals')
        .select(BASE_SELECT_OWNER)
        .eq('owner_id', req.user.id)
        .order('created_at', { ascending: false }));
    }

    if (error) throw error;

    const rentals = await attachReviewedFlag(db, data, req.user.id);
    return res.json({ rentals });
  } catch (err) {
    console.error('[GET /rentals/owner]', err);
    return res.status(500).json({ message: 'Failed to fetch rentals.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Shared handback handlers
// ─────────────────────────────────────────────────────────────
async function handleSubmitReturn(req, res, rental) {
  const { checklist, note } = req.body || {};

  if (!checklist || !checklist.cleaned || !checklist.accessories || !checklist.secured) {
    return res.status(400).json({
      message: 'Please complete all three items on the return checklist before submitting.',
    });
  }

  if (rental.status === 'returned') {
    return res.status(409).json({ message: 'This rental has already been completed.' });
  }
  if (rental.status === 'return_submitted') {
    return res.status(409).json({ message: 'Return already submitted and awaiting owner confirmation.' });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const cleanChecklist = {
    cleaned: true,
    accessories: true,
    secured: true,
  };
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;

  let { error: updateErr } = await db
    .from('rentals')
    .update({
      status: 'return_submitted',
      return_submitted_at: now,
      return_checklist: cleanChecklist,
      return_note: cleanNote,
      updated_at: now,
    })
    .eq('id', rental.id);

  // Fallback if extended columns haven't been added yet
  if (updateErr && isMissingColumnError(updateErr)) {
    ({ error: updateErr } = await db
      .from('rentals')
      .update({ status: 'return_submitted', updated_at: now })
      .eq('id', rental.id));
  }

  if (updateErr) {
    if (updateErr.code === '23514' || (updateErr.message || '').includes('chk_rental_status')) {
      return res.status(500).json({
        message: 'Database migration required: please run supabase_migration_sprint2_fixes.sql in Supabase SQL Editor.',
      });
    }
    throw updateErr;
  }

  const { data: borrower } = await db
    .from('users')
    .select('full_name')
    .eq('id', rental.borrower_id)
    .maybeSingle();

  eventBus.emit(EVENTS.BOOKING_RETURN_SUBMITTED, {
    rental: { ...rental, status: 'return_submitted' },
    borrowerName: borrower?.full_name || 'The borrower',
    toolTitle: rental.tools?.title || 'the tool',
  });

  return res.json({ message: 'Return submitted for owner confirmation.' });
}

async function handleConfirmReturn(req, res, rental) {
  if (rental.status === 'returned') {
    return res.status(409).json({ message: 'This rental is already marked as completed.' });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const { error: rentalErr } = await db
    .from('rentals')
    .update({ status: 'returned', returned_at: now, updated_at: now })
    .eq('id', rental.id);

  if (rentalErr) throw rentalErr;

  // Only set tool back to Available if no other currently-active rental exists
  const today = now.split('T')[0];
  const { data: otherActive } = await db
    .from('rentals')
    .select('id')
    .eq('tool_id', rental.tool_id)
    .neq('id', rental.id)
    .in('status', ['active', 'return_submitted', 'overdue'])
    .lte('start_date', today)
    .limit(1);

  if (!otherActive || otherActive.length === 0) {
    await db
      .from('tools')
      .update({ status: 'Available', updated_at: now })
      .eq('id', rental.tool_id);
  }

  const { data: owner } = await db
    .from('users')
    .select('full_name')
    .eq('id', rental.owner_id)
    .maybeSingle();

  eventBus.emit(EVENTS.BOOKING_RETURNED, {
    rental: { ...rental, status: 'returned', returned_at: now },
    ownerName: owner?.full_name || 'The owner',
    toolTitle: rental.tools?.title || 'the tool',
  });

  return res.json({ message: 'Return confirmed! Tool is available again.' });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/rentals/:id/submit-return — Borrower submits checklist
// ─────────────────────────────────────────────────────────────
router.patch('/:id/submit-return', async (req, res) => {
  const rentalId = parseInt(req.params.id, 10);
  try {
    const db = getDb();
    const { data: rental, error } = await db
      .from('rentals')
      .select('*, tools(title)')
      .eq('id', rentalId)
      .maybeSingle();

    if (error) throw error;
    if (!rental) return res.status(404).json({ message: 'Rental not found.' });
    if (rental.borrower_id !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

    return await handleSubmitReturn(req, res, rental);
  } catch (err) {
    console.error('[PATCH /rentals/:id/submit-return]', err);
    return res.status(500).json({ message: 'Failed to submit return.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/rentals/:id/confirm-return — Owner confirms handback
// ─────────────────────────────────────────────────────────────
router.patch('/:id/confirm-return', async (req, res) => {
  const rentalId = parseInt(req.params.id, 10);
  try {
    const db = getDb();
    const { data: rental, error } = await db
      .from('rentals')
      .select('*, tools(title)')
      .eq('id', rentalId)
      .maybeSingle();

    if (error) throw error;
    if (!rental) return res.status(404).json({ message: 'Rental not found.' });
    if (rental.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the tool owner can confirm returns.' });

    return await handleConfirmReturn(req, res, rental);
  } catch (err) {
    console.error('[PATCH /rentals/:id/confirm-return]', err);
    return res.status(500).json({ message: 'Failed to confirm return.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/rentals/:id/return — Compatible route (dispatches by role)
// ─────────────────────────────────────────────────────────────
router.patch('/:id/return', async (req, res) => {
  const rentalId = parseInt(req.params.id, 10);
  try {
    const db = getDb();
    const { data: rental, error } = await db
      .from('rentals')
      .select('*, tools(title)')
      .eq('id', rentalId)
      .maybeSingle();

    if (error) throw error;
    if (!rental) return res.status(404).json({ message: 'Rental not found.' });

    if (rental.owner_id === req.user.id) {
      return await handleConfirmReturn(req, res, rental);
    }
    if (rental.borrower_id === req.user.id) {
      return await handleSubmitReturn(req, res, rental);
    }

    return res.status(403).json({ message: 'Forbidden.' });
  } catch (err) {
    console.error('[PATCH /rentals/:id/return]', err);
    return res.status(500).json({ message: 'Failed to update rental.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/rentals/tool/:toolId/my-completed
// Returns the borrower's most recent completed (returned) rental for a specific
// tool, plus a hasReview flag so the UI knows whether a review has been left.
// Used by ToolDetailsPage to show a "Rate This Tool" CTA.
// ─────────────────────────────────────────────────────────────
router.get('/tool/:toolId/my-completed', async (req, res) => {
  try {
    const db     = getDb();
    const toolId = parseInt(req.params.toolId, 10);
    if (isNaN(toolId)) return res.status(400).json({ message: 'Invalid tool id.' });

    const { data: rental, error } = await db
      .from('rentals')
      .select('id, tool_id, start_date, due_date, returned_at, status')
      .eq('borrower_id', req.user.id)
      .eq('tool_id', toolId)
      .eq('status', 'returned')
      .order('returned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!rental) return res.json({ rental: null });

    // Check if this borrower already reviewed this rental
    const { data: existing } = await db
      .from('reviews')
      .select('id')
      .eq('rental_id', rental.id)
      .eq('reviewer_id', req.user.id)
      .maybeSingle();

    return res.json({ rental: { ...rental, hasReview: !!existing } });
  } catch (err) {
    console.error('[GET /rentals/tool/:toolId/my-completed]', err);
    return res.status(500).json({ message: 'Failed to check rental history.' });
  }
});

module.exports = router;
