import { AnimatePresence, motion } from 'motion/react';
import { AudioLines } from 'lucide-react';
import { useNarratorState } from '../../lib/voice/neural';

export function NarratorPill() {
  const state = useNarratorState();
  const loading = state.status === 'loading' && state.downloading;
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="pointer-events-none fixed bottom-24 left-1/2 z-[80] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#17141d]/95 px-4 py-3 shadow-xl lg:bottom-6"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <AudioLines className="size-4 text-lavender" />
            Getting the narrator&apos;s voice ready
            <span className="ml-auto tabular-nums text-ink-faint">
              {Math.round(state.progress * 100)}%
            </span>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lavender via-magenta to-gold transition-all duration-500"
              style={{ width: `${Math.max(3, state.progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Only this once. Your device&apos;s voice reads until then.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
