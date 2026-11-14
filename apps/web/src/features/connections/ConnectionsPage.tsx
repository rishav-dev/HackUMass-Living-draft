import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Sparkles, X } from 'lucide-react';
import type { ConnectionDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useConnections, useInvalidateArchive } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/controls';
import { EmptyState, ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { connectionMeta } from '../../lib/meta';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { useSound } from '../../lib/sound/SoundProvider';
import { openPlayback } from '../playback/playbackStore';

type Tab = 'confirmed' | 'suggested';

export default function ConnectionsPage() {
  const [tab, setTab] = useState<Tab>('confirmed');
  const { data, isLoading, error, refetch } = useConnections();
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { play } = useSound();
  const [finding, setFinding] = useState(false);
  useAtmosphere({ mood: 'grateful', intensity: 0.45, seed: 'threads', texture: 'wind' });

  if (isLoading) return <PaperLoading label="Following the threads…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;

  const confirmed = data.filter((c) => c.status === 'confirmed');
  const suggested = data.filter((c) => c.status === 'suggested');
  const shown = tab === 'confirmed' ? confirmed : suggested;

  const decide = async (connection: ConnectionDto, status: 'confirmed' | 'dismissed') => {
    await api.patch(`/connections/${connection.id}`, { status });
    play(status === 'confirmed' ? 'sparkle' : 'zoomOut');
    invalidate();
    toast(
      status === 'confirmed'
        ? 'Kept. It shows on both memories now.'
        : "Dismissed. It won't be suggested again.",
    );
  };

  const findMore = async () => {
    setFinding(true);
    try {
      const found = await api.post<ConnectionDto[]>('/connections/suggest', {});
      invalidate();
      play('sparkle');
      toast(
        found.length
          ? `Found ${found.length} new ${found.length === 1 ? 'thread' : 'threads'} to look at`
          : 'No new threads right now',
      );
      if (found.length) setTab('suggested');
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">Threads</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">How your memories connect</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Full circles, repeating patterns, broken ones, wishes that came true. Suggestions wait here
        until you keep or dismiss them. Nothing is linked without you.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="Which threads"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'confirmed', label: `Kept (${confirmed.length})` },
            { value: 'suggested', label: `Suggested (${suggested.length})` },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={findMore}
          disabled={finding}
          icon={<Sparkles className="size-4" />}
          sound={false}
        >
          {finding ? 'Looking…' : 'Look for more'}
        </Button>
        <Link to="/map" viewTransition className="ink-link ml-auto text-sm font-semibold">
          See them on the map
        </Link>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={tab === 'confirmed' ? 'No kept threads yet' : 'Nothing waiting'}>
          {tab === 'confirmed'
            ? 'Keep a suggestion, or link two memories yourself from the Memory Map.'
            : 'Try “Look for more” after adding a few memories.'}
        </EmptyState>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {shown.map((c) => {
              const meta = connectionMeta(c.type);
              const memories = c.endpoints.filter((e) => e.nodeType === 'memory');
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="paper relative overflow-hidden rounded-3xl p-5"
                  style={{ ['--glow' as string]: meta.color }}
                >
                  <span
                    className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-25 blur-3xl"
                    style={{ background: meta.color }}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-bold" style={{ color: meta.color }}>
                    {meta.glyph} {c.label}
                    {c.status === 'suggested' && (
                      <span className="ml-2 font-semibold text-ink-faint">suggested</span>
                    )}
                  </p>
                  <div className="mt-3 flex items-stretch gap-3">
                    {c.endpoints.map((end, i) => (
                      <div
                        key={`${end.nodeId}-${i}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        {i > 0 && (
                          <svg
                            width="34"
                            height="12"
                            viewBox="0 0 34 12"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <path
                              d="M1 6 Q 17 -2 33 6"
                              fill="none"
                              stroke={meta.color}
                              strokeWidth="1.6"
                              strokeDasharray={meta.dash === '0' ? undefined : meta.dash}
                            />
                          </svg>
                        )}
                        <Link
                          to={
                            end.nodeType === 'memory'
                              ? `/memories/${end.nodeId}`
                              : end.nodeType === 'character'
                                ? `/people/${end.nodeId}`
                                : '/'
                          }
                          viewTransition
                          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/4 p-3 transition hover:border-white/25"
                        >
                          <p className="truncate font-display font-semibold">{end.title}</p>
                          {end.ageLabel && <p className="text-xs text-ink-soft">{end.ageLabel}</p>}
                          {end.evidence && (
                            <p className="mt-1 line-clamp-2 text-xs italic text-ink-faint">
                              “{end.evidence.quote}”
                            </p>
                          )}
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">{c.explanation}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.status === 'suggested' ? (
                      <>
                        <Button
                          size="sm"
                          icon={<Check className="size-4" />}
                          onClick={() => decide(c, 'confirmed')}
                          sound={false}
                        >
                          Keep it
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<X className="size-4" />}
                          onClick={() => decide(c, 'dismissed')}
                          sound={false}
                        >
                          Not really
                        </Button>
                      </>
                    ) : (
                      memories[0] && (
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => openPlayback({ memoryId: memories[0]!.nodeId })}
                          sound="zoomIn"
                        >
                          Follow the thread
                        </Button>
                      )
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
