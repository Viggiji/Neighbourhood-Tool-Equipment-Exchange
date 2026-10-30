/**
 * NTEE — BorrowRequestModal
 * ─────────────────────────────────────────────────────────────
 * A date-picker + message modal that calls POST /api/requests.
 * Surfaces the 409 overlap error from the atomic PostgreSQL check.
 *
 * Usage:
 *   <BorrowRequestModal tool={tool} isOpen={show} onClose={() => setShow(false)} />
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MessageSquare, Package, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function BorrowRequestModal({ tool, isOpen, onClose }) {
  const today = getTodayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [message, setMessage]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [overlap, setOverlap]     = useState(false); // show overlap warning

  async function handleSubmit(e) {
    e.preventDefault();
    setOverlap(false);

    if (endDate < startDate) {
      toast.error('End date must be on or after start date.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/requests', {
        toolId:    tool.id,
        startDate,
        endDate,
        message:   message.trim() || undefined,
      });
      toast.success('Request submitted! The owner will be notified.');
      onClose();
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || 'Failed to submit request.';

      if (status === 409) {
        setOverlap(true); // surface the overlap UI
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const dayCount = Math.max(
    1,
    Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1,
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            id="borrow-modal-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            id="borrow-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="w-full max-w-md bg-[#1e1c1a] border border-[#2f2d2a] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#2f2d2a]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#d05a38]/12 border border-[#d05a38]/20 flex items-center justify-center">
                    <Package size={15} className="text-[#d05a38]" />
                  </div>
                  <div>
                    <h2 className="text-[#ede9e3] font-semibold text-base leading-tight">Request to Borrow</h2>
                    <p className="text-[#5a5751] text-xs truncate max-w-[200px]">{tool?.title}</p>
                  </div>
                </div>
                <button
                  id="borrow-modal-close"
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg hover:bg-[#2f2d2a] flex items-center justify-center text-[#5a5751] hover:text-[#a8a49c] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Overlap error */}
                <AnimatePresence>
                  {overlap && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2.5 p-3 rounded-lg bg-[#c0392b]/10 border border-[#c0392b]/25"
                    >
                      <AlertCircle size={14} className="text-[#e05040] mt-0.5 shrink-0" />
                      <p className="text-[#e05040] text-xs leading-relaxed">
                        These dates overlap with an existing request. Please choose different dates.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="start-date" className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-1.5">
                      From
                    </label>
                    <div className="relative">
                      <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751]" />
                      <input
                        id="start-date"
                        type="date"
                        min={today}
                        value={startDate}
                        onChange={e => {
                          setStartDate(e.target.value);
                          setOverlap(false);
                          if (e.target.value > endDate) setEndDate(e.target.value);
                        }}
                        className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#d05a38] focus:ring-2
                                   focus:ring-[#d05a38]/12 rounded-lg py-2 pl-8 pr-3 text-[#ede9e3] text-sm
                                   outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-1.5">
                      Until
                    </label>
                    <div className="relative">
                      <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751]" />
                      <input
                        id="end-date"
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={e => { setEndDate(e.target.value); setOverlap(false); }}
                        className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#d05a38] focus:ring-2
                                   focus:ring-[#d05a38]/12 rounded-lg py-2 pl-8 pr-3 text-[#ede9e3] text-sm
                                   outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Duration pill */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1917] border border-[#2f2d2a]">
                  <span className="text-[#5a5751] text-xs">Duration:</span>
                  <span className="text-[#d05a38] text-xs font-semibold">{dayCount} day{dayCount !== 1 ? 's' : ''}</span>
                  {tool?.depositAmount > 0 && (
                    <>
                      <span className="text-[#3d3b37] text-xs ml-auto">Est. deposit</span>
                      <span className="text-[#f0c060] text-xs font-semibold">
                        ₹{(tool.depositAmount * dayCount).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
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
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Briefly describe what you need it for…"
                      rows={3}
                      maxLength={300}
                      className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#d05a38] focus:ring-2
                                 focus:ring-[#d05a38]/12 rounded-lg py-2.5 pl-8 pr-3 text-[#ede9e3] text-sm
                                 placeholder-[#3d3b37] outline-none resize-none transition-all"
                    />
                  </div>
                  <p className="text-right text-[10px] text-[#3d3b37] mt-1">{message.length}/300</p>
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
                  <button
                    type="submit"
                    id="borrow-submit-btn"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-[#d05a38] hover:bg-[#e06b48] text-white text-sm font-semibold
                               transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#d05a38]/20"
                  >
                    {loading ? 'Sending…' : 'Send Request'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
