import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-11 h-11' };
  const borders = { sm: 'border-2', md: 'border-2', lg: 'border-[3px]' };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <motion.div
        className={`${sizes[size]} ${borders[size]} rounded-full border-[#2f2d2a] border-t-[#d05a38]`}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
      />
      {text && (
        <p className="text-sm text-[#5a5751]">{text}</p>
      )}
    </div>
  );
}
