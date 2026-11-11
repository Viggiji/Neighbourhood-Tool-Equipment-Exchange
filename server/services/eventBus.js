/**
 * NTEE Event Bus
 * ─────────────────────────────────────────────────────────────
 * A thin wrapper around Node's built-in EventEmitter that gives
 * us a singleton, app-wide pub/sub channel.
 *
 * All event names are exported as constants to prevent typos
 * and make cross-module imports explicit.
 *
 * Architecture note:
 *   HTTP handlers  →  emit(EVENT, payload)
 *   Listeners      →  on(EVENT, handler)   ← registered at startup (index.js)
 *
 * This keeps HTTP responses non-blocking: the route returns
 * before the notification / email side-effects run.
 */

const EventEmitter = require('events');

class NTEEEventBus extends EventEmitter {}

const eventBus = new NTEEEventBus();

// ─── Canonical event names ────────────────────────────────────
const EVENTS = {
  BOOKING_REQUESTED        : 'BOOKING_REQUESTED',        // borrower submitted a request
  BOOKING_ACCEPTED         : 'BOOKING_ACCEPTED',         // owner accepted → rental created
  BOOKING_REJECTED         : 'BOOKING_REJECTED',         // owner rejected
  BOOKING_RETURN_SUBMITTED : 'BOOKING_RETURN_SUBMITTED', // borrower submitted return checklist
  BOOKING_RETURNED         : 'BOOKING_RETURNED',         // owner confirmed return → completed
  REVIEW_SUBMITTED         : 'REVIEW_SUBMITTED',         // participant left a review
  OVERDUE_DETECTED         : 'OVERDUE_DETECTED',         // cron flagged overdue rental
};

module.exports = { eventBus, EVENTS };
