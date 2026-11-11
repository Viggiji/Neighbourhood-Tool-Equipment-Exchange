import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, LogOut, Plus, LayoutDashboard, Menu, X,
  Bell, Inbox, CheckCheck, Circle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../lib/api';

// ── Relative time helper ──────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const dtStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = (Date.now() - new Date(dtStr).getTime()) / 1000;
  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Notification type → accent color ─────────────────────────
function notifAccent(type) {
  if (!type) return 'bg-[#5a5751]';
  if (type.includes('ACCEPTED')) return 'bg-[#4a8c55]';
  if (type.includes('REQUESTED') || type.includes('RETURN_SUBMITTED')) return 'bg-[#d05a38]';
  if (type.includes('REJECTED') || type.includes('OVERDUE')) return 'bg-[#c0392b]';
  if (type.includes('RETURNED')) return 'bg-[#6a9870]';
  if (type.includes('REVIEW')) return 'bg-[#c88b30]';
  return 'bg-[#5a5751]';
}

// ── Notification destination path ─────────────────────────────
function notifRoute(type) {
  if (!type) return '/dashboard';
  if (type === 'BOOKING_REQUESTED' || type === 'BOOKING_RETURN_SUBMITTED') return '/owner';
  if (type.includes('BOOKING_') || type === 'OVERDUE_DETECTED') return '/dashboard?tab=rentals';
  return '/dashboard';
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showNotifs, setShowNotifs]       = useState(false);
  const [markingRead, setMarkingRead]     = useState(false);
  const desktopNotifRef = useRef(null);
  const mobileNotifRef  = useRef(null);

  const closeMenus = useCallback(() => {
    setMobileOpen(false);
    setShowNotifs(false);
  }, []);

  // Scroll shadow
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const fetchNotifs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Silently fail — don't disrupt UX
    }
  }, [isAuthenticated]);

  // Poll notifications every 30s
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const load = async () => {
      try {
        const res = await api.get('/notifications');
        if (active) {
          setNotifications(res.data.notifications || []);
          setUnreadCount(res.data.unreadCount || 0);
        }
      } catch {
        // Silently fail
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showNotifs) return;
    function handleClick(e) {
      const inDesktop = desktopNotifRef.current?.contains(e.target);
      const inMobile  = mobileNotifRef.current?.contains(e.target);
      if (!inDesktop && !inMobile) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifs]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  function toggleNotifs() {
    const next = !showNotifs;
    setShowNotifs(next);
    if (next) fetchNotifs();
  }

  async function markAllRead() {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingRead(false);
    }
  }

  function handleNotifClick(notif) {
    if (!notif.is_read) {
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      api.patch(`/notifications/${notif.id}/read`).catch(() => {});
    }
    setShowNotifs(false);
    navigate(notifRoute(notif.type));
  }

  const bellPanel = (
    <AnimatePresence>
      {showNotifs && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#1e1c1a] border border-[#2f2d2a]
                     rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50"
        >
          {/* Dropdown header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2f2d2a]">
            <span className="text-[#ede9e3] text-sm font-semibold flex items-center gap-2">
              <Bell size={13} className="text-[#d05a38]" /> Notifications
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-[#d05a38]/15 text-[#f08b6a] border border-[#d05a38]/25 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingRead}
                className="flex items-center gap-1 text-[10px] text-[#5a5751] hover:text-[#a8a49c] transition-colors disabled:opacity-50"
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={20} className="text-[#3d3b37] mx-auto mb-2" />
                <p className="text-[#5a5751] text-sm">All caught up!</p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <motion.button
                  key={n.id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3.5 border-b border-[#2f2d2a]/60 last:border-0
                              transition-colors ${n.is_read ? 'hover:bg-[#1a1917]' : 'bg-[#242220] hover:bg-[#2a2826]'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${notifAccent(n.type)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-snug ${n.is_read ? 'text-[#7d7a73]' : 'text-[#ede9e3]'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-[#5a5751] shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${n.is_read ? 'text-[#5a5751]' : 'text-[#a8a49c]'}`}>
                        {n.body}
                      </p>
                    </div>
                    {!n.is_read && (
                      <Circle size={6} className="text-[#d05a38] fill-[#d05a38] shrink-0 mt-1.5" />
                    )}
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#1a1917]/90 backdrop-blur-md border-b border-[#2f2d2a]'
          : 'bg-transparent border-b border-transparent'
      }`}
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to="/" onClick={closeMenus} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#d05a38] flex items-center justify-center">
              <Wrench size={15} className="text-white" />
            </div>
            <div>
              <span
                className="text-base font-bold tracking-tight text-[#ede9e3]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                NTEE
              </span>
              <span className="hidden sm:block text-[10px] text-[#5a5751] leading-none tracking-widest uppercase mt-0.5">
                Tool Exchange
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>
                  <LayoutDashboard size={14} /> Dashboard
                </NavLink>
                <NavLink to="/owner" active={location.pathname === '/owner'}>
                  <Inbox size={14} /> Owner Inbox
                </NavLink>
                <NavLink to="/tools/new" active={location.pathname === '/tools/new'}>
                  <Plus size={14} /> List a Tool
                </NavLink>

                <div className="w-px h-4 bg-[#3d3b37] mx-2" />

                {/* ── Notification Bell ── */}
                <div className="relative" ref={desktopNotifRef}>
                  <button
                    type="button"
                    aria-label="Notifications"
                    onClick={toggleNotifs}
                    className="relative p-2 rounded-lg text-[#7d7a73] hover:text-[#ccc9c2] hover:bg-[#242220] transition-all"
                    title="Notifications"
                  >
                    <Bell size={16} />
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span
                          key={unreadCount}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#d05a38] text-white
                                     text-[9px] font-bold flex items-center justify-center leading-none"
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                  {bellPanel}
                </div>

                {/* Avatar + name + logout */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242220] border border-[#2f2d2a]">
                    <div className="w-6 h-6 rounded-md bg-[#d05a38] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#ccc9c2] leading-tight">{user?.fullName?.split(' ')[0]}</p>
                      <p className="text-[10px] text-[#5a5751] leading-tight">Block {user?.blockCode}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    aria-label="Sign out"
                    className="p-1.5 rounded-lg text-[#5a5751] hover:text-[#e05040] hover:bg-[#2f2d2a] transition-all"
                    title="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" active={location.pathname === '/login'}>Sign in</NavLink>
                <Link to="/register" className="btn-primary ml-1 text-sm py-2 px-4">
                  Join the block
                </Link>
              </>
            )}
          </div>

          {/* Mobile Actions (Bell + Hamburger) */}
          <div className="md:hidden flex items-center gap-1">
            {isAuthenticated && (
              <div className="relative" ref={mobileNotifRef}>
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={toggleNotifs}
                  className="relative p-2 rounded-lg text-[#7d7a73] hover:text-[#ede9e3] hover:bg-[#242220] transition-colors"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#d05a38] text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {bellPanel}
              </div>
            )}

            <button
              aria-label="Toggle menu"
              className="p-2 rounded-lg text-[#7d7a73] hover:text-[#ede9e3] hover:bg-[#242220] transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mobileOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden bg-[#1a1917] border-t border-[#2f2d2a]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-5 py-4 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2.5 px-3 py-3 mb-3 rounded-lg bg-[#242220] border border-[#2f2d2a]">
                    <div className="w-8 h-8 rounded-lg bg-[#d05a38] flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#ede9e3]">{user?.fullName}</p>
                      <p className="text-xs text-[#5a5751]">Block {user?.blockCode}</p>
                    </div>
                  </div>

                  <MobileLink to="/dashboard" onClick={closeMenus} active={location.pathname === '/dashboard'} icon={LayoutDashboard}>
                    Dashboard
                  </MobileLink>
                  <MobileLink to="/owner" onClick={closeMenus} active={location.pathname === '/owner'} icon={Inbox}>
                    Owner Inbox
                  </MobileLink>
                  <MobileLink to="/tools/new" onClick={closeMenus} active={location.pathname === '/tools/new'} icon={Plus}>
                    List a Tool
                  </MobileLink>
                  <button
                    onClick={() => { closeMenus(); handleLogout(); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-[#e05040] hover:bg-[#2f2d2a] text-sm flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <MobileLink to="/login" onClick={closeMenus} active={location.pathname === '/login'}>Sign in</MobileLink>
                  <MobileLink to="/register" onClick={closeMenus} active={location.pathname === '/register'}>Join the block</MobileLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function NavLink({ to, children, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-[#ede9e3] bg-[#242220]'
          : 'text-[#7d7a73] hover:text-[#ccc9c2] hover:bg-[#1a1917]'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileLink({ to, children, active, icon: Icon, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'text-[#ede9e3] bg-[#242220] border border-[#3d3b37]'
          : 'text-[#7d7a73] hover:text-[#ccc9c2] hover:bg-[#242220]'
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </Link>
  );
}
