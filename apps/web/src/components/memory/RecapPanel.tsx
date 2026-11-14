import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ear, Square } from 'lucide-react';
import { api } from '../../api/client';
import { narrationSupported, speak, stopSpeaking } from '../../lib/narration';

export function RecapPanel({
  label,
  memoryIds,
  quietCount = 0,
  focusPeople = [],
  className = '',
}: {
  label: string;
  memoryIds: string[];
  quietCount?: number;
  focusPeople?: string[];
  className?: string;
}) {
  const [includeQuiet, setIncludeQuiet] = useState(false);
  const [reading, setReading] = useState(false);
  const ids = [...memoryIds].sort();
  const { data, isLoading } = useQuery({
    queryKey: ['recap', label, ids.join(','), includeQuiet, focusPeople.join(',')],
    queryFn: () =>
      api.post<{ lines: string[] }>('/recap', { label, memoryIds: ids, includeQuiet, focusPeople }),
    enabled: ids.length > 0,
  });

  if (!ids.length) return null;
  const lines = data?.lines ?? [];

  return (
    <section className={`paper rounded-3xl p-5 ${className}`} aria-label={`Recap: ${label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Recap</p>
        <div className="flex items-center gap-3">
          {quietCount > 0 && (
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <input
                type="checkbox"
                className="size-3.5"
                checked={includeQuiet}
                onChange={(e) => setIncludeQuiet(e.target.checked)}
              />
              Include quiet memories
            </label>
          )}
          {narrationSupported() && lines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (reading) {
                  stopSpeaking();
                  setReading(false);
                  return;
                }
                setReading(true);
                speak(lines.join(' '), { onEnd: () => setReading(false) });
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-white/8 hover:text-ink"
            >
              {reading ? <Square className="size-3.5" /> : <Ear className="size-3.5" />}
              {reading ? 'Stop' : 'Read aloud'}
            </button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="anim-shimmer h-4 w-3/4 rounded bg-white/8" />
          <div className="anim-shimmer h-4 w-1/2 rounded bg-white/8" />
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5 text-[0.97rem]">
          {lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span
                className="mt-2.5 size-1 shrink-0 rounded-full bg-lavender-deep"
                aria-hidden="true"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Built only from what you've recorded. Gaps are gaps, not guesses.
      </p>
    </section>
  );
}
