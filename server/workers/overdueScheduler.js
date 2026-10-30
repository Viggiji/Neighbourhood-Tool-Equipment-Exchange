/**
 * NTEE — Overdue Rental Scheduler
 * ─────────────────────────────────────────────────────────────
 * Runs daily at 06:00 IST (00:30 UTC).
 * Queries all active rentals where due_date < today, batch-updates
 * their status to 'overdue', and fires an OVERDUE_DETECTED event
 * for each one so the notification listener can alert both parties.
 *
 * Called once from server/index.js: require('./workers/overdueScheduler')
 */

const cron = require('node-cron');
const { getDb } = require('../db/schema');
const { eventBus, EVENTS } = require('../services/eventBus');

// ─────────────────────────────────────────────────────────────
// Core job function — exported so it can be run manually in tests
// ─────────────────────────────────────────────────────────────
async function runOverdueCheck() {
  console.log(`\n⏰ [OverdueCron] Running at ${new Date().toISOString()}`);
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // 1. Find all active rentals that are past their due date
    const { data: overdueRentals, error: fetchErr } = await db
      .from('rentals')
      .select(`
        id, tool_id, borrower_id, owner_id, start_date, due_date, status,
        borrower:users!rentals_borrower_id_fkey ( full_name ),
        owner:users!rentals_owner_id_fkey ( full_name ),
        tools ( title )
      `)
      .eq('status', 'active')
      .lt('due_date', today); // due_date < today

    if (fetchErr) {
      console.error('[OverdueCron] Fetch error:', fetchErr.message);
      return;
    }

    if (!overdueRentals || overdueRentals.length === 0) {
      console.log('[OverdueCron] No overdue rentals found. ✅');
      return;
    }

    console.log(`[OverdueCron] Found ${overdueRentals.length} overdue rental(s).`);

    // 2. Bulk-update their status in one query
    const overdueIds = overdueRentals.map(r => r.id);
    const { error: updateErr } = await db
      .from('rentals')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .in('id', overdueIds);

    if (updateErr) {
      console.error('[OverdueCron] Update error:', updateErr.message);
      return;
    }

    // 3. Fire an event for each overdue rental (non-blocking)
    for (const rental of overdueRentals) {
      eventBus.emit(EVENTS.OVERDUE_DETECTED, {
        rental,
        borrowerName: rental.borrower?.full_name || 'The borrower',
        ownerName:    rental.owner?.full_name    || 'The owner',
        toolTitle:    rental.tools?.title         || 'the tool',
      });
    }

    console.log(`[OverdueCron] Updated ${overdueIds.length} rental(s) to 'overdue'. Events fired. ✅`);

  } catch (err) {
    // Cron jobs must NEVER crash the process
    console.error('[OverdueCron] Unhandled error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Schedule — "30 0 * * *" = 00:30 UTC = 06:00 IST daily
// ─────────────────────────────────────────────────────────────
function startOverdueScheduler() {
  cron.schedule('30 0 * * *', runOverdueCheck, {
    timezone: 'UTC',
  });
  console.log('📅 [OverdueCron] Scheduler registered — runs daily at 06:00 IST (00:30 UTC)');
}

module.exports = { startOverdueScheduler, runOverdueCheck };
