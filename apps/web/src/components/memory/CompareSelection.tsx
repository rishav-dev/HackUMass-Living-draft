import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { GitCompareArrows, X } from 'lucide-react';
import type { CompareSelection } from './useCompareSelection';

export function SelectToCompare({ selection }: { selection: CompareSelection }) {
  return (
    <button
      type="button"
      aria-pressed={selection.active}
      onClick={() => selection.setActive(!selection.active)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${selection.active ? 'bg-snow text-abyss' : 'text-ink-soft hover:bg-white/8 hover:text-ink'}`}
    >
      <GitCompareArrows className="size-4" aria-hidden="true" />
      {selection.active ? 'Choosing…' : 'Compare'}
    </button>
  );
}

export function CompareTray({ selection }: { selection: CompareSelection }) {
  const navigate = useNavigate();
  const ready = selection.ids.length >= 2;
  return (
    <AnimatePresence>
      {selection.active && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="glass-strong fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-full py-2 pl-5 pr-2 shadow-lift xl:bottom-6"
          role="region"
          aria-label="Compare selection"
        >
          <p className="flex-1 text-sm font-semibold">
            {selection.ids.length === 0
              ? 'Tap two to six memories'
              : `${selection.ids.length} chosen${ready ? '' : ', pick one more'}`}
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              void navigate(`/compare?ids=${selection.ids.join(',')}`, { viewTransition: true })
            }
            className="btn-aurora inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-40"
          >
            <GitCompareArrows className="size-4" /> Compare
          </button>
          <button
            type="button"
            aria-label="Stop choosing"
            onClick={() => selection.setActive(false)}
            className="rounded-full p-2 text-ink-soft hover:bg-white/8 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
