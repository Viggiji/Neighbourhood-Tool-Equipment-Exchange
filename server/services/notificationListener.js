/**
 * NTEE Notification Listener
 * ─────────────────────────────────────────────────────────────
 * Registers one handler per domain event.
 * Each handler persists a row to `notifications` and dispatches
 * an asynchronous email alert — completely decoupled from the HTTP
 * request cycle so failures never block user actions.
 *
 * Call registerNotificationListeners() once at server startup.
 */

const { eventBus, EVENTS } = require('./eventBus');
const { getDb } = require('../db/schema');
const { sendNotificationEmail } = require('./email');

// ─── Helper: persist a notification row + send email alert ────
async function dispatchNotification({ userId, type, title, body, entityId, entityType, ctaText, ctaPath }) {
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

    // Dispatch email alert asynchronously (only if user email exists)
    const { data: user } = await db
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (user?.email) {
      await sendNotificationEmail({
        toEmail: user.email,
        toName:  user.full_name,
        subject: `[NTEE] ${title}`,
        heading: title,
        body,
        ctaText,
        ctaPath,
      });
    }
  } catch (err) {
    // Notification failures must NEVER crash the process or block bookings
    console.error(`[Notification] Failed to dispatch ${type}:`, err.message);
  }
}

// ─── Listener registrations ───────────────────────────────────
function registerNotificationListeners() {

  // ── BOOKING_REQUESTED → notify the tool owner ────────────
  eventBus.on(EVENTS.BOOKING_REQUESTED, async ({ request, borrowerName, toolTitle }) => {
    await dispatchNotification({
      userId:     request.owner_id,
      type:       EVENTS.BOOKING_REQUESTED,
      title:      'New Borrow Request',
      body:       `${borrowerName} wants to borrow your "${toolTitle}" from ${request.start_date} to ${request.end_date}.`,
      entityId:   request.id,
      entityType: 'borrow_request',
      ctaText:    'Review Request',
      ctaPath:    '/owner',
    });
  });

  // ── BOOKING_ACCEPTED → notify the borrower ───────────────
  eventBus.on(EVENTS.BOOKING_ACCEPTED, async ({ rental, ownerName, toolTitle }) => {
    await dispatchNotification({
      userId:     rental.borrower_id,
      type:       EVENTS.BOOKING_ACCEPTED,
      title:      'Request Accepted!',
      body:       `${ownerName} approved your request for "${toolTitle}". Pick-up from ${rental.start_date} to ${rental.due_date}.`,
      entityId:   rental.id,
      entityType: 'rental',
      ctaText:    'View My Rentals',
      ctaPath:    '/dashboard?tab=rentals',
    });
  });

  // ── BOOKING_REJECTED → notify the borrower ───────────────
  eventBus.on(EVENTS.BOOKING_REJECTED, async ({ request, ownerName, toolTitle }) => {
    await dispatchNotification({
      userId:     request.borrower_id,
      type:       EVENTS.BOOKING_REJECTED,
      title:      'Request Declined',
      body:       `${ownerName} couldn't accommodate your request for "${toolTitle}". Try another date.`,
      entityId:   request.id,
      entityType: 'borrow_request',
      ctaText:    'Browse Tools',
      ctaPath:    '/dashboard',
    });
  });

  // ── BOOKING_RETURN_SUBMITTED → notify the owner ──────────
  eventBus.on(EVENTS.BOOKING_RETURN_SUBMITTED, async ({ rental, borrowerName, toolTitle }) => {
    await dispatchNotification({
      userId:     rental.owner_id,
      type:       EVENTS.BOOKING_RETURN_SUBMITTED,
      title:      'Return Submitted for Confirmation',
      body:       `${borrowerName} completed the return checklist for "${toolTitle}". Please confirm receipt on your Owner Dashboard.`,
      entityId:   rental.id,
      entityType: 'rental',
      ctaText:    'Confirm Return',
      ctaPath:    '/owner',
    });
  });

  // ── BOOKING_RETURNED → notify the borrower (completed) ───
  eventBus.on(EVENTS.BOOKING_RETURNED, async ({ rental, ownerName, toolTitle }) => {
    await dispatchNotification({
      userId:     rental.borrower_id,
      type:       EVENTS.BOOKING_RETURNED,
      title:      'Return Confirmed',
      body:       `${ownerName || 'The owner'} confirmed return of "${toolTitle}". Rate your experience in My Rentals!`,
      entityId:   rental.id,
      entityType: 'rental',
      ctaText:    'Rate Experience',
      ctaPath:    '/dashboard?tab=rentals',
    });
  });

  // ── OVERDUE_DETECTED → notify both parties ───────────────
  eventBus.on(EVENTS.OVERDUE_DETECTED, async ({ rental, borrowerName, toolTitle }) => {
    await Promise.all([
      dispatchNotification({
        userId:     rental.borrower_id,
        type:       EVENTS.OVERDUE_DETECTED,
        title:      'Overdue Rental',
        body:       `Your rental of "${toolTitle}" was due on ${rental.due_date}. Please complete the return checklist and return it immediately.`,
        entityId:   rental.id,
        entityType: 'rental',
        ctaText:    'Return Tool',
        ctaPath:    '/dashboard?tab=rentals',
      }),
      dispatchNotification({
        userId:     rental.owner_id,
        type:       EVENTS.OVERDUE_DETECTED,
        title:      'Overdue Alert',
        body:       `${borrowerName} has not returned "${toolTitle}" yet. It was due on ${rental.due_date}.`,
        entityId:   rental.id,
        entityType: 'rental',
        ctaText:    'View Active Rentals',
        ctaPath:    '/owner',
      }),
    ]);
  });

  // ── REVIEW_SUBMITTED → notify the reviewee ───────────────
  eventBus.on(EVENTS.REVIEW_SUBMITTED, async ({ review, reviewerName, toolTitle }) => {
    await dispatchNotification({
      userId:     review.reviewee_id,
      type:       EVENTS.REVIEW_SUBMITTED,
      title:      'New Review Received',
      body:       `${reviewerName} left a ${review.rating}★ review for "${toolTitle}".`,
      entityId:   review.id,
      entityType: 'review',
      ctaText:    'View Dashboard',
      ctaPath:    '/dashboard',
    });
  });

  console.log('✅ [EventBus] Notification listeners registered.');
}

module.exports = { registerNotificationListeners };
