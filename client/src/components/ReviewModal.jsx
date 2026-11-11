/**
 * NTEE — ReviewModal (US-10)
 * ─────────────────────────────────────────────────────────────
 * Two-way star-rating + written review modal ("Rate Your Experience")
 * for borrowers rating owners OR owners rating borrowers on completed rentals.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Package, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

function ReviewForm({ rental, role = 'borrower', onClose, onSuccess }) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [comment, setComment]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isCompleted = rental?.status === 'returned';
  const otherPartyName =
    role === 'owner'
      ? rental?.borrower?.full_name || 'Borrower'
      : rental?.owner?.full_name || 'Owner';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isCompleted) {
      toast.error('Ratings can only be submitted for completed returns.');
      return;
    }
    if (rating === 0) {
      toast.error('Please choose a star rating.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/reviews', {
        rentalId: rental.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Review submitted! Trust score updated.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit review.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const displayRating = hovered || rating;
  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto w-full max-w-sm bg-[#1e1c1a] border border-[#2f2d2a] rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2f2d2a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f0c060]/12 border border-[#c88b30]/20 flex items-center justify-center">
            <Star size={15} className="text-[#f0c060]" />
          </div>
          <div>
            <h2 className="text-[#ede9e3] font-semibold text-base leading-tight">Rate Your Experience</h2>
            <p className="text-[#5a5751] text-xs truncate max-w-[190px]">
              {rental?.tools?.title || 'Tool rental'}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-[#2f2d2a] flex items-center justify-center text-[#5a5751] hover:text-[#a8a49c] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!isCompleted ? (
          <motion.div
            key="blocked"
            className="px-6 py-8 text-center space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#c0392b]/12 border border-[#c0392b]/25 flex items-center justify-center mx-auto">
              <AlertCircle size={22} className="text-[#e05040]" />
            </div>
            <p className="text-[#ede9e3] text-sm font-semibold">
              Ratings can only be submitted for completed returns.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-lg border border-[#2f2d2a] text-[#a8a49c] text-sm font-medium hover:border-[#3d3b37]"
            >
              Close
            </button>
          </motion.div>
        ) : submitted ? (
          <motion.div
            key="success"
            className="px-6 py-10 flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="w-14 h-14 rounded-2xl bg-[#4a8c55]/15 border border-[#4a8c55]/30 flex items-center justify-center"
            >
              <CheckCircle size={26} className="text-[#7db884]" />
            </motion.div>
            <div className="text-center">
              <p className="text-[#ede9e3] font-semibold text-base">Review submitted!</p>
              <p className="text-[#5a5751] text-sm mt-1">
                {otherPartyName}&apos;s profile rating has been updated.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className="px-6 py-5 space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1917] border border-[#2f2d2a]">
              <Package size={13} className="text-[#d05a38] shrink-0" />
              <span className="text-[#a8a49c] text-sm font-medium truncate">
                {rental?.tools?.title || 'Tool'}
              </span>
              <span className="text-[#7d7a73] text-xs ml-auto shrink-0">
                {role === 'owner' ? 'Borrower: ' : 'Owner: '}
                <strong className="text-[#ccc9c2] font-medium">{otherPartyName}</strong>
              </span>
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-3">
                Your Rating
              </p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.button
                    key={i}
                    type="button"
                    aria-label={`${i} star${i > 1 ? 's' : ''}`}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(i)}
                    className="focus:outline-none"
                  >
                    <Star
                      size={28}
                      className={`transition-all duration-150 ${
                        i <= displayRating
                          ? 'text-[#f0c060] fill-[#f0c060] drop-shadow-[0_0_6px_rgba(240,192,96,0.5)]'
                          : 'text-[#3d3b37]'
                      }`}
                    />
                  </motion.button>
                ))}
                <AnimatePresence mode="wait">
                  {displayRating > 0 && (
                    <motion.span
                      key={displayRating}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[#7d7a73] text-sm ml-2"
                    >
                      {starLabels[displayRating]}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-1.5">
                Review <span className="normal-case text-[#3d3b37]">(optional)</span>
              </label>
              <div className="relative">
                <MessageSquare size={12} className="absolute left-3 top-3 text-[#5a5751]" />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    role === 'owner'
                      ? 'Was the tool returned clean, on time, and in good condition?'
                      : 'What did you use it for? Was the tool in good condition?'
                  }
                  rows={3}
                  maxLength={400}
                  className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#f0c060]/40 focus:ring-2
                             focus:ring-[#f0c060]/08 rounded-lg py-2.5 pl-8 pr-3 text-[#ede9e3] text-sm
                             placeholder-[#3d3b37] outline-none resize-none transition-all"
                />
              </div>
              <p className="text-right text-[10px] text-[#3d3b37] mt-1">{comment.length}/400</p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[#2f2d2a] text-[#7d7a73] text-sm font-medium
                           hover:border-[#3d3b37] hover:text-[#a8a49c] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || rating === 0}
                className="flex-1 py-2.5 rounded-lg bg-[#f0c060]/90 hover:bg-[#f0c060] text-[#1a1917] text-sm font-semibold
                           transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#f0c060]/10"
              >
                {loading ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReviewModal({ rental, role = 'borrower', isOpen, onClose, onSuccess }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <ReviewForm key={`${rental?.id}-${role}`} rental={rental} role={role} onClose={onClose} onSuccess={onSuccess} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
