import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Lightbulb, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useInvalidateArchive, useMemories, useReflections } from '../../api/hooks';
import { AudioPlayer } from '../../components/media/AudioPlayer';
import { ButtonLink } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { relativeTime } from '../../lib/format';

export function Reflections() {
  const { data: reflections = [] } = useReflections();
  const { data: memories = [] } = useMemories();
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const titles = new Map(memories.map((m) => [m.id, m.title]));

  return (
    <section className="mt-20" aria-labelledby="reflections">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">looking back</p>
          <h2 id="reflections" className="mt-1 flex items-center gap-2 text-3xl font-semibold">
            <Lightbulb className="size-6 text-gold" aria-hidden="true" />
            Reflections
          </h2>
          <p className="mt-2 max-w-xl text-ink-soft">
            Thoughts and lessons that aren't one moment. They can point back at the memories that
            taught them.
          </p>
        </div>
        <ButtonLink
          to="/capture?type=reflection"
          variant="secondary"
          icon={<Lightbulb className="size-4" />}
        >
          Reflect
        </ButtonLink>
      </div>
      {reflections.length === 0 ? (
        <p className="paper mt-6 rounded-3xl p-8 text-center text-ink-soft">
          Nothing yet. Next time you think “that's when I learned…”, say it here.
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {reflections.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 2) * 0.08 }}
              className="sticky-note group relative rounded-3xl p-6"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
                {relativeTime(r.recordedAt)}
              </p>
              <p className="mt-2 font-display text-lg leading-relaxed">{r.body}</p>
              {r.audio && (
                <div className="mt-3">
                  <AudioPlayer media={r.audio} label="As you said it" />
                </div>
              )}
              {r.memoryIds.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.memoryIds.map((id) => (
                    <Link
                      key={id}
                      to={`/memories/${id}`}
                      viewTransition
                      className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/20"
                    >
                      ↩ {titles.get(id) ?? 'a memory'}
                    </Link>
                  ))}
                </div>
              )}
              <button
                type="button"
                aria-label="Delete this reflection"
                onClick={async () => {
                  if (!window.confirm('Delete this reflection? This cannot be undone.')) return;
                  await api.delete(`/reflections/${r.id}`);
                  invalidate();
                  toast('Reflection deleted');
                }}
                className="absolute right-4 top-4 rounded-full p-2 text-ink-faint opacity-0 transition hover:bg-white/10 hover:text-rose-deep group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
