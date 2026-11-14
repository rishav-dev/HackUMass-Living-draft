import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { FileQuestion } from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useInvalidateArchive, useMemories } from '../../api/hooks';
import { useToast } from '../../components/ui/Toast';
import { plural } from '../../lib/format';
import { useSound } from '../../lib/sound/SoundProvider';
import { finalizeTemporal } from '../capture/placement';

function ranged(memory: MemoryCardDto): boolean {
  const { ageMin, ageMax } = memory.temporal;
  return (
    !memory.sensitive &&
    ageMin !== null &&
    ageMax !== null &&
    ageMax > ageMin &&
    ageMax - ageMin <= 3
  );
}

export function OpenQuestions({ unplaced }: { unplaced: number }) {
  const { data: loose = [] } = useMemories({ certainty: 'unplaced' });
  const { data: estimated = [] } = useMemories({ certainty: 'approximate' });
  const [skipped, setSkipped] = useState<string[]>([]);
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { play } = useSound();
  const questions = estimated.filter((m) => ranged(m) && !skipped.includes(m.id)).slice(0, 3);

  if (!unplaced && !questions.length) return null;

  const answer = async (memory: MemoryCardDto, age: number) => {
    const temporal = finalizeTemporal({
      ...memory.temporal,
      ageMin: age,
      ageMax: age,
      approximate: false,
      confidence: 'high',
      explanation: `You said this was when you were ${age}.`,
    });
    await api.patch(`/memories/${memory.id}`, { temporal: { ...temporal, confirmed: true } });
    play('sparkle');
    toast(`“${memory.title}” now sits at age ${age}.`);
    invalidate();
  };

  return (
    <section className="mx-auto mt-8 max-w-6xl px-5 sm:px-8" aria-labelledby="open-questions">
      <div className="paper rounded-3xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="open-questions" className="flex items-center gap-2 text-xl font-semibold">
            <FileQuestion className="size-5 text-gold" aria-hidden="true" />
            Open questions
          </h2>
          {unplaced > 0 && (
            <Link
              to="/search?collection=unplaced"
              viewTransition
              className="ink-link text-sm font-semibold"
            >
              {plural(unplaced, 'memory', 'memories')} not placed yet
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Only if something comes back to you. Skipping is always fine, and nothing gets a made-up
          date.
        </p>

        {questions.length > 0 && (
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            <AnimatePresence initial={false}>
              {questions.map((m) => {
                const ages = Array.from(
                  { length: m.temporal.ageMax! - m.temporal.ageMin! + 1 },
                  (_, i) => m.temporal.ageMin! + i,
                );
                return (
                  <motion.li
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="cert-approximate rounded-2xl border-2 border-white/15 bg-white/4 p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
                      Quick question
                    </p>
                    <p className="mt-1 font-display font-semibold leading-snug">
                      Was “{m.title}” when you were {ages.slice(0, -1).join(', ')} or{' '}
                      {ages[ages.length - 1]}?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ages.map((age) => (
                        <button
                          key={age}
                          type="button"
                          onClick={() => void answer(m, age)}
                          className="rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold-deep ring-1 ring-gold/40 transition hover:bg-gold/30"
                        >
                          {age}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSkipped((list) => [...list, m.id])}
                        className="rounded-full px-3 py-1 text-sm font-semibold text-ink-soft hover:text-ink"
                      >
                        Not sure
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {loose.length > 0 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {loose.slice(0, 8).map((m) => (
              <Link
                key={m.id}
                to={`/memories/${m.id}#placement`}
                viewTransition
                className="cert-unplaced min-w-56 max-w-64 shrink-0 rounded-2xl border-2 border-white/15 bg-white/4 p-4 transition hover:border-gold/60 hover:bg-white/8"
              >
                <p className="font-display font-semibold leading-tight">{m.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                  {m.sensitive ? 'Kept quiet' : m.excerpt}
                </p>
                <p className="mt-3 text-xs font-bold text-gold">When was this? →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
