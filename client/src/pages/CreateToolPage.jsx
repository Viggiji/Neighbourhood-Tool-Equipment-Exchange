import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Activity, Zap, Layers, ArrowRight, CheckCircle, Info, Hammer, UploadCloud, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import AnimatedFormField from '../components/ui/AnimatedFormField';

const CATEGORIES = [
  'Power Tools', 'Hand Tools', 'Gardening', 'Ladders & Scaffolding', 'Other',
];

const CATEGORY_META = {
  'Power Tools':          { tag: 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25' },
  'Hand Tools':           { tag: 'text-[#8fba93] bg-[#4e7252]/12 border-[#4e7252]/25' },
  'Gardening':            { tag: 'text-[#6a9870] bg-[#3d5a40]/12 border-[#3d5a40]/25' },
  'Ladders & Scaffolding':{ tag: 'text-[#f08b6a] bg-[#d05a38]/12 border-[#d05a38]/25' },
  'Other':                { tag: 'text-[#a8a49c] bg-[#3d3b37]/30 border-[#3d3b37]' },
};

export default function CreateToolPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ title: '', category: '', description: '', condition: '', depositAmount: '' });
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => { setCharCount(formData.description.length); }, [formData.description]);

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Tool name is required.';
    else if (formData.title.trim().length < 3) newErrors.title = 'Name should be at least 3 characters.';
    if (!formData.category) newErrors.category = 'Select a category.';
    if (!formData.description.trim()) newErrors.description = 'Describe the tool.';
    else if (formData.description.trim().length < 10) newErrors.description = 'At least 10 characters.';
    if (!formData.condition.trim()) newErrors.condition = 'Specify condition.';
    if (formData.depositAmount === '') newErrors.depositAmount = 'Specify deposit amount.';
    else if (isNaN(Number(formData.depositAmount)) || Number(formData.depositAmount) < 0) newErrors.depositAmount = 'Must be zero or greater.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the highlighted fields.'); return; }

    setIsLoading(true);
    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('category', formData.category);
      payload.append('description', formData.description);
      payload.append('condition', formData.condition);
      payload.append('depositAmount', Number(formData.depositAmount));
      if (file) payload.append('image', file);

      const res = await api.post('/tools', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(true);
      toast.success(res.data.message);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
        if (data.errors.image) toast.error(data.errors.image);
      } else {
        toast.error(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success ──────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 pt-20">
        <motion.div
          className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-10 max-w-md w-full text-center"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#4a8c55]/15 border border-[#4a8c55]/25 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#7db884]" />
          </div>
          <h2 className="display text-3xl text-[#ede9e3] mb-3">Tool listed.</h2>
          <p className="text-[#7d7a73] text-sm leading-relaxed mb-7">
            <span className="text-[#ede9e3] font-medium">{formData.title}</span> is now visible to your neighbors.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setSuccess(false); setFormData({ title: '', category: '', description: '', condition: '', depositAmount: '' }); setFile(null); }}
              className="btn-ghost flex-1 justify-center py-3 text-sm"
            >
              List another
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary flex-1 justify-center py-3 text-sm"
            >
              Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const charError = charCount > 1000;

  return (
    <div className="min-h-screen px-5 sm:px-8 pt-14 pb-16">
      <div className="max-w-4xl mx-auto pt-10">

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#d05a38] mb-3">New listing</p>
          <h1 className="display text-4xl text-[#ede9e3] mb-2">List a tool</h1>
          <p className="text-[#7d7a73] text-sm">Share what you've got with the block. Takes under a minute.</p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-7 sm:p-8"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left column */}
            <div className="space-y-5">
              <AnimatedFormField
                id="tool-title" label="Tool name"
                value={formData.title} onChange={handleChange('title')}
                placeholder='e.g. "Makita 18V Cordless Drill"'
                error={errors.title} icon={Tag} required
              />

              {/* Category picker */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#a8a49c]">
                  Category <span className="text-[#d05a38] ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((cat) => {
                    const isSelected = formData.category === cat;
                    const meta = CATEGORY_META[cat];
                    return (
                      <button
                        type="button" key={cat}
                        onClick={() => handleChange('category')({ target: { value: cat } })}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all text-left ${
                          isSelected
                            ? `${meta.tag} border`
                            : 'border-[#2f2d2a] text-[#5a5751] hover:text-[#a8a49c] hover:border-[#3d3b37] bg-transparent'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {errors.category && (
                    <motion.p key="cat-err" initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      className="text-[#e05040] text-xs flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#e05040] inline-block" />{errors.category}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="tool-description" className="block text-sm font-medium text-[#a8a49c]">
                  Description <span className="text-[#d05a38] ml-0.5">*</span>
                </label>
                <textarea
                  id="tool-description" value={formData.description}
                  onChange={handleChange('description')}
                  placeholder="Detail the tool's capabilities and any included accessories..."
                  rows={4}
                  className={`input-field resize-none ${errors.description ? 'error' : ''}`}
                />
                <div className="flex items-center justify-between">
                  <AnimatePresence mode="wait">
                    {errors.description && (
                      <motion.p key="desc-err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-[#e05040] text-xs flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[#e05040] inline-block" />{errors.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <span className={`text-[11px] ml-auto tabular-nums ${charError ? 'text-[#e05040]' : 'text-[#3d3b37]'}`}>{charCount}/1000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AnimatedFormField
                  id="tool-condition" label="Condition"
                  value={formData.condition} onChange={handleChange('condition')}
                  placeholder="Good, Like New..." error={errors.condition} icon={Activity} required
                />
                <AnimatedFormField
                  id="tool-deposit" label="Deposit (₹/day)" type="number"
                  value={formData.depositAmount} onChange={handleChange('depositAmount')}
                  placeholder="0" error={errors.depositAmount} icon={Zap} required
                />
              </div>
            </div>

            {/* Right column — upload zone */}
            <div className="space-y-2 flex flex-col">
              <label className="block text-sm font-medium text-[#a8a49c]">Photo (optional)</label>
              <div
                className={`flex-1 min-h-[300px] relative rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer ${
                  dragActive
                    ? 'border-[#d05a38] bg-[#d05a38]/5'
                    : 'border-[#2f2d2a] hover:border-[#3d3b37] hover:bg-[#1a1917]/50'
                }`}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation(); setDragActive(false);
                  if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file" accept="image/jpeg, image/png"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                />

                {file ? (
                  <div className="relative w-full flex flex-col items-center">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-52 object-contain rounded-lg mb-4" />
                    <p className="text-[#a8a49c] font-medium text-sm truncate max-w-[80%]">{file.name}</p>
                    <p className="text-[#5a5751] text-xs mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setFile(null); }}
                      className="absolute top-0 right-0 p-1.5 bg-[#1a1917] text-[#7d7a73] hover:text-[#e05040] rounded-lg transition-colors z-10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#2f2d2a] flex items-center justify-center mb-4">
                      <UploadCloud size={22} className="text-[#5a5751]" />
                    </div>
                    <p className="text-[#7d7a73] text-sm font-medium mb-1">Drop photo here</p>
                    <p className="text-[#3d3b37] text-xs">JPEG or PNG, up to 5 MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-7 pt-6 border-t border-[#2f2d2a]">
            <button
              type="submit" disabled={isLoading}
              className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>Publish listing <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
