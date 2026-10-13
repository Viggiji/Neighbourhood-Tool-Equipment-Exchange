import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, MapPin, Clock, ArrowUpRight,
  Hammer, Shovel, Wrench, MoreHorizontal
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Gardening', 'Ladders & Scaffolding', 'Other'];

const CATEGORY_META = {
  'Power Tools':          { color: 'text-[#e0a53c]', bg: 'bg-[#c88b30]/12', border: 'border-[#c88b30]/20', tagColor: 'text-[#f0c060] bg-[#c88b30]/12 border border-[#c88b30]/20' },
  'Hand Tools':           { color: 'text-[#8fba93]', bg: 'bg-[#4e7252]/12', border: 'border-[#4e7252]/20', tagColor: 'text-[#8fba93] bg-[#4e7252]/12 border border-[#4e7252]/20' },
  'Gardening':            { color: 'text-[#6a9870]', bg: 'bg-[#3d5a40]/12', border: 'border-[#3d5a40]/20', tagColor: 'text-[#6a9870] bg-[#3d5a40]/12 border border-[#3d5a40]/20' },
  'Ladders & Scaffolding':{ color: 'text-[#f08b6a]', bg: 'bg-[#d05a38]/12', border: 'border-[#d05a38]/20', tagColor: 'text-[#f08b6a] bg-[#d05a38]/12 border border-[#d05a38]/20' },
  'Other':                { color: 'text-[#a8a49c]', bg: 'bg-[#3d3b37]/30', border: 'border-[#3d3b37]',    tagColor: 'text-[#a8a49c] bg-[#3d3b37]/30 border border-[#3d3b37]' },
};

function timeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const dtStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = (Date.now() - new Date(dtStr).getTime()) / 1000;
  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState({ available: true, online: true });

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory) params.append('category', selectedCategory);
      if (statusFilter.available && !statusFilter.online) params.append('status', 'Available');
      else if (!statusFilter.available && statusFilter.online) params.append('status', 'Online');

      const res = await api.get(`/tools?${params.toString()}`);
      setTools(res.data.tools);
    } catch (err) {
      console.error('Failed to fetch tools:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, statusFilter]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const toggleStatus = (status) => setStatusFilter(prev => ({ ...prev, [status]: !prev[status] }));

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#5a5751] mb-2">
              <MapPin size={11} className="inline mr-1.5 text-[#d05a38]" />
              Block {user?.blockCode}
            </p>
            <h1 className="display text-3xl sm:text-4xl text-[#ede9e3]">
              Hi, {user?.fullName?.split(' ')[0] || 'neighbor'}.
            </h1>
          </div>
          <Link to="/tools/new" className="btn-primary self-start sm:self-auto">
            <Plus size={15} />
            List a tool
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-7">

          {/* ── Sidebar filters ── */}
          <div className="lg:w-52 xl:w-60 shrink-0">
            <div className="sticky top-20 rounded-xl bg-[#242220] border border-[#2f2d2a] p-5">
              <div className="flex items-center gap-2 text-[#a8a49c] font-semibold text-sm mb-5">
                <Filter size={14} /> Filters
              </div>

              {/* Status */}
              <div className="mb-6">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#5a5751] mb-3">Status</p>
                <div className="space-y-2">
                  {[
                    { key: 'available', label: 'Available' },
                    { key: 'online', label: 'Online' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <div className="relative">
                        <input type="checkbox" checked={statusFilter[key]} onChange={() => toggleStatus(key)} className="sr-only" />
                        <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                          statusFilter[key] ? 'bg-[#d05a38] border-[#d05a38]' : 'border-[#3d3b37] group-hover:border-[#5a5751]'
                        }`}>
                          {statusFilter[key] && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-[#7d7a73] group-hover:text-[#a8a49c] transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#5a5751] mb-3">Category</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                      selectedCategory === '' ? 'bg-[#2f2d2a] text-[#ede9e3] font-medium' : 'text-[#5a5751] hover:text-[#a8a49c] hover:bg-[#1a1917]'
                    }`}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-all truncate ${
                        selectedCategory === cat ? 'bg-[#2f2d2a] text-[#ede9e3] font-medium' : 'text-[#5a5751] hover:text-[#a8a49c] hover:bg-[#1a1917]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">

            {/* Search */}
            <div className="relative mb-6">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5751]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tool name, keyword..."
                className="w-full bg-[#242220] border border-[#2f2d2a] focus:border-[#d05a38] focus:ring-2 focus:ring-[#d05a38]/12 rounded-xl py-3 pl-11 pr-4 text-[#ede9e3] placeholder-[#5a5751] outline-none transition-all text-sm"
              />
              {loading && search && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#3d3b37] border-t-[#d05a38] rounded-full animate-spin" />
              )}
            </div>

            {/* Grid */}
            {loading && tools.length === 0 ? (
              <div className="flex justify-center py-24">
                <LoadingSpinner size="lg" text="Looking for tools on your block..." />
              </div>
            ) : tools.length === 0 ? (
              <div className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-16 text-center">
                <p className="text-[#5a5751] text-sm mb-2">No tools found</p>
                <p className="text-[#3d3b37] text-xs">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <motion.div
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
              >
                <AnimatePresence>
                  {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool }) {
  const meta = CATEGORY_META[tool.category] || CATEGORY_META['Other'];
  const isAvailable = tool.status === 'Available';

  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] overflow-hidden flex flex-col card-hover"
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
      layout
    >
      {/* Image or placeholder strip */}
      {tool.imageUrl ? (
        <div className="w-full h-40 overflow-hidden bg-[#1a1917]">
          <img src={tool.imageUrl} alt={tool.title} className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className={`w-full h-2 ${meta.bg}`} />
      )}

      <div className="p-5 flex-1 flex flex-col">
        {/* Category + status row */}
        <div className="flex items-center justify-between mb-3">
          <span className={`tag ${meta.tagColor}`}>{tool.category}</span>
          <span className={`tag ${isAvailable ? 'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25' : 'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20'}`}>
            {tool.status}
          </span>
        </div>

        {/* Title + description */}
        <h3 className="text-[#ede9e3] font-semibold text-base mb-1.5 leading-snug">
          {tool.title}
        </h3>
        <p className="text-[#5a5751] text-sm mb-4 line-clamp-2 leading-relaxed flex-1">
          {tool.description}
        </p>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-[#1a1917] border border-[#2f2d2a] px-3 py-2">
            <span className="text-[10px] text-[#5a5751] uppercase tracking-wide block mb-0.5">Condition</span>
            <span className="text-sm font-medium text-[#a8a49c] truncate block">{tool.condition}</span>
          </div>
          <div className="rounded-lg bg-[#1a1917] border border-[#2f2d2a] px-3 py-2">
            <span className="text-[10px] text-[#5a5751] uppercase tracking-wide block mb-0.5">Deposit</span>
            <span className="text-sm font-medium text-[#d05a38]">₹{tool.depositAmount}/day</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#2f2d2a]">
          <div className="text-[#3d3b37] text-xs space-y-0.5">
            {tool.ownerName && (
              <span className="block text-[#5a5751]">{tool.ownerName}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} /> {timeAgo(tool.createdAt)}
            </span>
          </div>
          <Link
            to={`/tools/${tool.id}`}
            className="flex items-center gap-1 text-[#d05a38] hover:text-[#f08b6a] text-xs font-semibold transition-colors"
          >
            View <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
