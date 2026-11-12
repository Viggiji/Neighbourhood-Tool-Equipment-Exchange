import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Zap, Edit2, CheckCircle, ArrowLeft, Trash2,
  AlertTriangle, Star, CalendarDays, ShieldCheck, Users, MessageSquare, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AnimatedFormField from '../components/ui/AnimatedFormField';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BorrowRequestModal from '../components/BorrowRequestModal';
import ReviewModal from '../components/ReviewModal';

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Gardening', 'Ladders & Scaffolding', 'Other'];

const CATEGORY_META = {
  'Power Tools':          { tag: 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25' },
  'Hand Tools':           { tag: 'text-[#8fba93] bg-[#4e7252]/12 border-[#4e7252]/25' },
  'Gardening':            { tag: 'text-[#6a9870] bg-[#3d5a40]/12 border-[#3d5a40]/25' },
  'Ladders & Scaffolding':{ tag: 'text-[#f08b6a] bg-[#d05a38]/12 border-[#d05a38]/25' },
  'Other':                { tag: 'text-[#a8a49c] bg-[#3d3b37]/30 border-[#3d3b37]' },
};

function formatLenderSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatReviewDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Star display (read-only) ──────────────────────────────────
function StarDisplay({ rating, size = 14 }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= filled ? 'text-[#f0c060] fill-[#f0c060]' : 'text-[#3d3b37]'}
        />
      ))}
    </div>
  );
}

export default function ToolDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trustData, setTrustData] = useState({ trustScore: 0, reviewCount: 0 });
  const [reviews, setReviews] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: '', description: '', condition: '', depositAmount: '', status: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [showBorrowModal, setShowBorrowModal] = useState(false);

  // "Rate This Tool" — borrower's most recent completed rental for this tool
  const [myCompletedRental, setMyCompletedRental] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const loadToolData = useCallback(async () => {
    try {
      const res = await api.get(`/tools/${id}`);
      const t = res.data.tool;
      setTool(t);
      setFormData({
        title: t.title,
        category: t.category,
        description: t.description,
        condition: t.condition,
        depositAmount: t.depositAmount,
        status: t.status,
      });

      const [trustRes, reviewsRes] = await Promise.all([
        api.get(`/reviews/trust/${t.ownerId}`).catch(() => null),
        api.get(`/reviews/user/${t.ownerId}`).catch(() => null),
      ]);
      if (trustRes) setTrustData(trustRes.data);
      if (reviewsRes) setReviews(reviewsRes.data.reviews || []);
    } catch (err) {
      console.error('Fetch tool error:', err);
      toast.error('Could not load tool details.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await api.get(`/tools/${id}`);
        const t = res.data.tool;
        if (!active) return;
        setTool(t);
        setFormData({
          title: t.title,
          category: t.category,
          description: t.description,
          condition: t.condition,
          depositAmount: t.depositAmount,
          status: t.status,
        });

        const [trustRes, reviewsRes, completedRentalRes] = await Promise.all([
          api.get(`/reviews/trust/${t.ownerId}`).catch(() => null),
          api.get(`/reviews/user/${t.ownerId}`).catch(() => null),
          api.get(`/rentals/tool/${id}/my-completed`).catch(() => null),
        ]);
        if (!active) return;
        if (trustRes) setTrustData(trustRes.data);
        if (reviewsRes) setReviews(reviewsRes.data.reviews || []);
        if (completedRentalRes?.data?.rental) setMyCompletedRental(completedRentalRes.data.rental);
      } catch (err) {
        console.error('Fetch tool error:', err);
        if (active) {
          toast.error('Could not load tool details.');
          navigate('/dashboard');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [id, navigate]);

  const isOwner = user && tool && user.id === tool.ownerId;

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/tools/${id}`);
      toast.success('Tool deleted successfully.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete tool.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('category', formData.category);
      payload.append('description', formData.description);
      payload.append('condition', formData.condition);
      payload.append('depositAmount', Number(formData.depositAmount));
      payload.append('status', formData.status);
      if (file) payload.append('image', file);

      const res = await api.put(`/tools/${id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message);
      await loadToolData();
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update tool.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!tool) return null;

  const isAvailable = tool.status === 'Available';
  const isRented = tool.status === 'Rented';
  const canReserve = tool.status !== 'Unavailable';
  const catMeta = CATEGORY_META[tool.category] || CATEGORY_META['Other'];
  const lenderSince = formatLenderSince(tool.ownerCreatedAt || tool.createdAt);

  return (
    <div className="min-h-screen pt-14 pb-20 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto pt-10">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#5a5751] hover:text-[#a8a49c] text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main info (spans 2 cols) ── */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              className="rounded-2xl bg-[#242220] border border-[#2f2d2a] overflow-hidden"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Image */}
              {tool.imageUrl && (
                <div className="w-full h-72 sm:h-96 overflow-hidden bg-[#1a1917]">
                  <img src={tool.imageUrl} alt={tool.title} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="p-7 sm:p-9">
                {/* Category + status */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`tag border ${catMeta.tag}`}>{tool.category}</span>
                  <span className={`tag border ${
                    isAvailable
                      ? 'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25'
                      : isRented
                        ? 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25'
                        : 'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20'
                  }`}>
                    {tool.status}
                  </span>
                </div>

                <h1 className="display text-3xl sm:text-4xl text-[#ede9e3] mb-2 leading-snug">
                  {tool.title}
                </h1>
                <p className="text-[#5a5751] text-sm mb-8">
                  Listed by <span className="text-[#a8a49c]">{tool.ownerName}</span> · Block {tool.ownerBlock}
                  {lenderSince && <> · Lender since {lenderSince}</>}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-5">
                    <div className="flex items-center gap-2 text-[#5a5751] mb-2">
                      <Activity size={14} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Condition</span>
                    </div>
                    <p className="text-lg font-semibold text-[#ccc9c2]">{tool.condition}</p>
                  </div>
                  <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-5">
                    <div className="flex items-center gap-2 text-[#5a5751] mb-2">
                      <Zap size={14} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Deposit rate</span>
                    </div>
                    <p className="text-lg font-semibold text-[#d05a38]">₹{tool.depositAmount} / day</p>
                  </div>
                </div>

                <hr className="border-t border-[#2f2d2a] mb-6" />

                <h2 className="text-sm font-semibold text-[#7d7a73] uppercase tracking-wider mb-3">Description</h2>
                <p className="text-[#a8a49c] leading-relaxed whitespace-pre-wrap text-sm">
                  {tool.description}
                </p>
              </div>
            </motion.div>

            {/* ── Neighbor Reviews for Owner ── */}
            <motion.div
              className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-7 sm:p-8"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-[#a8a49c] uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={14} className="text-[#d05a38]" />
                  Neighbor Reviews
                </h2>
                {trustData.reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={trustData.trustScore} size={13} />
                    <span className="text-xs font-semibold text-[#ede9e3]">
                      {Number(trustData.trustScore).toFixed(1)}
                    </span>
                    <span className="text-xs text-[#5a5751]">({trustData.reviewCount})</span>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <p className="text-sm text-[#5a5751]">
                  No reviews for {tool.ownerName} yet. Be the first neighbor to borrow and leave feedback.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.slice(0, 6).map((rev, idx) => (
                    <motion.div
                      key={rev.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#2f2d2a] flex items-center justify-center shrink-0">
                            <User size={12} className="text-[#7d7a73]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#ede9e3] truncate">
                              {rev.reviewer?.full_name || 'Neighbor'}
                              {rev.reviewer?.block_code && (
                                <span className="text-[#5a5751] font-normal"> · Block {rev.reviewer.block_code}</span>
                              )}
                            </p>
                            {rev.tools?.title && (
                              <p className="text-[10px] text-[#5a5751] truncate">{rev.tools.title}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StarDisplay rating={rev.rating} size={12} />
                          <span className="text-[10px] text-[#5a5751]">{formatReviewDate(rev.created_at)}</span>
                        </div>
                      </div>
                      {rev.comment && (
                        <p className="text-xs text-[#a8a49c] leading-relaxed">{rev.comment}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Right panel: Owner panel OR Borrower panel ── */}
          <div className="lg:col-span-1">

            {/* ── OWNER panel ── */}
            {isOwner && (
              <motion.div
                className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-6 sm:p-7 sticky top-20"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[#ede9e3] font-semibold flex items-center gap-2">
                    <Edit2 size={15} className="text-[#d05a38]" /> Manage listing
                  </h2>
                  <button
                    onClick={() => { setIsEditing(!isEditing); setConfirmDelete(false); }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isEditing
                        ? 'bg-[#2f2d2a] text-[#a8a49c]'
                        : 'bg-[#d05a38]/15 text-[#f08b6a] hover:bg-[#d05a38]/25'
                    }`}
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.form
                      key="edit"
                      onSubmit={handleSave}
                      className="space-y-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <AnimatedFormField
                        id="edit-title" label="Title" value={formData.title}
                        onChange={handleChange('title')} required
                      />

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#a8a49c]">Category</label>
                        <select value={formData.category} onChange={handleChange('category')} className="input-field" required>
                          <option value="" disabled>Select category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#a8a49c]">Status</label>
                        <select value={formData.status} onChange={handleChange('status')} className="input-field" required>
                          <option value="Available">Available</option>
                          <option value="Unavailable">Unavailable</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#a8a49c]">Description</label>
                        <textarea value={formData.description} onChange={handleChange('description')} rows={3} className="input-field resize-none" required />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <AnimatedFormField id="edit-condition" label="Condition" value={formData.condition} onChange={handleChange('condition')} required />
                        <AnimatedFormField id="edit-deposit" label="Deposit (₹)" type="number" value={formData.depositAmount} onChange={handleChange('depositAmount')} required />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#a8a49c]">Update photo</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="text-xs text-[#7d7a73] w-full" />
                      </div>

                      <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5 text-sm mt-2 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="idle"
                      className="text-center py-6"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#1a1917] border border-[#2f2d2a] flex items-center justify-center mx-auto mb-3">
                        <CheckCircle size={18} className="text-[#3d3b37]" />
                      </div>
                      <p className="text-[#5a5751] text-sm leading-relaxed mb-6">
                        This is your listing. Click <strong className="text-[#7d7a73]">Edit</strong> to update details, status, or the deposit rate.
                      </p>

                      {/* Delete section */}
                      <div className="border-t border-[#2f2d2a] pt-5">
                        {!confirmDelete ? (
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-2 text-[#5a5751] hover:text-[#e05040] text-xs font-medium transition-colors mx-auto"
                          >
                            <Trash2 size={13} /> Remove listing
                          </button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl bg-[#1a1917] border border-[#e05040]/20 p-4"
                          >
                            <div className="flex items-center gap-2 text-[#e05040] mb-2">
                              <AlertTriangle size={14} />
                              <span className="text-xs font-semibold">Delete this listing?</span>
                            </div>
                            <p className="text-[#5a5751] text-xs mb-4 leading-relaxed">
                              This will permanently remove <strong className="text-[#7d7a73]">{tool.title}</strong> from the exchange.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmDelete(false)}
                                className="flex-1 py-2 rounded-lg bg-[#2f2d2a] text-[#7d7a73] hover:text-[#a8a49c] text-xs font-medium transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2 rounded-lg bg-[#e05040]/15 text-[#e05040] hover:bg-[#e05040]/25 text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                {deleting ? 'Deleting...' : 'Yes, delete'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── BORROWER panel ── */}
            {!isOwner && (
              <motion.div
                className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-6 sm:p-7 sticky top-20 space-y-5"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                {/* Owner Profile & Trust Rating */}
                <div className="pb-5 border-b border-[#2f2d2a]">
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#5a5751] mb-3 flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-[#d05a38]" /> Owner Profile
                  </p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#d05a38]/15 border border-[#d05a38]/25 flex items-center justify-center text-sm font-bold text-[#f08b6a] shrink-0">
                      {tool.ownerName?.charAt(0)?.toUpperCase() || 'N'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#ede9e3] truncate">{tool.ownerName}</p>
                      <p className="text-xs text-[#5a5751]">
                        Block {tool.ownerBlock}
                        {lenderSince && ` · Since ${lenderSince}`}
                      </p>
                    </div>
                  </div>
                  {trustData.reviewCount > 0 ? (
                    <div className="flex items-center gap-3 bg-[#1a1917] border border-[#2f2d2a] rounded-xl px-3.5 py-2.5">
                      <StarDisplay rating={trustData.trustScore} size={15} />
                      <span className="text-[#ede9e3] font-bold text-sm">
                        {Number(trustData.trustScore).toFixed(1)}
                      </span>
                      <span className="text-[#5a5751] text-xs ml-auto flex items-center gap-1">
                        <Users size={11} />
                        {trustData.reviewCount} review{trustData.reviewCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#5a5751] bg-[#1a1917] border border-[#2f2d2a] rounded-xl px-3.5 py-2.5">
                      Verified neighbor · No reviews yet
                    </div>
                  )}
                </div>

                {/* Availability + Booking Card */}
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#5a5751] mb-4">
                    Availability
                  </p>

                  {canReserve ? (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAvailable ? 'bg-[#7db884]' : 'bg-[#f0c060]'}`} />
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${isAvailable ? 'bg-[#7db884]' : 'bg-[#f0c060]'}`} />
                        </span>
                        <span className={`text-sm font-medium ${isAvailable ? 'text-[#7db884]' : 'text-[#f0c060]'}`}>
                          {isAvailable ? 'Available to borrow' : 'Currently rented · Reserve open dates'}
                        </span>
                      </div>

                      {/* Deposit preview */}
                      <div className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-4 mb-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[#5a5751] text-xs">Daily deposit</span>
                          <span className="text-[#d05a38] font-bold text-base">₹{tool.depositAmount}</span>
                        </div>
                        <p className="text-[11px] text-[#7d7a73]">
                          You won&apos;t be charged yet. Handoff and deposit happen in person.
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowBorrowModal(true)}
                        className="w-full py-3 rounded-xl bg-[#d05a38] hover:bg-[#e06b48] text-white font-semibold
                                   text-sm transition-all shadow-lg shadow-[#d05a38]/25 flex items-center justify-center gap-2"
                      >
                        <CalendarDays size={15} />
                        Request to Borrow
                      </motion.button>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="rounded-xl bg-[#1a1917] border border-[#2f2d2a] p-5 text-center"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#c0392b]/08 border border-[#c0392b]/15 flex items-center justify-center mx-auto mb-3">
                        <CalendarDays size={16} className="text-[#e05040]" />
                      </div>
                      <p className="text-[#a8a49c] text-sm font-medium mb-1">Currently {tool.status}</p>
                      <p className="text-[#5a5751] text-xs">
                        This tool isn&apos;t accepting requests right now. Check back later.
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* ToolShare Protection Badge */}
                <div className="rounded-xl bg-[#4a8c55]/08 border border-[#4a8c55]/20 p-3.5 flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-[#7db884] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[#7db884]">ToolShare Protection</p>
                    <p className="text-[11px] text-[#7d7a73] leading-relaxed mt-0.5">
                      Block-verified handoffs and clear return checklists keep every exchange accountable.
                    </p>
                  </div>
                </div>

                {/* Rate This Tool — only shown to borrowers who completed a rental */}
                {myCompletedRental && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl bg-[#c88b30]/10 border border-[#c88b30]/25 p-4"
                    >
                      <p className="text-xs font-semibold text-[#f0c060] mb-1 flex items-center gap-1.5">
                        <Star size={12} className="fill-[#f0c060]" /> You've borrowed this tool
                      </p>
                      <p className="text-[11px] text-[#7d7a73] mb-3 leading-relaxed">
                        Share your experience to help neighbors make better choices.
                      </p>
                      {myCompletedRental.hasReview ? (
                        <span className="text-xs text-[#f0c060]/60 flex items-center gap-1.5">
                          <Star size={11} className="fill-[#f0c060]/60" /> Review submitted — thank you!
                        </span>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setShowReviewModal(true)}
                          className="w-full py-2.5 rounded-lg bg-[#c88b30]/20 hover:bg-[#c88b30]/35
                                     border border-[#c88b30]/30 text-[#f0c060] text-xs font-semibold
                                     flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Star size={13} /> Rate Your Experience
                        </motion.button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Borrow modal */}
      <BorrowRequestModal
        tool={tool}
        isOpen={showBorrowModal}
        onClose={() => setShowBorrowModal(false)}
        onSuccess={loadToolData}
      />

      {/* Tool review modal — borrower rates this rental/tool */}
      {myCompletedRental && (
        <ReviewModal
          rental={myCompletedRental}
          role="borrower"
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setMyCompletedRental((prev) => prev ? { ...prev, hasReview: true } : prev);
            setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}
