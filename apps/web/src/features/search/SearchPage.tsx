import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search, Shuffle } from 'lucide-react';
import {
  useCharacters,
  useConnectionTypes,
  useMemories,
  useMilestones,
  usePrompts,
  type MemorySearch,
} from '../../api/hooks';
import { EmotionChip } from '../../components/memory/bits';
import { MemoryCard } from '../../components/memory/MemoryCard';
import { CompareTray, SelectToCompare } from '../../components/memory/CompareSelection';
import { useCompareSelection } from '../../components/memory/useCompareSelection';
import { RecapPanel } from '../../components/memory/RecapPanel';
import { Core } from '../../components/core/Core';
import { Segmented, Select, TextInput } from '../../components/ui/controls';
import { BASE_EMOTION_TAGS, emotionMeta } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';

const COLLECTIONS = [
  { value: '', label: 'Everything' },
  { value: 'unplaced', label: 'Open questions' },
  { value: 'needs_review', label: 'Worth a look' },
  { value: 'sensitive', label: 'Kept quiet' },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [mode, setMode] = useState<'any' | 'all'>('any');
  const [filters, setFilters] = useState<MemorySearch>({});
  const [promptGroup, setPromptGroup] = useState<string>('period');
  const { play } = useSound();
  const collection = params.get('collection') ?? '';
  const { data: people } = useCharacters();
  const { data: types } = useConnectionTypes();
  const { data: milestones } = useMilestones();
  const { data: prompts, refetch } = usePrompts(promptGroup, 3);
  useScene('studio');
  const selection = useCompareSelection();
  const [recapping, setRecapping] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (text) next.set('q', text);
      else next.delete('q');
      setParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const query: MemorySearch = {
    ...filters,
    q: params.get('q') || undefined,
    collection: collection || undefined,
    emotions: emotions.length ? emotions.join(',') : undefined,
    emotionMode: mode,
  };
  const { data: results, isFetching } = useMemories(query);
  const set = (patch: MemorySearch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <h1 className="text-4xl font-semibold sm:text-5xl">Find a memory</h1>
      <label className="relative mt-6 block">
        <Search
          className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <TextInput
          autoFocus
          aria-label="Search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A word, a name, a place, “that summer”…"
          className="h-14 rounded-3xl pl-14 text-lg"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Collections">
        {COLLECTIONS.map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={collection === c.value}
            onClick={() => {
              play('tap');
              const next = new URLSearchParams(params);
              if (c.value) next.set('collection', c.value);
              else next.delete('collection');
              setParams(next, { replace: true });
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${collection === c.value ? 'bg-snow text-abyss shadow-[0_0_22px_-6px_var(--mood-c)]' : 'bg-paper text-ink-soft shadow-sm hover:text-ink'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="flex flex-col gap-5">
          <div className="paper rounded-3xl p-4">
            <p className="mb-2 text-sm font-bold">Feelings</p>
            <div className="flex flex-wrap gap-1.5">
              {BASE_EMOTION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={emotions.includes(tag)}
                  onClick={() => {
                    play('tap');
                    setEmotions((l) =>
                      l.includes(tag) ? l.filter((t) => t !== tag) : [...l, tag],
                    );
                  }}
                  className={`rounded-full transition ${emotions.includes(tag) ? 'ring-2 ring-ink' : 'opacity-60 hover:opacity-100'}`}
                >
                  <EmotionChip tag={tag} size="sm" />
                </button>
              ))}
            </div>
            {emotions.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
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
              </div>
            )}
            {emotions.length > 0 && (
              <p className="mt-2 text-xs text-ink-soft">
                Showing memories tagged{' '}
                {emotions
                  .map((e) => emotionMeta(e).label.toLowerCase())
                  .join(mode === 'any' ? ' or ' : ' and ')}
              </p>
            )}
          </div>

          <div className="paper flex flex-col gap-3 rounded-3xl p-4 text-sm">
            <label className="font-bold">
              Person
              <Select
                value={filters.characterId ?? ''}
                onChange={(e) => set({ characterId: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Anyone</option>
                {people?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            {filters.characterId && (
              <Segmented
                size="sm"
                label="Their role"
                value={filters.role ?? 'any'}
                onChange={(v) => set({ role: v === 'any' ? undefined : v })}
                options={[
                  { value: 'any', label: 'Any' },
                  { value: 'central', label: 'Central' },
                  { value: 'supporting', label: 'Supporting' },
                  { value: 'mentioned', label: 'Mentioned' },
                ]}
              />
            )}
            <div className="flex gap-2">
              <label className="flex-1 font-bold">
                From age
                <TextInput
                  inputMode="numeric"
                  value={filters.ageMin ?? ''}
                  onChange={(e) =>
                    set({
                      ageMin: e.target.value
                        ? Number(e.target.value.replace(/\D/g, ''))
                        : undefined,
                    })
                  }
                  className="mt-1 h-9 py-1 text-sm"
                />
              </label>
              <label className="flex-1 font-bold">
                to
                <TextInput
                  inputMode="numeric"
                  value={filters.ageMax ?? ''}
                  onChange={(e) =>
                    set({
                      ageMax: e.target.value
                        ? Number(e.target.value.replace(/\D/g, ''))
                        : undefined,
                    })
                  }
                  className="mt-1 h-9 py-1 text-sm"
                />
              </label>
            </div>
            <label className="font-bold">
              Season
              <Select
                value={filters.season ?? ''}
                onChange={(e) => set({ season: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Any</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter">Winter</option>
              </Select>
            </label>
            <label className="font-bold">
              Has
              <Select
                value={filters.media ?? ''}
                onChange={(e) => set({ media: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Anything</option>
                <option value="photo">Photos</option>
                <option value="audio">Recordings</option>
                <option value="video">Video</option>
              </Select>
            </label>
            <label className="font-bold">
              Date
              <Select
                value={filters.certainty ?? ''}
                onChange={(e) => set({ certainty: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Any</option>
                <option value="certain">Placed</option>
                <option value="approximate">Estimated</option>
                <option value="unplaced">Not placed</option>
              </Select>
            </label>
            <label className="font-bold">
              Connected by
              <Select
                value={filters.connection ?? ''}
                onChange={(e) => set({ connection: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Any thread</option>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="font-bold">
              Milestone
              <Select
                value={filters.milestoneId ?? ''}
                onChange={(e) => set({ milestoneId: e.target.value || undefined })}
                className="mt-1 h-9 py-1 text-sm"
              >
                <option value="">Any or none</option>
                {milestones?.map((m) => (
                  <option key={m.id} value={m.id}>
                    ⚑ {m.title}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="paper rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <Core state="ready" size={56} />
              <p className="eyebrow">not sure where to start?</p>
            </div>
            <div className="mt-3">
              <Segmented
                size="sm"
                label="Prompt topic"
                value={promptGroup}
                onChange={setPromptGroup}
                options={[
                  { value: 'period', label: 'Times' },
                  { value: 'people', label: 'People' },
                  { value: 'place', label: 'Places' },
                  { value: 'emotion', label: 'Feelings' },
                ]}
              />
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {prompts?.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/capture?prompt=${encodeURIComponent(p.text)}`}
                    viewTransition
                    className="block rounded-xl px-2 py-1.5 font-display hover:bg-cream"
                  >
                    {p.text}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-1 inline-flex items-center gap-1 px-2 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              <Shuffle className="size-3" /> Different ones
            </button>
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-semibold text-ink-soft" aria-live="polite">
              {isFetching && !results
                ? 'Searching…'
                : `${results?.length ?? 0} ${results?.length === 1 ? 'memory' : 'memories'}`}
            </p>
            {results && results.length > 0 && (
              <button
                type="button"
                aria-pressed={recapping}
                onClick={() => setRecapping((r) => !r)}
                className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition ${recapping ? 'bg-snow text-abyss' : 'text-ink-soft hover:bg-white/8 hover:text-ink'}`}
              >
                Recap these
              </button>
            )}
            {results && results.length > 1 && <SelectToCompare selection={selection} />}
          </div>
          {recapping && results && results.length > 0 && (
            <RecapPanel
              className="mb-5"
              label={text.trim() ? `Memories about “${text.trim()}”` : 'These memories'}
              memoryIds={results.map((m) => m.id)}
              quietCount={results.filter((m) => m.sensitive).length}
            />
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {results?.map((m, i) => (
              <MemoryCard
                key={m.id}
                memory={m}
                index={i}
                selectable={selection.active}
                selected={selection.ids.includes(m.id)}
                onSelect={() => selection.toggle(m.id)}
              />
            ))}
          </div>
          <CompareTray selection={selection} />
          {results && !results.length && (
            <p className="paper rounded-3xl p-8 text-center text-ink-soft">
              Nothing matches. Try fewer filters, or a different word.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
