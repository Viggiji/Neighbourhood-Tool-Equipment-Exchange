/**
 * NTEE — BorrowRequestModal (US-07)
 * ─────────────────────────────────────────────────────────────
 * Interactive monthly availability calendar + date-range picker + message modal.
 * Fetches GET /api/tools/:id/booked-dates so past & reserved dates are visibly
 * disabled, highlights the chosen range, updates the price summary in real time,
 * and calls POST /api/requests (surfacing 409 overlap errors cleanly).
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, MessageSquare, Package, AlertCircle,
  ChevronLeft, ChevronRight, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadable(dateStr) {
  if (!dateStr) return 'Select date';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function BorrowRequestForm({ tool, onClose, onSuccess }) {
  const [initialDate] = useState(() => new Date());
  const todayStr = useMemo(() => toDateStr(initialDate), [initialDate]);

  const [viewYear, setViewYear]     = useState(() => initialDate.getFullYear());
  const [viewMonth, setViewMonth]   = useState(() => initialDate.getMonth());
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [hoverDate, setHoverDate]   = useState('');
  const [message, setMessage]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [loadingDates, setLoadingDates] = useState(true);
  const [bookedRanges, setBookedRanges] = useState([]);
  const [overlap, setOverlap]       = useState(false);
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    if (!tool?.id) return;
    let active = true;
    api.get(`/tools/${tool.id}/booked-dates`)
      .then((res) => {
        if (active) setBookedRanges(res.data.bookedRanges || []);
      })
      .catch(() => {
        if (active) setBookedRanges([]);
      })
      .finally(() => {
        if (active) setLoadingDates(false);
      });
    return () => { active = false; };
  }, [tool?.id]);

  const isDateReserved = useMemo(() => {
    return (dateStr) =>
      bookedRanges.some((r) => dateStr >= r.startDate && dateStr <= r.endDate);
  }, [bookedRanges]);

  const rangeOverlapsBooked = useMemo(() => {
    return (a, b) => {
      if (!a || !b) return false;
      return bookedRanges.some((r) => a <= r.endDate && r.startDate <= b);
    };
  }, [bookedRanges]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toDateStr(new Date(viewYear, viewMonth, d)));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const canGoPrevMonth =
    viewYear > initialDate.getFullYear() ||
    (viewYear === initialDate.getFullYear() && viewMonth > initialDate.getMonth());

  function prevMonth() {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(dateStr) {
    if (dateStr < todayStr || isDateReserved(dateStr)) return;
    setOverlap(false);
    setRangeError('');

    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate('');
      return;
    }

    if (dateStr < startDate) {
      setRangeError('Return date cannot be earlier than pickup date. Starting a new selection.');
      setStartDate(dateStr);
      setEndDate('');
      return;
    }

    if (rangeOverlapsBooked(startDate, dateStr)) {
      setRangeError('Your selected range overlaps already reserved dates. Choose consecutive open dates.');
      return;
    }

    setEndDate(dateStr);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!startDate || !endDate || endDate < startDate || rangeOverlapsBooked(startDate, endDate)) {
      return;
    }
    setOverlap(false);
    setLoading(true);
    try {
      await api.post('/requests', {
        toolId: tool.id,
        startDate,
        endDate,
        message: message.trim() || undefined,
      });
      toast.success('Request submitted! The owner has been notified.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Failed to submit request.';
      if (status === 409) {
        setOverlap(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const activeEnd = endDate || (startDate && hoverDate >= startDate ? hoverDate : '');
  const dayCount = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  const dailyRate = Number(tool?.depositAmount || 0);
  const subtotal = dailyRate * dayCount;
  const canSubmit = Boolean(startDate && endDate && endDate >= startDate && !rangeOverlapsBooked(startDate, endDate) && !loading);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#1e1c1a] border border-[#2f2d2a] rounded-2xl shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2f2d2a]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#d05a38]/12 border border-[#d05a38]/20 flex items-center justify-center shrink-0">
            <Package size={15} className="text-[#d05a38]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[#ede9e3] font-semibold text-base leading-tight">Request to Borrow</h2>
            <p className="text-[#5a5751] text-xs truncate">{tool?.title}</p>
          </div>
        </div>
        <button
          id="borrow-modal-close"
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-[#2f2d2a] flex items-center justify-center text-[#5a5751] hover:text-[#a8a49c] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <AnimatePresence>
          {(overlap || rangeError) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 p-3 rounded-lg bg-[#c0392b]/10 border border-[#c0392b]/25"
            >
              <AlertCircle size={14} className="text-[#e05040] mt-0.5 shrink-0" />
              <p className="text-[#e05040] text-xs leading-relaxed">
                {rangeError || 'These dates overlap with an existing request. Please choose different dates.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Pickup & Return summary pills */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] px-3.5 py-2.5">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] block mb-0.5">
              Pickup
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#ede9e3]">
              <Calendar size={12} className="text-[#d05a38]" />
              {startDate ? formatReadable(startDate) : 'Choose start'}
            </div>
          </div>
          <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] px-3.5 py-2.5">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] block mb-0.5">
              Return
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#ede9e3]">
              <Calendar size={12} className="text-[#d05a38]" />
              {endDate ? formatReadable(endDate) : 'Choose end'}
            </div>
          </div>
        </div>

        {/* Interactive Monthly Calendar */}
        <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrevMonth}
              aria-label="Previous month"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7d7a73] hover:text-[#ede9e3] hover:bg-[#242220] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-[#ede9e3]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7d7a73] hover:text-[#ede9e3] hover:bg-[#242220] transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[10px] font-semibold uppercase tracking-wider text-[#5a5751] py-1">
                {wd}
              </div>
            ))}
          </div>

          {loadingDates ? (
            <div className="h-44 flex items-center justify-center text-xs text-[#5a5751]">
              Loading availability…
            </div>
          ) : (
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-7 gap-1"
            >
              {calendarDays.map((dateStr, idx) => {
                if (!dateStr) return <div key={`empty-${idx}`} />;

                const isPast = dateStr < todayStr;
                const isReserved = isDateReserved(dateStr);
                const isDisabled = isPast || isReserved;
                const isStart = dateStr === startDate;
                const isEnd = dateStr === endDate;
                const inRange =
                  startDate &&
                  activeEnd &&
                  dateStr >= startDate &&
                  dateStr <= activeEnd &&
                  !rangeOverlapsBooked(startDate, activeEnd);

                const dayNum = Number(dateStr.split('-')[2]);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isDisabled}
                    onMouseEnter={() => { if (startDate && !endDate) setHoverDate(dateStr); }}
                    onMouseLeave={() => setHoverDate('')}
                    onClick={() => handleDayClick(dateStr)}
                    title={isReserved ? 'Already reserved' : isPast ? 'Past date' : dateStr}
                    className={`h-8 rounded-lg text-xs font-medium transition-all relative flex items-center justify-center ${
                      isStart || isEnd
                        ? 'bg-[#d05a38] text-white font-semibold shadow-sm shadow-[#d05a38]/30'
                        : inRange
                          ? 'bg-[#d05a38]/20 text-[#f08b6a]'
                          : isReserved
                            ? 'bg-[#c0392b]/10 text-[#e05040]/50 line-through cursor-not-allowed'
                            : isPast
                              ? 'text-[#3d3b37] cursor-not-allowed'
                              : 'text-[#ccc9c2] hover:bg-[#2f2d2a] hover:text-white'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </motion.div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-[#2f2d2a] text-[10px] text-[#5a5751]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#d05a38] inline-block" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#c0392b]/25 border border-[#c0392b]/30 inline-block" /> Reserved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2f2d2a] inline-block" /> Open
            </span>
          </div>
        </div>

        {/* Real-time price summary */}
        <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-3.5 space-y-2">
          {dayCount > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7d7a73]">
                  {dailyRate > 0 ? `₹${dailyRate} × ${dayCount} day${dayCount !== 1 ? 's' : ''}` : `Duration`}
                </span>
                <span className="text-[#ede9e3] font-semibold">
                  {dailyRate > 0 ? `₹${subtotal.toLocaleString('en-IN')}` : `${dayCount} day${dayCount !== 1 ? 's' : ''} (Free)`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5a5751] flex items-center gap-1">
                  <ShieldCheck size={11} className="text-[#7db884]" /> ToolShare Protection
                </span>
                <span className="text-[#7db884] font-medium">Included</span>
              </div>
              <div className="pt-2 border-t border-[#2f2d2a] flex items-center justify-between text-xs">
                <span className="text-[#a8a49c] font-semibold">Refundable deposit at pickup</span>
                <span className="text-[#f0c060] font-bold text-sm">
                  {dailyRate > 0 ? `₹${subtotal.toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#5a5751]">
              Select pickup and return dates on the calendar to preview your borrowing summary.
            </p>
          )}
          <p className="text-[11px] text-[#7d7a73] pt-0.5">
            You won&apos;t be charged yet — handoff and deposit happen in person.
          </p>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="borrow-message" className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-1.5">
            Message <span className="normal-case text-[#3d3b37]">(optional)</span>
          </label>
          <div className="relative">
            <MessageSquare size={12} className="absolute left-3 top-3 text-[#5a5751]" />
            <textarea
              id="borrow-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Briefly describe what you need it for and preferred pickup time…"
              rows={2}
              maxLength={300}
              className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#d05a38] focus:ring-2
                         focus:ring-[#d05a38]/12 rounded-lg py-2 pl-8 pr-3 text-[#ede9e3] text-sm
                         placeholder-[#3d3b37] outline-none resize-none transition-all"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            id="borrow-cancel-btn"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[#2f2d2a] text-[#7d7a73] text-sm font-medium
                       hover:border-[#3d3b37] hover:text-[#a8a49c] transition-all"
          >
            Cancel
          </button>
          <motion.button
            type="submit"
            id="borrow-submit-btn"
            whileTap={canSubmit ? { scale: 0.98 } : undefined}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-lg bg-[#d05a38] hover:bg-[#e06b48] text-white text-sm font-semibold
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#d05a38]/20"
          >
            {loading ? 'Sending…' : 'Request to Borrow'}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

export default function BorrowRequestModal({ tool, isOpen, onClose, onSuccess }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            id="borrow-modal-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            id="borrow-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <BorrowRequestForm key={tool?.id} tool={tool} onClose={onClose} onSuccess={onSuccess} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
