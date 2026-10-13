import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, MapPin, ArrowRight, CheckCircle, Eye, EyeOff, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import AnimatedFormField from '../components/ui/AnimatedFormField';

function PasswordStrength({ password }) {
  const score = !password ? 0
    : password.length < 6 ? 1
    : password.length < 8 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10 ? 4
    : password.length >= 8 ? 3
    : 2;

  const labels = ['', 'Too short', 'Weak', 'Fair', 'Strong'];
  const colors = ['', 'bg-[#e05040]', 'bg-[#c88b30]', 'bg-[#e0a53c]', 'bg-[#4a8c55]'];
  const textColors = ['', 'text-[#e05040]', 'text-[#c88b30]', 'text-[#e0a53c]', 'text-[#7db884]'];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="space-y-1.5"
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-[#2f2d2a]'
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] ${textColors[score]}`}>{labels[score]}</p>
    </motion.div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', blockCode: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Please provide your full name.';
    else if (formData.fullName.trim().length < 2) newErrors.fullName = 'Name should be at least 2 characters.';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) newErrors.email = 'An email address is required.';
    else if (!emailRegex.test(formData.email)) newErrors.email = 'Please use a valid email address.';

    if (!formData.password) newErrors.password = 'Choose a password.';
    else if (formData.password.length < 8) newErrors.password = 'At least 8 characters required.';

    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!formData.blockCode.trim()) newErrors.blockCode = 'Block code is required.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        blockCode: formData.blockCode,
      });
      setSuccess(true);
      toast.success(res.data.message);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      if (msg.includes('already registered')) setErrors((prev) => ({ ...prev, email: msg }));
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success Screen ──────────────────────────────────────
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
          <h2 className="display text-3xl text-[#ede9e3] mb-3">You're in.</h2>
          <p className="text-[#7d7a73] text-sm leading-relaxed mb-7">
            A verification email was sent to{' '}
            <span className="text-[#f08b6a] font-medium">{formData.email}</span>.
            Check your inbox to activate your account.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full justify-center py-3"
          >
            Go to sign in <ArrowRight size={15} />
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Register Form ──────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-5 pt-20 pb-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#d05a38] mb-4">Create account</p>
          <h1 className="display text-4xl text-[#ede9e3] mb-3">Join your block</h1>
          <p className="text-[#7d7a73] text-sm">
            Start sharing and borrowing tools with neighbors in minutes.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="rounded-2xl bg-[#242220] border border-[#2f2d2a] p-7 sm:p-8"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">

            <AnimatedFormField
              id="reg-fullName" label="Full name"
              value={formData.fullName} onChange={handleChange('fullName')}
              placeholder="e.g. Priya Sharma" error={errors.fullName}
              icon={User} required
            />

            <AnimatedFormField
              id="reg-email" label="Email address" type="email"
              value={formData.email} onChange={handleChange('email')}
              placeholder="you@example.com" error={errors.email}
              icon={Mail} required
            />

            {/* Password with toggle + strength */}
            <div className="space-y-2">
              <label htmlFor="reg-password" className="block text-sm font-medium text-[#a8a49c]">
                Password <span className="text-[#d05a38] ml-0.5">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751] pointer-events-none">
                  <Lock size={16} />
                </div>
                <input
                  id="reg-password" type={showPassword ? 'text' : 'password'}
                  value={formData.password} onChange={handleChange('password')}
                  placeholder="At least 8 characters"
                  className={`input-field input-icon-left input-icon-right ${errors.password ? 'error' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5751] hover:text-[#a8a49c] transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {errors.password && (
                  <motion.p key="err" initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-[#e05040] text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#e05040] inline-block" />{errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
              <PasswordStrength password={formData.password} />
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <label htmlFor="reg-confirmPassword" className="block text-sm font-medium text-[#a8a49c]">
                Confirm password <span className="text-[#d05a38] ml-0.5">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751] pointer-events-none">
                  <Lock size={16} />
                </div>
                <input
                  id="reg-confirmPassword" type={showConfirm ? 'text' : 'password'}
                  value={formData.confirmPassword} onChange={handleChange('confirmPassword')}
                  placeholder="Type it again"
                  className={`input-field input-icon-left input-icon-right ${errors.confirmPassword ? 'error' : ''}`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5751] hover:text-[#a8a49c] transition-colors">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {errors.confirmPassword && (
                  <motion.p key="err" initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-[#e05040] text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#e05040] inline-block" />{errors.confirmPassword}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Block code */}
            <div>
              <AnimatedFormField
                id="reg-blockCode" label="Block code"
                value={formData.blockCode} onChange={handleChange('blockCode')}
                placeholder="e.g. ELM-STREET-42" error={errors.blockCode}
                icon={MapPin} required
              />
              <p className="text-[#5a5751] text-xs mt-2 flex items-start gap-1.5 pl-0.5">
                <Info size={11} className="mt-0.5 shrink-0" />
                Provided by your neighborhood ambassador or block captain.
              </p>
            </div>

            <button
              type="submit" disabled={isLoading}
              className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>Create account <ArrowRight size={15} /></>
              )}
            </button>

            <p className="text-center text-[#5a5751] text-sm pt-1">
              Already have an account?{' '}
              <Link to="/login" className="text-[#f08b6a] hover:text-[#d05a38] font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
