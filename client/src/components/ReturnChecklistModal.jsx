/**
 * NTEE — ReturnChecklistModal (US-09)
 * ─────────────────────────────────────────────────────────────
 * Three-point handback verification checklist for borrowers returning
 * an active/overdue tool. "Submit Return" stays disabled (opacity 0.4)
 * until all three checkboxes are ticked.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Package, MapPin, CalendarDays, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const CHECKLIST_ITEMS = [
  {
    key: 'cleaned',
    label: 'The tool is cleaned and wiped down',
    hint: 'Free of dust, debris, or residue from your project.',
  },
  {
    key: 'accessories',
    label: 'All original accessories are included',
    hint: 'Batteries, chargers, blades, bits, and carrying case.',
  },
  {
    key: 'secured',
    label: 'Placed securely at the agreed handback location',
    hint: 'Returned to the lender’s block/pickup spot safely.',
  },
];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReturnChecklistForm({ rental, onClose, onSuccess }) {
  const [checks, setChecks] = useState({ cleaned: false, accessories: false, secured: false });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const allChecked = checks.cleaned && checks.accessories && checks.secured;
  const isOverdue = rental?.status === 'overdue';

  function toggleCheck(key) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allChecked || loading) return;

    setLoading(true);
    try {
      await api.patch(`/rentals/${rental.id}/submit-return`, {
        checklist: checks,
        note: note.trim() || undefined,
      });
      toast.success('Return submitted! Waiting for owner confirmation.');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit return.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto w-full max-w-md bg-[#1e1c1a] border border-[#2f2d2a] rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2f2d2a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4a8c55]/15 border border-[#4a8c55]/25 flex items-center justify-center">
            <RotateCcw size={15} className="text-[#7db884]" />
          </div>
          <div>
            <h2 className="text-[#ede9e3] font-semibold text-base leading-tight">Confirm Return</h2>
            <p className="text-[#5a5751] text-xs">Complete handback checklist</p>
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

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package size={13} className="text-[#d05a38] shrink-0" />
              <span className="text-sm font-semibold text-[#ede9e3] truncate">
                {rental?.tools?.title}
              </span>
            </div>
            {isOverdue && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-[#e05040] bg-[#c0392b]/12 border border-[#c0392b]/25 flex items-center gap-1 shrink-0">
                <AlertCircle size={10} /> Overdue
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-[#7d7a73]">
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-[#5a5751]" />
              {rental?.owner?.full_name} · Block {rental?.owner?.block_code}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={11} className="text-[#5a5751]" />
              Due {formatDate(rental?.due_date)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751]">
            Mandatory Handback Checklist
          </p>
          {CHECKLIST_ITEMS.map(({ key, label, hint }) => {
            const checked = checks[key];
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.99 }}
                onClick={() => toggleCheck(key)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  checked
                    ? 'bg-[#4a8c55]/10 border-[#4a8c55]/35'
                    : 'bg-[#242220] border-[#2f2d2a] hover:border-[#3d3b37]'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    checked
                      ? 'bg-[#4a8c55] border-[#4a8c55] text-white'
                      : 'border-[#5a5751]'
                  }`}
                >
                  {checked && <Check size={11} strokeWidth={3} />}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${checked ? 'text-[#ede9e3]' : 'text-[#ccc9c2]'}`}>
                    {label}
                  </p>
                  <p className="text-[11px] text-[#5a5751] mt-0.5">{hint}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div>
          <label htmlFor="return-note" className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5a5751] mb-1.5">
            Handback Note <span className="normal-case text-[#3d3b37]">(optional)</span>
          </label>
          <textarea
            id="return-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Left on the front porch bench as discussed…"
            rows={2}
            maxLength={400}
            className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#4a8c55]/50 focus:ring-2
                       focus:ring-[#4a8c55]/12 rounded-lg py-2 px-3 text-[#ede9e3] text-sm
                       placeholder-[#3d3b37] outline-none resize-none transition-all"
          />
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
          <motion.button
            type="submit"
            whileTap={allChecked ? { scale: 0.98 } : undefined}
            disabled={!allChecked || loading}
            className="flex-1 py-2.5 rounded-lg bg-[#4a8c55] hover:bg-[#58a364] text-white text-sm font-semibold
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#4a8c55]/20"
          >
            {loading ? 'Submitting…' : 'Submit Return'}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

export default function ReturnChecklistModal({ rental, isOpen, onClose, onSuccess }) {
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
            <ReturnChecklistForm key={rental?.id} rental={rental} onClose={onClose} onSuccess={onSuccess} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
