import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Edit2, CheckCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AnimatedFormField from '../components/ui/AnimatedFormField';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Gardening', 'Ladders & Scaffolding', 'Other'];

const CATEGORY_META = {
  'Power Tools':          { tag: 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25' },
  'Hand Tools':           { tag: 'text-[#8fba93] bg-[#4e7252]/12 border-[#4e7252]/25' },
  'Gardening':            { tag: 'text-[#6a9870] bg-[#3d5a40]/12 border-[#3d5a40]/25' },
  'Ladders & Scaffolding':{ tag: 'text-[#f08b6a] bg-[#d05a38]/12 border-[#d05a38]/25' },
  'Other':                { tag: 'text-[#a8a49c] bg-[#3d3b37]/30 border-[#3d3b37]' },
};

export default function ToolDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: '', description: '', condition: '', depositAmount: '', status: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTool = async () => {
      try {
        const res = await api.get(`/tools/${id}`);
        setTool(res.data.tool);
        setFormData({
          title: res.data.tool.title,
          category: res.data.tool.category,
          description: res.data.tool.description,
          condition: res.data.tool.condition,
          depositAmount: res.data.tool.depositAmount,
          status: res.data.tool.status,
        });
      } catch (err) {
        console.error('Fetch tool error:', err);
        toast.error('Could not load tool details.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchTool();
  }, [id, navigate]);

  const isOwner = user && tool && user.id === tool.ownerId;

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
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

      const refresh = await api.get(`/tools/${id}`);
      setTool(refresh.data.tool);
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
  const catMeta = CATEGORY_META[tool.category] || CATEGORY_META['Other'];

  return (
    <div className="min-h-screen pt-14 pb-20 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto pt-10">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#5a5751] hover:text-[#a8a49c] text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className={`grid grid-cols-1 ${isOwner ? 'lg:grid-cols-3' : ''} gap-8`}>

          {/* ── Main info ── */}
          <div className={isOwner ? 'lg:col-span-2' : ''}>
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
                <div className="flex items-center gap-2 mb-4">
                  <span className={`tag border ${catMeta.tag}`}>{tool.category}</span>
                  <span className={`tag border ${isAvailable ? 'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25' : 'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20'}`}>
                    {tool.status}
                  </span>
                </div>

                <h1 className="display text-3xl sm:text-4xl text-[#ede9e3] mb-2 leading-snug">
                  {tool.title}
                </h1>
                <p className="text-[#5a5751] text-sm mb-8">
                  Listed by <span className="text-[#a8a49c]">{tool.ownerName}</span> · Block {tool.ownerBlock}
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
          </div>

          {/* ── Owner panel ── */}
          {isOwner && (
            <div className="lg:col-span-1">
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
                    onClick={() => setIsEditing(!isEditing)}
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
                      <p className="text-[#5a5751] text-sm leading-relaxed">
                        This is your listing. Click <strong className="text-[#7d7a73]">Edit</strong> to update details, status, or the deposit rate.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
