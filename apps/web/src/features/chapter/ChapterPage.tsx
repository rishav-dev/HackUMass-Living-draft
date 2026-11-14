import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Clapperboard, Mic } from 'lucide-react';
import type { ChapterDto, Season } from '@living-draft/contracts';
import { MONTH_NAMES, monthsForSeason } from '@living-draft/engine';
import { useChapter, usePrompts } from '../../api/hooks';
import { SceneArt } from '../../components/scene/SceneArt';
import { EmotionChip, Portrait } from '../../components/memory/bits';
import { MemoryCard } from '../../components/memory/MemoryCard';
import { CompareTray, SelectToCompare } from '../../components/memory/CompareSelection';
import { useCompareSelection } from '../../components/memory/useCompareSelection';
import { RecapPanel } from '../../components/memory/RecapPanel';
import { Core } from '../../components/core/Core';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { formatDate } from '../../lib/format';
import { SEASON_META } from '../../lib/meta';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { textureFor } from '../../lib/sound/textures';
import { useSound } from '../../lib/sound/SoundProvider';
import { openPlayback } from '../playback/playbackStore';
import { ShareChapter } from './ShareChapter';

type Bucket = { key: string; label: string; count: number };

function dominantSeason(chapter: ChapterDto): Season | null {
  const counts = new Map<Season, number>();
  for (const m of chapter.memories)
    if (m.temporal.season) counts.set(m.temporal.season, (counts.get(m.temporal.season) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export default function ChapterPage() {
  const age = Number(useParams().age);
  const { data, isLoading, error, refetch } = useChapter(age);
  if (isLoading) return <PaperLoading label="Finding the page…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <ChapterView key={age} chapter={data} />;
}

function ChapterView({ chapter }: { chapter: ChapterDto }) {
  const { play } = useSound();
  const season = dominantSeason(chapter);
  const meta = season ? SEASON_META[season] : null;
  const feelings = chapter.memories
    .filter((m) => !m.sensitive)
    .flatMap((m) => m.emotions.map((e) => ({ tag: e.tag, phase: e.phase })));
  useAtmosphere({
    emotions: feelings.slice(0, 24),
    fallback: 'cosmos',
    seed: `chapter-${chapter.age}`,
    texture: textureFor(null, season, chapter.memories.map((m) => m.title).join(' ')),
    dim: 0.5,
  });
  const lead = chapter.memories.find((m) => !m.sensitive) ?? null;

  const [granularity, setGranularity] = useState<'season' | 'month'>('season');
  const [bucket, setBucket] = useState<string>('all');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [mode, setMode] = useState<'any' | 'all'>('any');
  const [person, setPerson] = useState<string | null>(null);
  const selection = useCompareSelection();
  const hemisphereKnown = chapter.hemisphere === 'north' || chapter.hemisphere === 'south';

  const seasonOf = (m: ChapterDto['memories'][number]): string => {
    if (m.temporal.season) return m.temporal.season;
    if (m.temporal.month && hemisphereKnown) {
      const found = (['spring', 'summer', 'autumn', 'winter'] as Season[]).find((s) =>
        monthsForSeason(s, chapter.hemisphere).includes(m.temporal.month!),
      );
      if (found) return found;
    }
    return 'unknown';
  };
  const monthOf = (m: ChapterDto['memories'][number]) =>
    m.temporal.month ? String(m.temporal.month) : 'unknown';

  const buckets: Bucket[] = useMemo(() => {
    if (granularity === 'season') {
      return [
        ...(['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => ({
          key: s,
          label: SEASON_META[s].label,
          count: chapter.memories.filter((m) => seasonOf(m) === s).length,
        })),
        {
          key: 'unknown',
          label: 'Sometime this year',
          count: chapter.memories.filter((m) => seasonOf(m) === 'unknown').length,
        },
      ];
    }
    return [
      ...MONTH_NAMES.map((name, i) => ({
        key: String(i + 1),
        label: name.slice(0, 3),
        count: chapter.memories.filter((m) => monthOf(m) === String(i + 1)).length,
      })),
      {
        key: 'unknown',
        label: 'No month',
        count: chapter.memories.filter((m) => monthOf(m) === 'unknown').length,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, chapter]);

  const allEmotions = [...new Set(chapter.memories.flatMap((m) => m.emotions.map((e) => e.tag)))];

  const visible = chapter.memories.filter((m) => {
    if (bucket !== 'all' && (granularity === 'season' ? seasonOf(m) : monthOf(m)) !== bucket)
      return false;
    if (person && !m.people.some((p) => p.characterId === person)) return false;
    if (emotions.length) {
      const tags = new Set(m.emotions.map((e) => e.tag));
      return mode === 'all'
        ? emotions.every((e) => tags.has(e))
        : emotions.some((e) => tags.has(e));
    }
    return true;
  });

  const toggleEmotion = (tag: string) => {
    play('tap');
    setEmotions((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[34rem] overflow-hidden">
        <SceneArt
          size="hero"
          artKey={lead ? `memory:${lead.id}` : `chapter:${chapter.age}`}
          generate={Boolean(lead)}
          text={chapter.memories.map((m) => `${m.title} ${m.excerpt}`).join(' ')}
          emotions={feelings.map((f) => f.tag)}
          className="absolute inset-0 opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-abyss/30 via-abyss/40 to-ivory" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 pt-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            viewTransition
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
            onClick={() => play('shift')}
          >
            <ArrowLeft className="size-4" /> Life Path
          </Link>
          <div className="flex gap-1">
            {chapter.previousAge !== null && (
              <Link
                to={`/chapters/${chapter.previousAge}`}
                viewTransition
                onClick={() => play('shift')}
                aria-label={`Age ${chapter.previousAge}`}
                className="inline-flex items-center gap-1 rounded-full bg-paper/88 px-3 py-1.5 text-sm font-semibold hover:bg-paper"
              >
                <ChevronLeft className="size-4" /> {chapter.previousAge}
              </Link>
            )}
            {chapter.nextAge !== null && (
              <Link
                to={`/chapters/${chapter.nextAge}`}
                viewTransition
                onClick={() => play('shift')}
                aria-label={`Age ${chapter.nextAge}`}
                className="inline-flex items-center gap-1 rounded-full bg-paper/88 px-3 py-1.5 text-sm font-semibold hover:bg-paper"
              >
                {chapter.nextAge} <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        <header className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow" style={{ color: meta?.accent ?? '#6a58a6' }}>
              Age {chapter.age}
              {chapter.dateRange
                ? ` · ${formatDate(chapter.dateRange.start, { month: 'short', year: 'numeric' })} – ${formatDate(chapter.dateRange.end, { month: 'short', year: 'numeric' })}`
                : ''}
            </p>
            <h1
              className="text-5xl font-semibold sm:text-7xl"
              style={{ viewTransitionName: 'chapter-title' }}
            >
              {chapter.title}
            </h1>
            <div className="mt-5 max-w-xl space-y-1 text-[1.05rem] text-ink-soft">
              {chapter.recap.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink to={`/capture?age=${chapter.age}`} icon={<Mic className="size-4" />}>
                Add a memory here
              </ButtonLink>
              {chapter.memories.length > 0 && (
                <Button
                  variant="secondary"
                  icon={<Clapperboard className="size-4" />}
                  onClick={() => openPlayback({ age: chapter.age })}
                  sound="zoomIn"
                >
                  Step back in
                </Button>
              )}
              {chapter.memories.length > 0 && (
                <ShareChapter
                  age={chapter.age}
                  title={chapter.title}
                  quietCount={chapter.memories.filter((m) => m.sensitive).length}
                />
              )}
            </div>
          </div>
          {chapter.characters.length > 0 && (
            <div className="paper rounded-3xl p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
                People this year
              </p>
              <div className="flex flex-col gap-1">
                {chapter.characters.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={person === c.id}
                    onClick={() => {
                      play('tap');
                      setPerson((p) => (p === c.id ? null : c.id));
                    }}
                    className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left text-sm font-semibold transition ${person === c.id ? 'bg-lavender/40' : 'hover:bg-ink/5'}`}
                  >
                    <Portrait name={c.name} size={28} />
                    {c.name}
                    <span className="ml-auto text-xs text-ink-faint">{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {chapter.milestones.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {chapter.milestones.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 rounded-r-full bg-peach-deep py-1.5 pl-3 pr-4 text-sm font-bold text-abyss shadow"
              >
                ⚑ {m.title}
              </span>
            ))}
          </div>
        )}

        {chapter.memories.length > 0 ? (
          <>
            <div className="sticky top-16 z-10 -mx-5 mt-10 border-b border-ink/6 bg-ivory/88 px-5 py-3 sm:-mx-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  size="sm"
                  label="Group by"
                  value={granularity}
                  onChange={(v) => {
                    setGranularity(v);
                    setBucket('all');
                  }}
                  options={[
                    { value: 'season', label: 'Seasons' },
                    { value: 'month', label: 'Months' },
                  ]}
                />
                <div
                  className="scrollbar-none -mr-5 flex flex-1 gap-1.5 overflow-x-auto pr-5"
                  role="listbox"
                  aria-label={granularity === 'season' ? 'Season' : 'Month'}
                >
                  <StripChip
                    active={bucket === 'all'}
                    onClick={() => setBucket('all')}
                    label="All"
                    count={chapter.memories.length}
                  />
                  {buckets.map((b) => (
                    <StripChip
                      key={b.key}
                      active={bucket === b.key}
                      onClick={() => setBucket(b.key)}
                      label={b.label}
                      count={b.count}
                      season={granularity === 'season' ? (b.key as Season) : undefined}
                    />
                  ))}
                </div>
              </div>
              {allEmotions.length > 1 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-bold text-ink-soft">Feelings</span>
                  {allEmotions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={emotions.includes(tag)}
                      onClick={() => toggleEmotion(tag)}
                      className={`rounded-full transition ${emotions.includes(tag) ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <EmotionChip tag={tag} size="sm" />
                    </button>
                  ))}
                  {emotions.length > 1 && (
                    <span className="ml-2 flex items-center gap-2 text-xs text-ink-soft">
                      <Segmented
                        size="sm"
                        label="Match"
                        value={mode}
                        onChange={setMode}
                        options={[
                          { value: 'any', label: 'Any' },
                          { value: 'all', label: 'All' },
                        ]}
                      />
                      {mode === 'any'
                        ? `tagged ${emotions.join(' or ')}`
                        : `tagged ${emotions.join(' and ')}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {visible.length > 1 && <SelectToCompare selection={selection} />}
            </div>
            {bucket !== 'all' && visible.length > 0 && (
              <RecapPanel
                className="mt-4"
                label={`${buckets.find((b) => b.key === bucket)?.label ?? 'This part'} of ${chapter.title}`}
                memoryIds={visible.map((m) => m.id)}
                quietCount={visible.filter((m) => m.sensitive).length}
              />
            )}
            <CompareTray selection={selection} />
            <div className="mt-6 grid gap-5 pb-10 md:grid-cols-2">
              {visible.map((memory, i) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  index={i}
                  selectable={selection.active}
                  selected={selection.ids.includes(memory.id)}
                  onSelect={() => selection.toggle(memory.id)}
                  note={
                    memory.sharedWith.length
                      ? `might also be age ${memory.sharedWith.join(' or ')}`
                      : undefined
                  }
                />
              ))}
              {!visible.length && (
                <p className="py-10 text-center text-ink-soft md:col-span-2">
                  Nothing matches those filters in this chapter.
                </p>
              )}
            </div>
          </>
        ) : (
          <EmptyChapter chapter={chapter} />
        )}
      </div>
    </div>
  );
}

function StripChip({
  active,
  onClick,
  label,
  count,
  season,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  season?: Season;
}) {
  const { play } = useSound();
  const Icon = season ? SEASON_META[season]?.icon : null;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => {
        play('tap');
        onClick();
      }}
      disabled={count === 0 && !active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-35 ${
        active
          ? 'bg-snow text-abyss shadow-[0_0_22px_-6px_var(--mood-c)]'
          : 'bg-paper text-ink shadow-sm hover:bg-cream'
      }`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
      <span className={`text-xs ${active ? 'text-snow/70' : 'text-ink-faint'}`}>{count}</span>
    </button>
  );
}

function EmptyChapter({ chapter }: { chapter: ChapterDto }) {
  const { data: prompts } = usePrompts(undefined, 3);
  return (
    <div className="mx-auto mt-12 flex max-w-xl flex-col items-center pb-16 text-center">
      <Core state="ready" size={110} />
      <p className="mt-4 text-lg text-ink-soft">
        Nothing here yet, and that's fine. If something from age {chapter.age} comes back to you,
        here are a few places to start.
      </p>
      <ul className="mt-6 w-full space-y-2">
        {prompts?.map((prompt) => (
          <li key={prompt.id}>
            <Link
              to={`/capture?age=${chapter.age}&prompt=${encodeURIComponent(prompt.text)}`}
              viewTransition
              className="paper block rounded-2xl px-5 py-3 text-left font-display text-lg transition hover:-translate-y-0.5"
            >
              {prompt.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
