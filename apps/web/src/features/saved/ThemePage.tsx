import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { CertaintyMark, EmotionRow, PeopleRow } from '../../components/memory/bits';
import { PaperLoading } from '../../components/ui/states';
import { useScene } from '../../lib/sound/SoundProvider';

export default function ThemePage() {
  const { theme = '' } = useParams();
  useScene('studio');
  const { data, isLoading } = useQuery({
    queryKey: ['theme', theme],
    queryFn: () =>
      api.get<{ theme: string; memories: Array<MemoryCardDto & { why: string | null }> }>(
        `/themes/${encodeURIComponent(theme)}`,
      ),
  });
  const { data: all } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.get<Array<{ theme: string; count: number }>>('/themes'),
  });
  if (isLoading || !data) return <PaperLoading />;

  return (
    <div className="mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">a thread through your life</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">{data.theme}</h1>
      <p className="mt-2 text-ink-soft">
        {data.memories.length === 1
          ? 'One memory so far. Threads get clearer as you write more.'
          : `${data.memories.length} memories, oldest first, and why each one belongs here.`}
      </p>
      <ol className="relative mt-8 flex flex-col gap-5 border-l border-lavender-deep/30 pl-6">
        {data.memories.map((m) => (
          <li key={m.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.95rem] top-6 size-3 rounded-full bg-lavender-deep shadow-[0_0_12px_var(--color-lavender-deep)]"
            />
            <Link
              to={`/memories/${m.id}`}
              viewTransition
              className="paper block rounded-3xl p-5 transition hover:-translate-y-0.5"
            >
              <CertaintyMark temporal={m.temporal} compact />
              <p className="mt-2 font-display text-2xl font-semibold">{m.title}</p>
              {m.why && <p className="mt-2 text-ink">{m.why}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <PeopleRow people={m.people} linked={false} />
                <EmotionRow emotions={m.emotions.slice(0, 3)} />
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {all && all.length > 1 && (
        <section className="mt-12">
          <h2 className="eyebrow">other threads</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {all
              .filter((t) => t.theme !== data.theme)
              .map((t) => (
                <Link
                  key={t.theme}
                  to={`/threads/${encodeURIComponent(t.theme)}`}
                  className="rounded-full bg-linen px-3 py-1 text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  {t.theme} · {t.count}
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
