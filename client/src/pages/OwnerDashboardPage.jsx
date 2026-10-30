/**
 * NTEE — Owner Dashboard (Sprint 2)
 * ─────────────────────────────────────────────────────────────
 * Shows incoming borrow requests for the current user's tools.
 * Accept/Reject actions use GSAP to animate the card off-screen
 * before removing it from state — giving visual feedback with no
 * jarring DOM pop.
 *
 * Architecture:
 *   POST /api/requests/:id/accept  → creates rental, emits event
 *   POST /api/requests/:id/reject  → updates status,  emits event
 *   Notification appears in the DB asynchronously via EventBus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  CheckCircle, XCircle, Clock, Calendar, MessageSquare,
  User, Package, Inbox, Star,
} from 'lucide-react';
import api from '../lib/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending:   'text-[#f0c060] bg-[#c88b30]/12 border border-[#c88b30]/25',
    accepted:  'text-[#7db884] bg-[#4a8c55]/12 border border-[#4a8c55]/25',
    rejected:  'text-[#e05040] bg-[#c0392b]/10 border border-[#c0392b]/20',
    active:    'text-[#7db884] bg-[#4a8c55]/12 border border-[#4a8c55]/25',
    overdue:   'text-[#e05040] bg-[#c0392b]/10 border border-[#c0392b]/20',
    returned:  'text-[#a8a49c] bg-[#3d3b37]/30 border border-[#3d3b37]',
  };
  return (
    <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${styles[status] || styles.returned}`}>
      {status}
    </span>
  );
}

// ── Star Rating Display ───────────────────────────────────────
function StarRating({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-[#f0c060] fill-[#f0c060]' : 'text-[#3d3b37]'}
        />
      ))}
    </div>
  );
}

// ── Individual Request Card ───────────────────────────────────
// Uses a ref so GSAP can animate the DOM node directly before
// the state update removes it from the virtual DOM.
function RequestCard({ request, onAction }) {
  const cardRef  = useRef(null);
  const [acting, setActing] = useState(false); // loading state per card

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // GSAP exit animation → then call the server action
  async function handleAction(action) {
    if (acting) return;
    setActing(true);

    const el = cardRef.current;

    // Animate: slide right + fade out in 350ms
    await gsap.to(el, {
      x: action === 'accept' ? 80 : -80,
      opacity: 0,
      scale: 0.95,
      duration: 0.35,
      ease: 'power2.in',
    });

    // Animate height collapse so siblings slide up smoothly
    await gsap.to(el, {
      height: 0,
      marginBottom: 0,
      padding: 0,
      duration: 0.2,
      ease: 'power1.inOut',
    });

    // Now perform the server action
    onAction(request.id, action);
  }

  return (
    <div ref={cardRef} className="overflow-hidden">
      <div className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-5 mb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
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
              id={`accept-btn-${request.id}`}
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
              id={`reject-btn-${request.id}`}
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

// ── Owner Dashboard ───────────────────────────────────────────
export default function OwnerDashboard() {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('incoming');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests/incoming');
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      toast.error('Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Called by RequestCard after GSAP animation completes
  async function handleAction(requestId, action) {
    try {
      await api.patch(`/requests/${requestId}/${action}`);
      toast.success(action === 'accept' ? '✅ Request accepted!' : '❌ Request rejected.');
      // Remove from list (DOM already animated out by GSAP)
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      const msg = err.response?.data?.message || `Failed to ${action} request.`;
      toast.error(msg);
      // Re-fetch to restore correct state
      fetchRequests();
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
            <h1 className="display text-3xl text-[#ede9e3]">Borrow Requests</h1>
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
          {[{ id: 'incoming', label: 'Incoming' }].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === id ? 'text-[#ede9e3]' : 'text-[#5a5751] hover:text-[#a8a49c]'
              }`}
            >
              {label}
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
            <LoadingSpinner size="lg" text="Loading requests…" />
          </div>
        ) : requests.length === 0 ? (
          <motion.div
            className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-16 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center mx-auto mb-5">
              <Inbox size={24} className="text-[#5a5751]" />
            </div>
            <h3 className="text-[#ede9e3] font-semibold text-lg mb-2">No pending requests</h3>
            <p className="text-[#5a5751] text-sm max-w-xs mx-auto leading-relaxed">
              When neighbors request your tools, they'll appear here.
            </p>
          </motion.div>
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
                  transition={{ duration: 0.3 }}
                >
                  <RequestCard request={request} onAction={handleAction} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
