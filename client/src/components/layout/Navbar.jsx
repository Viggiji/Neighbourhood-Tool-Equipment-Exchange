import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, LogOut, Plus, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          <Link to="/" className="flex items-center gap-2.5 group">
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
                  <LayoutDashboard size={14} />
                  Dashboard
                </NavLink>
                <NavLink to="/tools/new" active={location.pathname === '/tools/new'}>
                  <Plus size={14} />
                  List a Tool
                </NavLink>

                <div className="w-px h-4 bg-[#3d3b37] mx-2" />

                <div className="flex items-center gap-2">
                  {/* Avatar + name */}
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

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-[#7d7a73] hover:text-[#ede9e3] hover:bg-[#242220] transition-colors"
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
                    <div>
                      <p className="text-sm font-semibold text-[#ede9e3]">{user?.fullName}</p>
                      <p className="text-xs text-[#5a5751]">Block {user?.blockCode}</p>
                    </div>
                  </div>

                  <MobileLink to="/dashboard" active={location.pathname === '/dashboard'} icon={LayoutDashboard}>
                    Dashboard
                  </MobileLink>
                  <MobileLink to="/tools/new" active={location.pathname === '/tools/new'} icon={Plus}>
                    List a Tool
                  </MobileLink>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-[#e05040] hover:bg-[#2f2d2a] text-sm flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <MobileLink to="/login" active={location.pathname === '/login'}>Sign in</MobileLink>
                  <MobileLink to="/register" active={location.pathname === '/register'}>Join the block</MobileLink>
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

function MobileLink({ to, children, active, icon: Icon }) {
  return (
    <Link
      to={to}
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
