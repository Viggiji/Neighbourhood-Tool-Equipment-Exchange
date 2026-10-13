import { motion } from 'framer-motion';

/**
 * FadeContent – reactbits-inspired fade-in wrapper.
 * Content smoothly fades up into view with optional delay and duration.
 */
export default function FadeContent({
  children,
  delay = 0,
  duration = 0.6,
  direction = 'up',
  className = '',
  blur = false,
}) {
  const directionMap = {
    up: { y: 24, x: 0 },
    down: { y: -24, x: 0 },
    left: { x: 24, y: 0 },
    right: { x: -24, y: 0 },
    none: { x: 0, y: 0 },
  };

  const offset = directionMap[direction] || directionMap.up;

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...offset,
        filter: blur ? 'blur(8px)' : 'blur(0px)',
      }}
      animate={{
        opacity: 1,
        y: 0,
        x: 0,
        filter: 'blur(0px)',
      }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
