import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, GitCompare, Sparkles, Trash2 } from 'lucide-react';
import type { MemoryCardDto, SavedAnalysisDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { CertaintyMark, EmotionRow } from '../../components/memory/bits';
import { IconButton } from '../../components/ui/Button';
import { PaperLoading } from '../../components/ui/states';
import { formatDate } from '../../lib/format';
import { useScene } from '../../lib/sound/SoundProvider';

interface SavedDto {
  memories: MemoryCardDto[];
  analyses: SavedAnalysisDto[];
}

interface SavedCompare {
  memoryIds?: string[];
  titles?: string[];
  headline?: string;
  observations?: Array<{ kind: string; text: string }>;
  summary?: string[];
}

interface SavedAnswer {
  lines?: Array<{ text: string }>;
}

export default function SavedPage() {
  useScene('quiet');
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => api.get<SavedDto>('/saved'),
  });
  if (isLoading || !data) return <PaperLoading />;

  const remove = async (id: string) => {
    await api.delete(`/analyses/${id}`);
    await client.invalidateQueries({ queryKey: ['saved'] });
    await client.invalidateQueries({ queryKey: ['analyses'] });
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">kept on purpose</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">Saved</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Memories you bookmarked, and comparisons and answers you chose to keep.
      </p>

      <section className="mt-10" aria-labelledby="saved-memories">
        <h2 id="saved-memories" className="flex items-center gap-2 text-2xl font-semibold">
          <Bookmark className="size-5 text-gold-deep" /> Bookmarked memories
        </h2>
        {data.memories.length === 0 ? (
          <p className="mt-3 text-ink-soft">
            Nothing bookmarked yet. Use the bookmark button on any memory.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {data.memories.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/memories/${m.id}`}
                  viewTransition
                  className="paper block rounded-3xl p-5 transition hover:-translate-y-0.5"
                >
                  <CertaintyMark temporal={m.temporal} compact />
                  <p className="mt-2 font-display text-xl font-semibold">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                    {m.summary ?? m.excerpt}
                  </p>
                  <div className="mt-3">
                    <EmotionRow emotions={m.emotions.slice(0, 4)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="saved-notes">
        <h2 id="saved-notes" className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="size-5 text-lavender-deep" /> Comparisons and answers
        </h2>
        {data.analyses.length === 0 ? (
          <p className="mt-3 text-ink-soft">
            When you compare memories or ask a question, press Save to keep the result here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {data.analyses.map((a) => {
              const compare = a.kind === 'compare' ? (a.result as SavedCompare) : null;
              const answer = a.kind !== 'compare' ? (a.result as SavedAnswer) : null;
              return (
                <li key={a.id} className="paper rounded-3xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                        {compare ? (
                          <GitCompare className="size-3.5" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        {compare ? 'Comparison' : 'Answer'} · {formatDate(a.createdAt)}
                      </p>
                      <p className="mt-1 font-display text-xl font-semibold">{a.question}</p>
                    </div>
                    <IconButton label="Remove from Saved" onClick={() => void remove(a.id)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                  {compare && (
                    <>
                      {compare.titles && (
                        <p className="mt-1 text-sm text-ink-soft">{compare.titles.join(' · ')}</p>
                      )}
                      <p className="mt-3">{compare.headline ?? compare.summary?.join(' ')}</p>
                      {compare.observations && compare.observations.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                          {compare.observations.map((o) => (
                            <li key={o.text}>{o.text}</li>
                          ))}
                        </ul>
                      )}
                      {compare.memoryIds && (
                        <Link
                          to={`/compare?ids=${compare.memoryIds.join(',')}`}
                          className="mt-3 inline-block text-sm font-semibold text-lavender-deep hover:underline"
                        >
                          Open the comparison again
                        </Link>
                      )}
                    </>
                  )}
                  {answer?.lines && (
                    <div className="mt-3 space-y-2">
                      {answer.lines.map((l) => (
                        <p key={l.text}>{l.text}</p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
