import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, MapPin, Clock, ArrowUpRight,
  Layers, Package, CalendarDays, CheckCircle2, AlertCircle,
  RotateCcw, Star, XCircle, ChevronDown, ChevronUp, Inbox, Hourglass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ReviewModal from '../components/ReviewModal';
import ReturnChecklistModal from '../components/ReturnChecklistModal';

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Gardening', 'Ladders & Scaffolding', 'Other'];

const CATEGORY_META = {
  'Power Tools':           { color: 'text-[#e0a53c]', bg: 'bg-[#c88b30]/12', border: 'border-[#c88b30]/20', tagColor: 'text-[#f0c060] bg-[#c88b30]/12 border border-[#c88b30]/20' },
  'Hand Tools':            { color: 'text-[#8fba93]', bg: 'bg-[#4e7252]/12', border: 'border-[#4e7252]/20', tagColor: 'text-[#8fba93] bg-[#4e7252]/12 border border-[#4e7252]/20' },
  'Gardening':             { color: 'text-[#6a9870]', bg: 'bg-[#3d5a40]/12', border: 'border-[#3d5a40]/20', tagColor: 'text-[#6a9870] bg-[#3d5a40]/12 border border-[#3d5a40]/20' },
  'Ladders & Scaffolding': { color: 'text-[#f08b6a]', bg: 'bg-[#d05a38]/12', border: 'border-[#d05a38]/20', tagColor: 'text-[#f08b6a] bg-[#d05a38]/12 border border-[#d05a38]/20' },
  'Other':                 { color: 'text-[#a8a49c]', bg: 'bg-[#3d3b37]/30', border: 'border-[#3d3b37]',    tagColor: 'text-[#a8a49c] bg-[#3d3b37]/30 border border-[#3d3b37]' },
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

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:          'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25',
    accepted:         'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25',
    rejected:         'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20',
    cancelled:        'text-[#5a5751] bg-[#3d3b37]/30 border-[#3d3b37]',
    active:           'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25',
    return_submitted: 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25',
    overdue:          'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20',
    returned:         'text-[#a8a49c] bg-[#3d3b37]/30 border-[#3d3b37]',
  };
  const labelMap = {
    return_submitted: 'Return Pending',
    returned: 'Completed',
  };
  return (
    <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${map[status] || map.returned}`}>
      {labelMap[status] || status}
    </span>
  );
}

// ── Tab: Browse all tools ─────────────────────────────────────
function BrowseTab() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState({ available: true, rented: false });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (selectedCategory) params.append('category', selectedCategory);

        const selectedStatuses = [];
        if (statusFilter.available) selectedStatuses.push('Available');
        if (statusFilter.rented) selectedStatuses.push('Rented');
        params.append('status', selectedStatuses.length > 0 ? selectedStatuses.join(',') : 'None');

        const res = await api.get(`/tools?${params.toString()}`);
        if (active) setTools(res.data.tools);
      } catch (err) {
        console.error('Failed to fetch tools:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [debouncedSearch, selectedCategory, statusFilter]);

  const toggleStatus = (status) => setStatusFilter(prev => ({ ...prev, [status]: !prev[status] }));

  return (
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
                { key: 'rented',    label: 'Rented' },
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
  );
}

// ── Tab: My Listings ──────────────────────────────────────────
function MyListingsTab() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/tools/my');
        if (active) setTools(res.data.tools);
      } catch (err) {
        console.error('Failed to fetch my tools:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" text="Loading your listings..." />
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <motion.div
        className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-16 text-center"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center mx-auto mb-5">
          <Package size={24} className="text-[#5a5751]" />
        </div>
        <h3 className="text-[#ede9e3] font-semibold text-lg mb-2">No listings yet</h3>
        <p className="text-[#5a5751] text-sm mb-6 max-w-xs mx-auto leading-relaxed">
          Share a tool with your neighbors. It takes under a minute.
        </p>
        <Link to="/tools/new" className="btn-primary inline-flex">
          <Plus size={15} /> List your first tool
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
    >
      {tools.map((tool) => (
        <MyToolCard key={tool.id} tool={tool} />
      ))}
    </motion.div>
  );
}

// ── Tab: My Rentals ───────────────────────────────────────────
function MyRentalsTab() {
  const [outgoing, setOutgoing]           = useState([]);
  const [rentals, setRentals]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [returnTarget, setReturnTarget]   = useState(null);
  const [reviewTarget, setReviewTarget]   = useState(null);
  const [showHistory, setShowHistory]     = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, rentalRes] = await Promise.all([
        api.get('/requests/outgoing'),
        api.get('/rentals/my'),
      ]);
      setOutgoing(reqRes.data.requests || []);
      setRentals(rentalRes.data.rentals || []);
    } catch (err) {
      console.error('Failed to fetch rentals:', err);
      toast.error('Could not load your rentals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [reqRes, rentalRes] = await Promise.all([
          api.get('/requests/outgoing'),
          api.get('/rentals/my'),
        ]);
        if (active) {
          setOutgoing(reqRes.data.requests || []);
          setRentals(rentalRes.data.rentals || []);
        }
      } catch (err) {
        console.error('Failed to fetch rentals:', err);
        if (active) toast.error('Could not load your rentals.');
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleCancel(requestId) {
    try {
      await api.patch(`/requests/${requestId}/cancel`);
      toast.success('Request cancelled.');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel request.');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" text="Loading your rentals..." />
      </div>
    );
  }

  const activeRentals    = rentals.filter(r => ['active', 'overdue', 'return_submitted'].includes(r.status));
  const pendingRequests  = outgoing.filter(r => r.status === 'pending');
  const completedRentals = rentals.filter(r => r.status === 'returned');
  const otherRequests    = outgoing.filter(r => ['rejected', 'cancelled', 'accepted'].includes(r.status));

  const hasAnything = activeRentals.length + pendingRequests.length + completedRentals.length + otherRequests.length > 0;

  if (!hasAnything) {
    return (
      <motion.div
        className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-16 text-center"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center mx-auto mb-5">
          <CalendarDays size={24} className="text-[#5a5751]" />
        </div>
        <h3 className="text-[#ede9e3] font-semibold text-lg mb-2">No rentals yet</h3>
        <p className="text-[#5a5751] text-sm max-w-xs mx-auto leading-relaxed">
          Browse tools on your block and send a borrow request to get started.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-8 max-w-2xl"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >

      {/* ── Active / Overdue / Return Submitted Rentals ── */}
      {activeRentals.length > 0 && (
        <section>
          <SectionHeading icon={<CheckCircle2 size={14} className="text-[#7db884]" />} label="Active Rentals" count={activeRentals.length} />
          <div className="space-y-3">
            {activeRentals.map(rental => (
              <RentalCard
                key={rental.id}
                rental={rental}
                onOpenReturn={() => setReturnTarget(rental)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Pending Requests ── */}
      {pendingRequests.length > 0 && (
        <section>
          <SectionHeading icon={<Inbox size={14} className="text-[#f0c060]" />} label="Pending Requests" count={pendingRequests.length} />
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <RequestCard key={req.id} request={req} onCancel={handleCancel} />
            ))}
          </div>
        </section>
      )}

      {/* ── Completed Rentals ── */}
      {completedRentals.length > 0 && (
        <section>
          <SectionHeading icon={<Star size={14} className="text-[#f0c060]" />} label="Completed" count={completedRentals.length} />
          <div className="space-y-3">
            {completedRentals.map(rental => (
              <CompletedRentalCard
                key={rental.id}
                rental={rental}
                onReview={() => setReviewTarget(rental)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Past Requests (collapsed) ── */}
      {otherRequests.length > 0 && (
        <section>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-[#5a5751] hover:text-[#7d7a73] text-sm transition-colors"
          >
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Past requests ({otherRequests.length})
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 mt-3">
                  {otherRequests.map(req => (
                    <RequestCard key={req.id} request={req} readOnly />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Return handback checklist modal */}
      <ReturnChecklistModal
        rental={returnTarget}
        isOpen={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        onSuccess={fetchAll}
      />

      {/* Review modal */}
      <ReviewModal
        rental={reviewTarget}
        role="borrower"
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSuccess={fetchAll}
      />
    </motion.div>
  );
}

// ── Section heading helper ────────────────────────────────────
function SectionHeading({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="text-sm font-semibold text-[#a8a49c] uppercase tracking-wider">{label}</h3>
      <span className="text-xs text-[#5a5751] bg-[#2f2d2a] px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );
}

// ── Active rental card ────────────────────────────────────────
function RentalCard({ rental, onOpenReturn }) {
  const isOverdue = rental.status === 'overdue';
  const isSubmitted = rental.status === 'return_submitted';

  return (
    <motion.div
      className={`rounded-xl bg-[#242220] border p-5 ${
        isOverdue ? 'border-[#c0392b]/35' : isSubmitted ? 'border-[#c88b30]/30' : 'border-[#2f2d2a]'
      }`}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {isOverdue && (
        <div className="flex items-center gap-1.5 text-[#e05040] text-xs font-semibold mb-3 pb-3 border-b border-[#c0392b]/20">
          <AlertCircle size={12} /> Overdue — please complete the return checklist and return immediately
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {rental.tools?.image_url ? (
            <img src={rental.tools.image_url} alt={rental.tools.title} className="w-10 h-10 rounded-lg object-cover border border-[#3d3b37] shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
              <Package size={15} className="text-[#5a5751]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[#ede9e3] font-semibold text-sm truncate">{rental.tools?.title}</p>
            <p className="text-[#5a5751] text-xs">
              Owner: {rental.owner?.full_name} · Pickup/Return: Block {rental.owner?.block_code}
            </p>
          </div>
        </div>
        <StatusBadge status={rental.status} />
      </div>

      <div className="flex items-center justify-between gap-4 mb-4 text-xs text-[#7d7a73]">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-[#5a5751]" />
          {formatDate(rental.start_date)} → Due {formatDate(rental.due_date)}
        </div>
      </div>

      {isSubmitted ? (
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-[#c88b30]/10 border border-[#c88b30]/20 text-[#f0c060] text-xs font-medium">
          <Hourglass size={13} className="shrink-0" />
          Return checklist submitted — waiting for {rental.owner?.full_name} to confirm handback.
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenReturn}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                     bg-[#4a8c55]/12 hover:bg-[#4a8c55]/22 border border-[#4a8c55]/25 hover:border-[#4a8c55]/45
                     text-[#7db884] text-sm font-semibold transition-all"
        >
          <RotateCcw size={14} />
          Return Tool
        </motion.button>
      )}
    </motion.div>
  );
}

// ── Pending request card ──────────────────────────────────────
function RequestCard({ request, onCancel, readOnly }) {
  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-5"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
            <Package size={15} className="text-[#5a5751]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#ede9e3] font-semibold text-sm truncate">{request.tools?.title}</p>
            <p className="text-[#5a5751] text-xs">from {request.owner?.full_name} · Block {request.owner?.block_code}</p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="flex items-center gap-4 text-xs text-[#7d7a73] mb-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-[#5a5751]" />
          {formatDate(request.start_date)} → {formatDate(request.end_date)}
        </div>
        <span className="text-[#3d3b37] flex items-center gap-1 ml-auto">
          <Clock size={10} /> {timeAgo(request.created_at)}
        </span>
      </div>
      {!readOnly && request.status === 'pending' && (
        <button
          onClick={() => onCancel(request.id)}
          className="flex items-center gap-1.5 text-[#5a5751] hover:text-[#e05040] text-xs font-medium transition-colors"
        >
          <XCircle size={12} /> Cancel request
        </button>
      )}
    </motion.div>
  );
}

// ── Completed rental card (with review CTA) ───────────────────
function CompletedRentalCard({ rental, onReview }) {
  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] p-5"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#2f2d2a] border border-[#3d3b37] flex items-center justify-center shrink-0">
            <Package size={15} className="text-[#5a5751]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#ede9e3] font-semibold text-sm truncate">{rental.tools?.title}</p>
            <p className="text-[#5a5751] text-xs">from {rental.owner?.full_name}</p>
          </div>
        </div>
        <StatusBadge status={rental.status} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#2f2d2a]">
        <span className="text-[#5a5751] text-xs">
          Completed {rental.returned_at ? timeAgo(rental.returned_at) : ''}
        </span>
        {rental.hasReview ? (
          <span className="flex items-center gap-1 text-[#f0c060] text-xs">
            <Star size={11} className="fill-[#f0c060]" /> Reviewed
          </span>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReview}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#f0c060] hover:text-[#f5d080] transition-colors"
          >
            <Star size={11} /> Rate Your Experience
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = ['browse', 'my', 'rentals'].includes(tabParam) ? tabParam : 'browse';

  const setActiveTab = (id) => {
    setSearchParams(id === 'browse' ? {} : { tab: id });
  };

  const tabs = [
    { id: 'browse',   label: 'Browse block',  icon: Layers },
    { id: 'my',       label: 'My listings',   icon: Package },
    { id: 'rentals',  label: 'My rentals',    icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
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

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-[#2f2d2a]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === id
                  ? 'text-[#ede9e3]'
                  : 'text-[#5a5751] hover:text-[#a8a49c]'
              }`}
            >
              <Icon size={14} />
              {label}
              {activeTab === id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px bg-[#d05a38]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'browse'  && <BrowseTab />}
            {activeTab === 'my'      && <MyListingsTab />}
            {activeTab === 'rentals' && <MyRentalsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Browse tool card ──────────────────────────────────────────
function ToolCard({ tool }) {
  const meta = CATEGORY_META[tool.category] || CATEGORY_META['Other'];
  const isAvailable = tool.status === 'Available';

  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] overflow-hidden flex flex-col card-hover"
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
      layout
    >
      {tool.imageUrl ? (
        <div className="w-full h-40 overflow-hidden bg-[#1a1917]">
          <img src={tool.imageUrl} alt={tool.title} className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className={`w-full h-2 ${meta.bg}`} />
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={`tag ${meta.tagColor}`}>{tool.category}</span>
          <span className={`tag ${isAvailable ? 'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25' : 'text-[#f0c060] bg-[#c88b30]/12 border-[#c88b30]/25'}`}>
            {tool.status}
          </span>
        </div>

        <h3 className="text-[#ede9e3] font-semibold text-base mb-1.5 leading-snug">
          {tool.title}
        </h3>
        <p className="text-[#5a5751] text-sm mb-4 line-clamp-2 leading-relaxed flex-1">
          {tool.description}
        </p>

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

// ── My listing card ───────────────────────────────────────────
function MyToolCard({ tool }) {
  const meta = CATEGORY_META[tool.category] || CATEGORY_META['Other'];
  const isAvailable = tool.status === 'Available';

  return (
    <motion.div
      className="rounded-xl bg-[#242220] border border-[#2f2d2a] overflow-hidden flex flex-col card-hover"
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
      layout
    >
      {tool.imageUrl ? (
        <div className="w-full h-36 overflow-hidden bg-[#1a1917]">
          <img src={tool.imageUrl} alt={tool.title} className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className={`w-full h-2 ${meta.bg}`} />
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={`tag ${meta.tagColor}`}>{tool.category}</span>
          <span className={`tag ${isAvailable ? 'text-[#7db884] bg-[#4a8c55]/12 border-[#4a8c55]/25' : 'text-[#e05040] bg-[#c0392b]/10 border-[#c0392b]/20'}`}>
            {tool.status}
          </span>
        </div>

        <h3 className="text-[#ede9e3] font-semibold text-base mb-1.5 leading-snug">{tool.title}</h3>
        <p className="text-[#5a5751] text-sm mb-4 line-clamp-2 leading-relaxed flex-1">{tool.description}</p>

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

        <div className="flex items-center justify-between pt-3 border-t border-[#2f2d2a]">
          <span className="text-[#3d3b37] text-xs flex items-center gap-1">
            <Clock size={10} /> {timeAgo(tool.createdAt)}
          </span>
          <Link
            to={`/tools/${tool.id}`}
            className="flex items-center gap-1 text-[#d05a38] hover:text-[#f08b6a] text-xs font-semibold transition-colors"
          >
            Manage <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
