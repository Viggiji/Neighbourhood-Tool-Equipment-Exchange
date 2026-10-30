/**
 * NTEE Notification Listener
 * ─────────────────────────────────────────────────────────────
 * Registers one handler per domain event.
 * Each handler persists a row to `notifications` and (optionally)
 * sends an email — completely decoupled from the HTTP request cycle.
 *
 * Call registerNotificationListeners() once at server startup.
 */

const { eventBus, EVENTS } = require('./eventBus');
const { getDb } = require('../db/schema');

// ─── Helper: persist a notification row ──────────────────────
async function createNotification({ userId, type, title, body, entityId, entityType }) {
  try {
    const db = getDb();
    await db.from('notifications').insert({
      user_id:     userId,
      type,
      title,
      body,
      entity_id:   entityId   || null,
      entity_type: entityType || null,
    });
    console.log(`🔔 [Notification] ${type} → user #${userId}`);
  } catch (err) {
    // Notification failures must NEVER crash the process
    console.error(`[Notification] Failed to persist ${type}:`, err.message);
  }
}

// ─── Listener registrations ───────────────────────────────────
function registerNotificationListeners() {

  // ── BOOKING_REQUESTED → notify the tool owner ────────────
  eventBus.on(EVENTS.BOOKING_REQUESTED, async ({ request, borrowerName, toolTitle }) => {
    await createNotification({
      userId:     request.owner_id,
      type:       EVENTS.BOOKING_REQUESTED,
      title:      'New Borrow Request',
      body:       `${borrowerName} wants to borrow your "${toolTitle}" from ${request.start_date} to ${request.end_date}.`,
      entityId:   request.id,
      entityType: 'borrow_request',
    });
  });

  // ── BOOKING_ACCEPTED → notify the borrower ───────────────
  eventBus.on(EVENTS.BOOKING_ACCEPTED, async ({ rental, ownerName, toolTitle }) => {
    await createNotification({
      userId:     rental.borrower_id,
      type:       EVENTS.BOOKING_ACCEPTED,
      title:      'Request Accepted! 🎉',
      body:       `${ownerName} approved your request for "${toolTitle}". Pick-up from ${rental.start_date} to ${rental.due_date}.`,
      entityId:   rental.id,
      entityType: 'rental',
    });
  });

  // ── BOOKING_REJECTED → notify the borrower ───────────────
  eventBus.on(EVENTS.BOOKING_REJECTED, async ({ request, ownerName, toolTitle }) => {
    await createNotification({
      userId:     request.borrower_id,
      type:       EVENTS.BOOKING_REJECTED,
      title:      'Request Declined',
      body:       `${ownerName} couldn't accommodate your request for "${toolTitle}". Try another date.`,
      entityId:   request.id,
      entityType: 'borrow_request',
    });
  });

  // ── BOOKING_RETURNED → notify the owner ──────────────────
  eventBus.on(EVENTS.BOOKING_RETURNED, async ({ rental, borrowerName, toolTitle }) => {
    await createNotification({
      userId:     rental.owner_id,
      type:       EVENTS.BOOKING_RETURNED,
      title:      'Tool Returned',
      body:       `${borrowerName} marked "${toolTitle}" as returned. Please confirm receipt.`,
      entityId:   rental.id,
      entityType: 'rental',
    });
  });

  // ── OVERDUE_DETECTED → notify both parties ───────────────
  eventBus.on(EVENTS.OVERDUE_DETECTED, async ({ rental, borrowerName, ownerName, toolTitle }) => {
    // Notify borrower
    await createNotification({
      userId:     rental.borrower_id,
      type:       EVENTS.OVERDUE_DETECTED,
      title:      '⚠️ Overdue Rental',
      body:       `Your rental of "${toolTitle}" was due on ${rental.due_date}. Please return it immediately.`,
      entityId:   rental.id,
      entityType: 'rental',
    });
    // Notify owner
    await createNotification({
      userId:     rental.owner_id,
      type:       EVENTS.OVERDUE_DETECTED,
      title:      '⚠️ Overdue Alert',
      body:       `${borrowerName} has not returned "${toolTitle}" yet. It was due on ${rental.due_date}.`,
      entityId:   rental.id,
      entityType: 'rental',
    });
  });

  // ── REVIEW_SUBMITTED → notify the reviewee ───────────────
  eventBus.on(EVENTS.REVIEW_SUBMITTED, async ({ review, reviewerName, toolTitle }) => {
    await createNotification({
      userId:     review.reviewee_id,
      type:       EVENTS.REVIEW_SUBMITTED,
      title:      'New Review Received',
      body:       `${reviewerName} left a ${review.rating}★ review for your "${toolTitle}".`,
      entityId:   review.id,
      entityType: 'review',
    });
  });

  console.log('✅ [EventBus] Notification listeners registered.');
}

module.exports = { registerNotificationListeners };
