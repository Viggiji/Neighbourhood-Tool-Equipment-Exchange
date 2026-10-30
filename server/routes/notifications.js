/**
 * NTEE — Notifications Routes
 * ─────────────────────────────────────────────────────────────
 * GET   /api/notifications         – fetch my notifications (newest first)
 * PATCH /api/notifications/read-all – mark all as read
 * PATCH /api/notifications/:id/read – mark one as read
 */

const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('notifications')
      .select('id, type, title, body, entity_id, entity_type, is_read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const unreadCount = data.filter(n => !n.is_read).length;

    return res.json({ notifications: data, unreadCount });
  } catch (err) {
    console.error('[GET /notifications]', err);
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    const db = getDb();
    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;

    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('[PATCH /notifications/read-all]', err);
    return res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const db = getDb();
    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id); // ownership guard

    if (error) throw error;

    return res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[PATCH /notifications/:id/read]', err);
    return res.status(500).json({ message: 'Failed to update notification.' });
  }
});

module.exports = router;
