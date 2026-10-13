import { motion, AnimatePresence } from 'framer-motion';

export default function AnimatedFormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error = '',
  icon: Icon,
  required = false,
  children,
}) {
  const hasError = !!error;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#a8a49c]">
        {label}
        {required && <span className="text-[#d05a38] ml-0.5">*</span>}
      </label>

      <div className="relative">
        {Icon && !children && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5751] pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        {Icon && children && (
          <div className="absolute left-3 top-3.5 text-[#5a5751] pointer-events-none">
            <Icon size={16} />
          </div>
        )}

        {children || (
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`input-field ${Icon ? 'input-icon-left' : ''} ${hasError ? 'error' : ''}`}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        {hasError && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.16 }}
            className="text-[#e05040] text-xs flex items-center gap-1.5"
          >
            <span className="inline-block w-1 h-1 rounded-full bg-[#e05040] shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
