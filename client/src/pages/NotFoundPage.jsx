import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Hammer } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 pt-14">
      <div className="text-center max-w-md mx-auto">

        {/* Animated number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8"
        >
          <span
            className="text-[160px] sm:text-[200px] font-bold leading-none select-none tabular-nums"
            style={{
              color: 'transparent',
              WebkitTextStroke: '1px #2f2d2a',
            }}
          >
            404
          </span>
          {/* Icon centered over number */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-[#242220] border border-[#2f2d2a] flex items-center justify-center shadow-2xl">
              <Hammer size={28} className="text-[#d05a38]" />
            </div>
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#d05a38] mb-4">
            Page not found
          </p>
          <h1 className="display text-3xl sm:text-4xl text-[#ede9e3] mb-3 leading-snug">
            This tool&apos;s not on the block.
          </h1>
          <p className="text-[#5a5751] text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            The page you're looking for doesn't exist, was moved, or you may have followed a broken link.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="btn-primary px-6 py-3">
              <ArrowLeft size={15} />
              Back to home
            </Link>
            <Link to="/dashboard" className="btn-ghost px-6 py-3 text-sm">
              Browse tools
            </Link>
          </div>
        </motion.div>

        {/* Subtle grid decoration */}
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(#ede9e3 1px, transparent 1px), linear-gradient(90deg, #ede9e3 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
