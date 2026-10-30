/**
 * NTEE — Reviews & Trust Score Routes
 * ─────────────────────────────────────────────────────────────
 * POST /api/reviews          – submit a review for a completed rental
 * GET  /api/reviews/user/:id – get all reviews for a user (owner profile)
 * GET  /api/reviews/trust/:id – get owner trust score
 */

const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { eventBus, EVENTS } = require('../services/eventBus');

const router = express.Router();
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────
// POST /api/reviews
// Borrower submits a review for a completed rental.
// One review per rental (enforced by UNIQUE constraint on rental_id).
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { rentalId, rating, comment } = req.body;
  const reviewerId = req.user.id;

  if (!rentalId || !rating) {
    return res.status(400).json({ message: 'rentalId and rating are required.' });
  }

  const ratingNum = parseInt(rating, 10);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    const db = getDb();

    // Verify the rental belongs to this borrower and is returned
    const { data: rental } = await db
      .from('rentals')
      .select('id, borrower_id, owner_id, tool_id, status, tools(title)')
      .eq('id', rentalId)
      .maybeSingle();

    if (!rental) return res.status(404).json({ message: 'Rental not found.' });
    if (rental.borrower_id !== reviewerId) return res.status(403).json({ message: 'You can only review rentals you borrowed.' });
    if (rental.status !== 'returned') return res.status(409).json({ message: 'You can only review after returning the tool.' });

    // Insert review (DB UNIQUE constraint on rental_id prevents duplicates)
    const { data: review, error } = await db
      .from('reviews')
      .insert({
        rental_id:   rentalId,
        reviewer_id: reviewerId,
        reviewee_id: rental.owner_id,
        tool_id:     rental.tool_id,
        rating:      ratingNum,
        comment:     comment?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique_violation
        return res.status(409).json({ message: 'You have already reviewed this rental.' });
      }
      throw error;
    }

    // Emit review event asynchronously
    const { data: reviewer } = await db.from('users').select('full_name').eq('id', reviewerId).maybeSingle();

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
// Fetch all reviews left for a specific owner (for profile display)
// ─────────────────────────────────────────────────────────────
router.get('/user/:id', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        reviewer:users!reviews_reviewer_id_fkey ( id, full_name ),
        tools ( title, category )
      `)
      .eq('reviewee_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ reviews: data });
  } catch (err) {
    console.error('[GET /reviews/user/:id]', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/reviews/trust/:id
// Returns the dynamic trust score for an owner (avg ★ via RPC)
// ─────────────────────────────────────────────────────────────
router.get('/trust/:id', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('get_owner_trust_score', {
      p_owner_id: parseInt(req.params.id, 10),
    });

    if (error) throw error;

    // Also fetch total review count
    const { count } = await db
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('reviewee_id', req.params.id);

    return res.json({ trustScore: data || 0, reviewCount: count || 0 });
  } catch (err) {
    console.error('[GET /reviews/trust/:id]', err);
    return res.status(500).json({ message: 'Failed to fetch trust score.' });
  }
});

module.exports = router;
