import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AnimatedFormField from '../components/ui/AnimatedFormField';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lockout, setLockout] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Enter your email address.';
    if (!formData.password) newErrors.password = 'Enter your password.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    const value = field === 'rememberMe' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (lockout) setLockout(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });
      login(res.data.user);
      toast.success(res.data.message);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message || 'Something went wrong. Please try again.';
      if (data?.locked || data?.attemptsExhausted) {
        setLockout({
          message: data.attemptsExhausted
            ? 'Too many failed attempts. Account is temporarily locked.'
            : msg,
        });
      } else if (data?.remainingAttempts !== undefined) {
        setLockout({
          message: `${msg} — ${data.remainingAttempts} attempt${data.remainingAttempts !== 1 ? 's' : ''} remaining`,
          isWarning: true,
        });
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 pt-20 pb-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#d05a38] mb-4">Welcome back</p>
          <h1 className="display text-4xl text-[#ede9e3] mb-3">Sign in to NTEE</h1>
          <p className="text-[#7d7a73] text-sm leading-relaxed">
            Access your block's tool listings and borrowing history.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-7 sm:p-8"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Lockout banner */}
            <AnimatePresence mode="wait">
              {lockout && (
                <motion.div
                  key="lockout"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className={`rounded-xl p-3.5 flex items-start gap-3 ${
                    lockout.isWarning
                      ? 'bg-[#c88b30]/10 border border-[#c88b30]/25'
                      : 'bg-[#e05040]/10 border border-[#e05040]/25'
                  }`}
                >
                  <AlertTriangle
                    size={15}
                    className={`mt-0.5 shrink-0 ${lockout.isWarning ? 'text-[#e0a53c]' : 'text-[#e05040]'}`}
                  />
                  <p className={`text-sm leading-snug ${lockout.isWarning ? 'text-[#f0c060]/80' : 'text-[#e05040]/80'}`}>
                    {lockout.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatedFormField
              id="login-email"
              label="Email address"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="you@example.com"
              error={errors.email}
              icon={Mail}
              required
            />

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-[#a8a49c]">
                Password <span className="text-[#d05a38] ml-0.5">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751] pointer-events-none">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange('password')}
                  placeholder="Your password"
                  className={`input-field input-icon-left input-icon-right ${errors.password ? 'error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5751] hover:text-[#a8a49c] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {errors.password && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-[#e05040] text-xs flex items-center gap-1.5"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#e05040] inline-block" />
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange('rememberMe')}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                    formData.rememberMe
                      ? 'bg-[#d05a38] border-[#d05a38]'
                      : 'bg-transparent border-[#3d3b37] group-hover:border-[#5a5751]'
                  }`}
                >
                  {formData.rememberMe && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-[#7d7a73] group-hover:text-[#a8a49c] transition-colors">
                Stay signed in for 30 days
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || (lockout && !lockout.isWarning)}
              className="btn-primary w-full py-3 justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <motion.div
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>

            <p className="text-center text-[#5a5751] text-sm pt-1">
              No account yet?{' '}
              <Link to="/register" className="text-[#f08b6a] hover:text-[#d05a38] font-medium transition-colors">
                Join the neighborhood
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
