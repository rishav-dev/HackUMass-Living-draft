import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Map as MapIcon, Mic, X } from 'lucide-react';
import type { ConnectionDto, MemoryDetailDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useInvalidateArchive } from '../../api/hooks';
import { CertaintyMark } from '../../components/memory/bits';
import { Core } from '../../components/core/Core';
import { Button, ButtonLink } from '../../components/ui/Button';
import { connectionMeta } from '../../lib/meta';
import { useMotionAllowed } from '../../lib/motion';
import { useSound } from '../../lib/sound/SoundProvider';
import type { CaptureKind } from './useCaptureDraft';

const PETALS = Array.from({ length: 18 }, (_, i) => ({
  x: Math.cos((i / 18) * Math.PI * 2) * (120 + (i % 3) * 40),
  y: Math.sin((i / 18) * Math.PI * 2) * (90 + (i % 4) * 30) - 40,
  color: ['#f3c4cc', '#e5bd66', '#c5bbe6', '#a7c0a3'][i % 4],
  rotate: (i * 47) % 360,
}));

export function SavedScreen({
  kind,
  label,
  memory,
  updated,
  suggestions,
  onAnother,
}: {
  kind: CaptureKind;
  label: string;
  memory?: MemoryDetailDto;
  updated?: boolean;
  suggestions: ConnectionDto[];
  onAnother: () => void;
}) {
  const motionAllowed = useMotionAllowed();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-6 text-center sm:px-6">
      <div className="relative">
        {motionAllowed &&
          PETALS.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-3 w-5 rounded-full"
              style={{ backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
              animate={{
                x: p.x,
                y: [p.y, p.y + 160],
                opacity: [1, 1, 0],
                rotate: p.rotate + 180,
                scale: 1,
              }}
              transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 + (i % 5) * 0.03 }}
            />
          ))}
        <Core state="saved" size={150} />
      </div>
      <h1 className="mt-4 text-4xl font-semibold">{label}</h1>
      {memory && (
        <div className="paper mt-6 w-full rounded-3xl p-5 text-left">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <CertaintyMark temporal={memory.temporal} />
            {updated && (
              <span className="rounded-full bg-lavender/40 px-2.5 py-0.5 text-xs font-bold text-lavender-deep">
                Telling {memory.versions.length}
              </span>
            )}
          </div>
          <p className="font-display text-2xl font-semibold">{memory.title}</p>
          <p className="mt-1 line-clamp-2 text-ink-soft">{memory.excerpt}</p>
          {updated && memory.pendingReview.length > 0 && (
            <p className="mt-3 rounded-2xl bg-peach/40 px-4 py-2 text-sm font-semibold text-peach-deep">
              Some details read differently from before. Nothing was overwritten. Have a look when
              you're ready.
            </p>
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {memory && (
          <ButtonLink to={updated ? `/memories/${memory.id}/evolution` : `/memories/${memory.id}`}>
            {updated ? 'See what changed' : 'Open it'}
          </ButtonLink>
        )}
        {memory && memory.temporal.placedAges[0] !== undefined && (
          <ButtonLink to={`/chapters/${memory.temporal.placedAges[0]}`} variant="secondary">
            See it in Chapter {memory.temporal.placedAges[0]}
          </ButtonLink>
        )}
        {kind === 'capsule' && (
          <ButtonLink to="/capsules" variant="secondary">
            Your capsules
          </ButtonLink>
        )}
        <Button variant="ghost" onClick={onAnother} icon={<Mic className="size-4" />}>
          Capture another
        </Button>
      </div>
      {suggestions.length > 0 && <Suggestions suggestions={suggestions} />}
    </div>
  );
}

function Suggestions({ suggestions }: { suggestions: ConnectionDto[] }) {
  const [state, setState] = useState<Record<string, 'confirmed' | 'dismissed'>>({});
  const invalidate = useInvalidateArchive();
  const { play } = useSound();

  const decide = async (id: string, status: 'confirmed' | 'dismissed') => {
    setState((s) => ({ ...s, [id]: status }));
    play(status === 'confirmed' ? 'pluck' : 'tap');
    await api.patch(`/connections/${id}`, { status });
    invalidate();
  };

  return (
    <section className="mt-10 w-full text-left" aria-labelledby="threads">
      <h2 id="threads" className="text-xl font-semibold">
        A thread you might want to pin
      </h2>
      <p className="text-sm text-ink-soft">
        Only a suggestion. It means whatever you decide it means.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {suggestions.map((s) => {
          const meta = connectionMeta(s.type);
          const decided = state[s.id];
          return (
            <li
              key={s.id}
              className="paper rounded-3xl border-l-4 p-5"
              style={{ borderLeftColor: meta.color }}
            >
              <p className="text-sm font-bold" style={{ color: meta.color }}>
                {meta.glyph} {s.label}
              </p>
              <p className="mt-1">{s.explanation}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {s.endpoints.map((e) => (
                  <blockquote key={e.nodeId} className="rounded-2xl bg-cream/70 p-3 text-sm">
                    <span className="block font-bold">{e.title}</span>
                    {e.evidence && (
                      <span className="italic text-ink-soft">“{e.evidence.quote}”</span>
                    )}
                  </blockquote>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {decided ? (
                  <span className="text-sm font-semibold text-ink-soft">
                    {decided === 'confirmed' ? 'Pinned to your Memory Map.' : 'Dismissed.'}
                  </span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      icon={<Check className="size-4" />}
                      onClick={() => decide(s.id, 'confirmed')}
                      sound={false}
                    >
                      Pin it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X className="size-4" />}
                      onClick={() => decide(s.id, 'dismissed')}
                      sound={false}
                    >
                      Not really
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ButtonLink to="/map" variant="ghost" icon={<MapIcon className="size-4" />} className="mt-3">
        Open the Memory Map
      </ButtonLink>
    </section>
  );
}
