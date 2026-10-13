import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Hammer, Users, ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen pt-14 overflow-hidden">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-5 py-32 sm:py-44">

        {/* Horizontal rule above eyebrow */}
        <motion.div
          className="w-10 h-px bg-[#d05a38] mb-8 mx-auto"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />

        {/* Eyebrow label */}
        <motion.p
          className="text-xs font-semibold tracking-[0.2em] uppercase text-[#d05a38] mb-6"
          initial="hidden" animate="show" custom={0.2} variants={fadeUp}
        >
          Neighborhood Tool &amp; Equipment Exchange
        </motion.p>

        {/* Main headline — use serif for warmth and character */}
        <motion.h1
          className="display text-5xl sm:text-6xl lg:text-7xl text-[#ede9e3] mb-6 max-w-3xl leading-[1.08] mx-auto"
          initial="hidden" animate="show" custom={0.3} variants={fadeUp}
        >
          Lend a drill.{' '}
          <span className="display-italic text-[#d05a38]">Borrow a ladder.</span>
          <br />
          Meet your block.
        </motion.h1>

        <motion.p
          className="text-[#7d7a73] text-lg sm:text-xl max-w-lg mx-auto mb-10 leading-relaxed"
          initial="hidden" animate="show" custom={0.4} variants={fadeUp}
        >
          NTEE connects neighbors for short-term tool sharing — no strangers, no shipping, just the people right next door.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center gap-3"
          initial="hidden" animate="show" custom={0.5} variants={fadeUp}
        >
          <Link
            to={isAuthenticated ? '/dashboard' : '/register'}
            className="btn-primary text-base px-7 py-3.5"
          >
            {isAuthenticated ? 'Go to dashboard' : 'Get started — it\'s free'}
            <ArrowRight size={17} />
          </Link>
          {!isAuthenticated && (
            <Link to="/login" className="btn-ghost text-sm px-5 py-3.5">
              Sign in
            </Link>
          )}
        </motion.div>

        {/* Stat row */}
        <motion.div
          className="flex items-center gap-8 mt-14 text-sm text-[#5a5751]"
          initial="hidden" animate="show" custom={0.65} variants={fadeUp}
        >
          <span>100% free</span>
          <span className="w-px h-4 bg-[#2f2d2a]" />
          <span>Block-code verified</span>
          <span className="w-px h-4 bg-[#2f2d2a]" />
          <span>Neighbors only</span>
        </motion.div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        <div className="border-t border-[#2f2d2a] pt-16">

          <motion.p
            className="text-xs font-semibold tracking-[0.18em] uppercase text-[#5a5751] mb-4"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            How it works
          </motion.p>
          <motion.h2
            className="display text-3xl sm:text-4xl text-[#ede9e3] mb-14 max-w-md"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
          >
            Three steps to sharing tools with your neighbors
          </motion.h2>

          <div className="grid sm:grid-cols-3 gap-px bg-[#2f2d2a] rounded-2xl overflow-hidden">
            {[
              {
                step: '01',
                icon: Hammer,
                title: 'List your tools',
                body: 'Post any tool — drill, hedge trimmer, pressure washer. Takes under a minute. Set a deposit if you like, or lend for free.',
              },
              {
                step: '02',
                icon: Users,
                title: 'Browse your block',
                body: 'See what your verified neighbors have available right now. Filter by category or search by keyword.',
              },
              {
                step: '03',
                icon: ShieldCheck,
                title: 'Borrow with confidence',
                body: 'Block codes keep NTEE local. Every person you deal with lives within walking distance.',
              },
            ].map((item, i) => (
              <StepCard key={item.step} {...item} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-32">
        <motion.div
          className="rounded-2xl bg-[#242220] border border-[#3d3b37] p-10 sm:p-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <p className="text-xs tracking-[0.18em] uppercase font-semibold text-[#5a5751] mb-3">Ready to share?</p>
            <h3 className="display text-3xl text-[#ede9e3] mb-2 leading-snug">
              Your next-door neighbor<br />
              <span className="display-italic text-[#d05a38]">has the tool you need.</span>
            </h3>
          </div>
          <div className="shrink-0">
            <Link
              to={isAuthenticated ? '/tools/new' : '/register'}
              className="btn-primary px-7 py-3.5 text-base"
            >
              {isAuthenticated ? 'Post a listing' : 'Join for free'}
              <ArrowRight size={17} />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function StepCard({ step, icon: Icon, title, body, delay }) {
  return (
    <motion.div
      className="bg-[#1a1917] p-8 sm:p-10 flex flex-col"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
    >
      <div className="flex items-center justify-between mb-8">
        <span className="text-4xl font-bold text-[#2f2d2a] tabular-nums leading-none">{step}</span>
        <div className="w-10 h-10 rounded-xl bg-[#242220] border border-[#2f2d2a] flex items-center justify-center">
          <Icon size={18} className="text-[#d05a38]" />
        </div>
      </div>
      <h3 className="text-[#ede9e3] font-semibold text-lg mb-3 leading-snug">{title}</h3>
      <p className="text-[#5a5751] text-sm leading-relaxed">{body}</p>
    </motion.div>
  );
}
