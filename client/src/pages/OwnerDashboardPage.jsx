/**
 * NTEE — Owner Dashboard (Sprint 2: US-08, US-09, US-10)
 * ─────────────────────────────────────────────────────────────
 * Tabs:
 *   Incoming  — pending borrow requests on my tools (GSAP accept/reject)
 *   Active    — currently rented out (active, return_submitted, overdue) + Confirm Return
 *   History   — completed rentals + two-way borrower rating
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  CheckCircle, XCircle, Clock, Calendar, MessageSquare,
  User, Package, Inbox, Star, AlertCircle, RotateCcw,
  CalendarDays, History, Check, Eye, X, Info,
} from 'lucide-react';
import api from '../lib/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ReviewModal from '../components/ReviewModal';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const dtStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = (Date.now() - new Date(dtStr).getTime()) / 1000;
  if (isNaN(diff) || diff < 0) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending:          'text-[#f0c060] bg-[#c88b30]/12 border border-[#c88b30]/25',
    accepted:         'text-[#7db884] bg-[#4a8c55]/12 border border-[#4a8c55]/25',
    rejected:         'text-[#e05040] bg-[#c0392b]/10 border border-[#c0392b]/20',
    active:           'text-[#7db884] bg-[#4a8c55]/12 border border-[#4a8c55]/25',
    return_submitted: 'text-[#f0c060] bg-[#c88b30]/15 border border-[#c88b30]/30',
    overdue:          'text-[#e05040] bg-[#c0392b]/10 border border-[#c0392b]/20',
    returned:         'text-[#a8a49c] bg-[#3d3b37]/30 border border-[#3d3b37]',
  };
  const labels = {
    accepted: 'Approved',
    return_submitted: 'Return Submitted',
    returned: 'Completed',
  };
  return (
    <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${styles[status] || styles.returned}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Individual Request Card (GSAP animation on action) ────────
function RequestCard({ request, onAction }) {
  const cardRef = useRef(null);
  const [acting, setActing] = useState(false);

  async function handleAction(action) {
    if (acting) return;
    setActing(true);
    const el = cardRef.current;
    await gsap.to(el, { x: action === 'accept' ? 80 : -80, opacity: 0, scale: 0.96, duration: 0.25, ease: 'power2.out' });
    await gsap.to(el, { height: 0, marginBottom: 0, padding: 0, duration: 0.2, ease: 'power1.inOut' });
    onAction(request.id, action);
  }

  return (
    <div ref={cardRef} className="overflow-hidden">
      <div className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-5 mb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
              <User size={16} className="text-[#5a5751]" />
            </div>
            <div className="min-w-0">
              <p className="text-[#ede9e3] font-semibold text-sm truncate">
                {request.borrower?.full_name || 'Unknown'}
              </p>
              <p className="text-[#5a5751] text-xs">Block {request.borrower?.block_code}</p>
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Tool info */}
        <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-[#1a1917] border border-[#2f2d2a]">
          <Package size={13} className="text-[#d05a38] shrink-0" />
          <span className="text-[#a8a49c] text-sm font-medium truncate">{request.tools?.title}</span>
          {request.tools?.category && (
            <span className="text-[10px] text-[#5a5751] ml-auto shrink-0">{request.tools.category}</span>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-[#7d7a73] text-xs">
            <Calendar size={12} className="text-[#5a5751]" />
            <span>{formatDate(request.start_date)}</span>
            <span className="text-[#3d3b37]">→</span>
            <span>{formatDate(request.end_date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#5a5751] text-xs ml-auto">
            <Clock size={11} />
            {Math.ceil((new Date(request.end_date) - new Date(request.start_date)) / 86400000) + 1}d
          </div>
        </div>

        {/* Message */}
        {request.message && (
          <div className="flex items-start gap-2 mb-4 p-2.5 rounded-lg bg-[#1a1917]">
            <MessageSquare size={12} className="text-[#5a5751] mt-0.5 shrink-0" />
            <p className="text-[#7d7a73] text-xs italic leading-relaxed">{request.message}</p>
          </div>
        )}

        {/* Actions */}
        {request.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleAction('accept')}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                         bg-[#4a8c55]/15 hover:bg-[#4a8c55]/25 border border-[#4a8c55]/25 hover:border-[#4a8c55]/50
                         text-[#7db884] text-sm font-semibold transition-all disabled:opacity-50"
            >
              <CheckCircle size={15} />
              {acting ? 'Accepting…' : 'Accept'}
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                         bg-[#c0392b]/08 hover:bg-[#c0392b]/15 border border-[#c0392b]/20 hover:border-[#c0392b]/40
                         text-[#e05040] text-sm font-semibold transition-all disabled:opacity-50"
            >
              <XCircle size={15} />
              {acting ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active / Return Submitted / Overdue Rental Card ───────────
function ActiveRentalCard({ rental, onConfirmReturn, confirming, onViewDetails }) {
  const isOverdue = rental.status === 'overdue';
  const isReturnSubmitted = rental.status === 'return_submitted';
  const days = Math.ceil((new Date(rental.due_date) - new Date(rental.start_date)) / 86400000) + 1;

  return (
    <motion.div
      className={`rounded-xl bg-[#242220] border p-5 ${
        isReturnSubmitted
          ? 'border-[#c88b30]/40'
          : isOverdue
            ? 'border-[#c0392b]/35'
            : 'border-[#2f2d2a]'
      }`}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {isOverdue && (
        <div className="flex items-center gap-1.5 text-[#e05040] text-xs font-semibold mb-3 pb-3 border-b border-[#c0392b]/20">
          <AlertCircle size={12} /> Overdue — borrower hasn&apos;t confirmed handback yet
        </div>
      )}

      {isReturnSubmitted && (
        <div className="flex items-center gap-1.5 text-[#f0c060] text-xs font-semibold mb-3 pb-3 border-b border-[#c88b30]/20">
          <CheckCircle size={12} /> Borrower completed return checklist — ready for your confirmation
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
            <User size={16} className="text-[#5a5751]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#ede9e3] font-semibold text-sm truncate">
              {rental.borrower?.full_name || 'Unknown'}
            </p>
            <p className="text-[#5a5751] text-xs">Block {rental.borrower?.block_code}</p>
          </div>
        </div>
        <StatusBadge status={rental.status} />
      </div>

      <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-[#1a1917] border border-[#2f2d2a]">
        <Package size={13} className="text-[#d05a38] shrink-0" />
        <span className="text-[#a8a49c] text-sm font-medium truncate">{rental.tools?.title}</span>
        <span className="text-[10px] text-[#5a5751] ml-auto shrink-0">{rental.tools?.category}</span>
      </div>

      {/* Checklist summary if submitted */}
      {isReturnSubmitted && rental.return_checklist && (
        <div className="rounded-lg bg-[#1a1917] border border-[#2f2d2a] p-3 mb-3 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {rental.return_checklist.cleaned && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#7db884] bg-[#4a8c55]/12 px-2 py-0.5 rounded-full">
                <Check size={10} /> Cleaned
              </span>
            )}
            {rental.return_checklist.accessories && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#7db884] bg-[#4a8c55]/12 px-2 py-0.5 rounded-full">
                <Check size={10} /> Accessories included
              </span>
            )}
            {rental.return_checklist.secured && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#7db884] bg-[#4a8c55]/12 px-2 py-0.5 rounded-full">
                <Check size={10} /> Placed securely
              </span>
            )}
          </div>
          {rental.return_note && (
            <p className="text-xs text-[#7d7a73] italic">&ldquo;{rental.return_note}&rdquo;</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-[#7d7a73] mb-4">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-[#5a5751]" />
          {formatDate(rental.start_date)} → {formatDate(rental.due_date)}
        </div>
        <span className="text-[#5a5751] ml-auto">{days}d</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onViewDetails(rental)}
          className="px-3.5 py-2 rounded-lg border border-[#2f2d2a] hover:border-[#3d3b37] text-[#a8a49c] text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Eye size={13} /> View Details
        </button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onConfirmReturn(rental)}
          disabled={confirming}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
            isReturnSubmitted
              ? 'bg-[#4a8c55] hover:bg-[#58a364] text-white shadow-lg shadow-[#4a8c55]/20'
              : 'bg-[#4a8c55]/15 hover:bg-[#4a8c55]/25 border border-[#4a8c55]/25 text-[#7db884]'
          }`}
        >
          <CheckCircle size={14} />
          {confirming ? 'Confirming…' : 'Confirm Return'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Returned rental card (history + two-way review CTA) ───────
function ReturnedRentalCard({ rental, onRate }) {
  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-5"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
            <User size={14} className="text-[#5a5751]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#ede9e3] font-semibold text-sm truncate">{rental.borrower?.full_name}</p>
            <p className="text-[#5a5751] text-xs">{rental.tools?.title}</p>
          </div>
        </div>
        <StatusBadge status={rental.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-[#5a5751] pt-3 border-t border-[#2f2d2a]">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={11} />
          {formatDate(rental.start_date)} → {formatDate(rental.due_date)}
          {rental.returned_at && (
            <span className="text-[#3d3b37] flex items-center gap-1 ml-2">
              <RotateCcw size={10} /> {timeAgo(rental.returned_at)}
            </span>
          )}
        </span>

        {rental.hasReview ? (
          <span className="flex items-center gap-1 text-[#f0c060] text-xs">
            <Star size={11} className="fill-[#f0c060]" /> Rated
          </span>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onRate(rental)}
            className="flex items-center gap-1 text-xs font-semibold text-[#f0c060] hover:text-[#f5d080] transition-colors"
          >
            <Star size={11} /> Rate Borrower
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Rental Details Modal ──────────────────────────────────────
function RentalDetailsModal({ rental, onClose }) {
  return (
    <AnimatePresence>
      {rental && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-[#1e1c1a] border border-[#2f2d2a] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2f2d2a]">
                <h2 className="text-[#ede9e3] font-semibold text-base">Rental Details</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="w-7 h-7 rounded-lg hover:bg-[#2f2d2a] flex items-center justify-center text-[#5a5751] hover:text-[#a8a49c]"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#7d7a73]">Tool</span>
                  <span className="text-[#ede9e3] font-semibold">{rental.tools?.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7d7a73]">Borrower</span>
                  <span className="text-[#ccc9c2]">{rental.borrower?.full_name} (Block {rental.borrower?.block_code})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7d7a73]">Dates</span>
                  <span className="text-[#ccc9c2]">{formatDate(rental.start_date)} → {formatDate(rental.due_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7d7a73]">Status</span>
                  <StatusBadge status={rental.status} />
                </div>
                {rental.return_note && (
                  <div className="rounded-lg bg-[#1a1917] border border-[#2f2d2a] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#5a5751] mb-1">Borrower Handback Note</p>
                    <p className="text-xs text-[#a8a49c]">{rental.return_note}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState({ icon: Icon, title, body }) {
  return (
    <motion.div
      className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-14 text-center"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center mx-auto mb-5">
        <Icon size={24} className="text-[#5a5751]" />
      </div>
      <h3 className="text-[#ede9e3] font-semibold text-lg mb-2">{title}</h3>
      <p className="text-[#5a5751] text-sm max-w-xs mx-auto leading-relaxed">{body}</p>
    </motion.div>
  );
}

// ── Owner Dashboard ───────────────────────────────────────────
export default function OwnerDashboard() {
  const [requests, setRequests]     = useState([]);
  const [rentals, setRentals]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('incoming');
  const [confirmingId, setConfirmingId] = useState(null);
  const [detailsRental, setDetailsRental] = useState(null);
  const [reviewTarget, setReviewTarget]   = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, rentalRes] = await Promise.all([
        api.get('/requests/incoming'),
        api.get('/rentals/owner'),
      ]);
      setRequests(reqRes.data.requests || []);
      setRentals(rentalRes.data.rentals || []);
    } catch (err) {
      console.error('Failed to fetch owner data:', err);
      toast.error('Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [reqRes, rentalRes] = await Promise.all([
          api.get('/requests/incoming'),
          api.get('/rentals/owner'),
        ]);
        if (active) {
          setRequests(reqRes.data.requests || []);
          setRentals(rentalRes.data.rentals || []);
        }
      } catch (err) {
        console.error('Failed to fetch owner data:', err);
        if (active) toast.error('Could not load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleAction(requestId, action) {
    try {
      await api.patch(`/requests/${requestId}/${action}`);
      toast.success(action === 'accept' ? 'Request accepted! Dates locked.' : 'Request rejected.');
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accept') {
        const rentalRes = await api.get('/rentals/owner');
        setRentals(rentalRes.data.rentals || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} request.`);
      fetchAll();
    }
  }

  async function handleConfirmReturn(rental) {
    setConfirmingId(rental.id);
    try {
      await api.patch(`/rentals/${rental.id}/confirm-return`);
      toast.success('Return confirmed! Tool is back in the neighborhood catalog.');
      await fetchAll();
      // Prompt owner to rate borrower right after confirmation (US-10)
      setReviewTarget({ ...rental, status: 'returned' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm return.');
    } finally {
      setConfirmingId(null);
    }
  }

  const pendingCount  = requests.length;
  const activeRentals = rentals.filter(r => ['active', 'return_submitted', 'overdue'].includes(r.status));
  const history       = rentals.filter(r => r.status === 'returned');
  const attentionCount = activeRentals.filter(r => ['overdue', 'return_submitted'].includes(r.status)).length;

  const tabs = [
    { id: 'incoming', label: 'Incoming', icon: Inbox,        badge: pendingCount },
    { id: 'active',   label: 'Active',   icon: CalendarDays, badge: attentionCount, badgeColor: 'bg-[#c88b30]' },
    { id: 'history',  label: 'History',  icon: History,      badge: null },
  ];

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#5a5751] mb-2 flex items-center gap-1.5">
            <Inbox size={11} className="text-[#d05a38]" />
            Owner Dashboard
          </p>
          <div className="flex items-center justify-between">
            <h1 className="display text-3xl text-[#ede9e3]">My Tool Rentals</h1>
            {pendingCount > 0 && (
              <motion.div
                key={pendingCount}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d05a38]/15 border border-[#d05a38]/30"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#d05a38] animate-pulse" />
                <span className="text-[#f08b6a] text-xs font-semibold">{pendingCount} pending</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 border-b border-[#2f2d2a]">
          {tabs.map(({ id, label, icon: Icon, badge, badgeColor }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === id ? 'text-[#ede9e3]' : 'text-[#5a5751] hover:text-[#a8a49c]'
              }`}
            >
              <Icon size={14} />
              {label}
              {badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${badgeColor || 'bg-[#d05a38]'}`}>
                  {badge}
                </span>
              )}
              {activeTab === id && (
                <motion.div
                  layoutId="owner-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px bg-[#d05a38]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" text="Loading…" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Incoming tab ── */}
              {activeTab === 'incoming' && (
                <div className="space-y-4">
                  {/* 24-hour response tip (US-08) */}
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#242220] border border-[#2f2d2a] text-xs text-[#7d7a73]">
                    <Info size={14} className="text-[#f0c060] shrink-0" />
                    <span>Tip: Respond within 24 hours to keep your neighborhood response rate high.</span>
                  </div>

                  {requests.length === 0 ? (
                    <EmptyState
                      icon={Inbox}
                      title="No pending requests"
                      body="When neighbors request your tools, they'll appear here."
                    />
                  ) : (
                    <AnimatePresence mode="popLayout">
                      <motion.div layout>
                        {requests.map(request => (
                          <motion.div
                            key={request.id}
                            layout
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                          >
                            <RequestCard request={request} onAction={handleAction} />
                          </motion.div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* ── Active tab ── */}
              {activeTab === 'active' && (
                activeRentals.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No active rentals"
                    body="When you accept a borrow request, the active rental will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {activeRentals.map(rental => (
                      <ActiveRentalCard
                        key={rental.id}
                        rental={rental}
                        onConfirmReturn={handleConfirmReturn}
                        confirming={confirmingId === rental.id}
                        onViewDetails={setDetailsRental}
                      />
                    ))}
                  </div>
                )
              )}

              {/* ── History tab ── */}
              {activeTab === 'history' && (
                history.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No rental history yet"
                    body="Completed rentals will appear here once you confirm handbacks."
                  />
                ) : (
                  <div className="space-y-3">
                    {history.map(rental => (
                      <ReturnedRentalCard
                        key={rental.id}
                        rental={rental}
                        onRate={(r) => setReviewTarget(r)}
                      />
                    ))}
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Rental Details Modal */}
      <RentalDetailsModal rental={detailsRental} onClose={() => setDetailsRental(null)} />

      {/* Two-way Review Modal (owner rates borrower) */}
      <ReviewModal
        rental={reviewTarget}
        role="owner"
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSuccess={fetchAll}
      />
    </div>
  );
}
