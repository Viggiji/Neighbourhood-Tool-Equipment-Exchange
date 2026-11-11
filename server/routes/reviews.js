/**
 * NTEE — Reviews & Trust Score Routes
 * ─────────────────────────────────────────────────────────────
 * POST /api/reviews           – submit a review for a completed rental (borrower or owner)
 * GET  /api/reviews/user/:id  – get all reviews for a user (profile display)
 * GET  /api/reviews/trust/:id – get user trust score & review count
 */

const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { eventBus, EVENTS } = require('../services/eventBus');

const router = express.Router();
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────
// POST /api/reviews
// Either participant (borrower or owner) submits a review for a completed rental.
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { rentalId, rating, comment } = req.body;
  const reviewerId = req.user.id;

  if (!rentalId || !rating) {
    return res.status(400).json({ message: 'rentalId and rating are required.' });
  }

  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    const db = getDb();

    // Verify the rental involves this user and is completed ('returned')
    const { data: rental, error: rentalErr } = await db
      .from('rentals')
      .select('id, borrower_id, owner_id, tool_id, status, tools(title)')
      .eq('id', rentalId)
      .maybeSingle();

    if (rentalErr) throw rentalErr;
    if (!rental) return res.status(404).json({ message: 'Rental not found.' });

    const isBorrower = rental.borrower_id === reviewerId;
    const isOwner    = rental.owner_id    === reviewerId;

    if (!isBorrower && !isOwner) {
      return res.status(403).json({ message: 'You can only review rentals you participated in.' });
    }

    if (rental.status !== 'returned') {
      return res.status(409).json({ message: 'Ratings can only be submitted for completed returns.' });
    }

    const revieweeId = isBorrower ? rental.owner_id : rental.borrower_id;

    // Prevent duplicate review by the same reviewer on the same rental
    const { data: existing } = await db
      .from('reviews')
      .select('id')
      .eq('rental_id', rentalId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'You have already reviewed this rental.' });
    }

    const { data: review, error } = await db
      .from('reviews')
      .insert({
        rental_id:   rentalId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        tool_id:     rental.tool_id,
        rating:      ratingNum,
        comment:     comment?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already reviewed this rental.' });
      }
      throw error;
    }

    // Emit review event asynchronously
    const { data: reviewer } = await db
      .from('users')
      .select('full_name')
      .eq('id', reviewerId)
      .maybeSingle();

    eventBus.emit(EVENTS.REVIEW_SUBMITTED, {
      review,
      reviewerName: reviewer?.full_name || 'A neighbor',
      toolTitle:    rental.tools?.title || 'the tool',
    });

    return res.status(201).json({ message: 'Review submitted.', review });
  } catch (err) {
    console.error('[POST /reviews]', err);
    return res.status(500).json({ message: 'Failed to submit review.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/user/:id
// Fetch all reviews left for a specific user (for profile/tool display)
// ─────────────────────────────────────────────────────────────
router.get('/user/:id', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        reviewer:users!reviews_reviewer_id_fkey ( id, full_name, block_code ),
        tools ( id, title, category )
      `)
      .eq('reviewee_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ reviews: data || [] });
  } catch (err) {
    console.error('[GET /reviews/user/:id]', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/trust/:id
// Returns the dynamic trust score for a user (avg ★ via RPC)
// ─────────────────────────────────────────────────────────────
router.get('/trust/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user id.' });

    const { data, error } = await db.rpc('get_owner_trust_score', {
      p_owner_id: userId,
    });

    if (error) throw error;

    const { count } = await db
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('reviewee_id', userId);

    return res.json({ trustScore: data || 0, reviewCount: count || 0 });
  } catch (err) {
    console.error('[GET /reviews/trust/:id]', err);
    return res.status(500).json({ message: 'Failed to fetch trust score.' });
  }
});

module.exports = router;
