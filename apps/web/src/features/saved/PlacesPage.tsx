import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, List, Map as MapIcon, MapPin } from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useMemories } from '../../api/hooks';
import { CertaintyMark, EmotionRow, Portrait } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/controls';
import { PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { useScene } from '../../lib/sound/SoundProvider';
import { readLocal, writeLocal } from '../../lib/storage';
import { PlacePanel } from '../places/PlacePanel';
import { usePlacesMap, type PlaceCluster } from '../places/placeMap';

const PlacesGlobe = lazy(() => import('../places/PlacesGlobe'));
const PlacesFlatMap = lazy(() => import('../places/PlacesFlatMap'));

type View = 'globe' | 'map' | 'list';

interface PlaceSummary {
  id: string;
  name: string;
  kind: string | null;
  count: number;
}

interface PlaceDetail {
  id: string;
  name: string;
  kind: string | null;
  memories: MemoryCardDto[];
  people: Array<{ id: string; name: string; count: number }>;
  ages: { from: number; to: number } | null;
}

export function PlacesPage() {
  useScene('studio');
  const client = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['places'],
    queryFn: () => api.get<PlaceSummary[]>('/places'),
  });
  const { data: map } = usePlacesMap();
  const { data: memories } = useMemories({});
  const [view, setView] = useState<View>(() => {
    const saved = readLocal('places-view');
    return saved === 'map' || saved === 'list' ? saved : 'globe';
  });
  const [selected, setSelected] = useState<PlaceCluster | null>(null);
  const [locating, setLocating] = useState(false);
  const cards = useMemo(() => new Map((memories ?? []).map((m) => [m.id, m])), [memories]);
  if (isLoading || !data) return <PaperLoading />;

  const choose = (next: View) => {
    setView(next);
    setSelected(null);
    writeLocal('places-view', next);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const result = await api.post<{ found: number; notFound: string[] }>('/places/locate');
      await client.invalidateQueries({ queryKey: ['places'] });
      toast(
        result.notFound.length
          ? `Found ${result.found}. Couldn't find ${result.notFound.join(', ')}.`
          : `Found ${result.found === 1 ? 'it' : `all ${result.found}`}.`,
      );
    } catch {
      toast("Couldn't reach the place search. Check the connection and try again.");
    } finally {
      setLocating(false);
    }
  };

  const unplaced = map?.unplaced ?? [];

  return (
    <div className="mx-auto max-w-[96rem] px-3 pb-16 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 px-2">
        <div>
          <p className="eyebrow">where it happened</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">Places</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Every town, school and place your memories mention. Each light is somewhere you
            remember; open it to see what happened there and who was with you.
          </p>
        </div>
        <Segmented
          label="How to show your places"
          value={view}
          onChange={choose}
          options={[
            {
              value: 'globe',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="size-4" /> Globe
                </span>
              ),
            },
            {
              value: 'map',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <MapIcon className="size-4" /> Map
                </span>
              ),
            },
            {
              value: 'list',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <List className="size-4" /> List
                </span>
              ),
            },
          ]}
        />
      </div>

      {unplaced.length > 0 && view !== 'list' && (
        <div className="paper mx-2 mt-5 flex flex-wrap items-center gap-3 rounded-3xl px-5 py-3 text-sm">
          <MapPin className="size-4 shrink-0 text-gold-deep" />
          <p className="flex-1">
            {unplaced.length === 1
              ? `${unplaced[0]!.name} isn't on the map yet.`
              : `${unplaced.length} places aren't on the map yet: ${unplaced.map((p) => p.name).join(', ')}.`}{' '}
            <span className="text-ink-soft">
              Finding them sends only the place names to Open-Meteo's free place search.
            </span>
          </p>
          <Button size="sm" variant="soft" disabled={locating} onClick={() => void locate()}>
            {locating ? 'Looking…' : 'Find them on the map'}
          </Button>
        </div>
      )}

      {data.length === 0 ? (
        <p className="mt-8 px-2 text-ink-soft">
          No places yet. They show up when a memory names where it happened.
        </p>
      ) : view === 'list' ? (
        <ul className="mt-8 grid gap-4 px-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((place) => (
            <li key={place.id}>
              <Link
                to={`/places/${place.id}`}
                viewTransition
                className="paper flex items-center gap-3 rounded-3xl p-5 transition hover:-translate-y-0.5"
              >
                <MapPin className="size-6 shrink-0 text-gold-deep" />
                <span>
                  <span className="block font-display text-xl font-semibold">{place.name}</span>
                  <span className="text-sm text-ink-soft">
                    {place.count} {place.count === 1 ? 'memory' : 'memories'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative mt-5 h-[calc(100dvh-15rem)] min-h-[26rem] overflow-hidden rounded-3xl border border-white/8 bg-[radial-gradient(ellipse_at_50%_45%,#1c1726_0%,#0b0910_70%)]">
          <Suspense fallback={<PaperLoading label="Finding your places…" />}>
            {view === 'globe' ? (
              <PlacesGlobe
                places={map?.placed ?? []}
                cards={cards}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <PlacesFlatMap
                places={map?.placed ?? []}
                cards={cards}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </Suspense>
          <p className="pointer-events-none absolute left-4 top-3 text-xs font-semibold text-ink-faint">
            {view === 'globe'
              ? 'Drag to turn · scroll or pinch to zoom'
              : 'Drag to move · scroll or pinch to zoom'}
          </p>
          {selected && (
            <PlacePanel cluster={selected} cards={cards} onClose={() => setSelected(null)} />
          )}
        </div>
      )}
    </div>
  );
}

export default function PlacePage() {
  const { id = '' } = useParams();
  useScene('studio');
  const { data, isLoading } = useQuery({
    queryKey: ['place', id],
    queryFn: () => api.get<PlaceDetail>(`/places/${id}`),
  });
  if (isLoading || !data) return <PaperLoading />;
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8">
      <Link to="/places" className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← All places
      </Link>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold sm:text-5xl">
        <MapPin className="size-8 text-gold-deep" /> {data.name}
      </h1>
      <p className="mt-2 text-ink-soft">
        {data.memories.length} {data.memories.length === 1 ? 'memory' : 'memories'}
        {data.ages
          ? data.ages.from === data.ages.to
            ? `, around age ${data.ages.from}`
            : `, from age ${data.ages.from} to ${data.ages.to}`
          : ''}
        .
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_16rem]">
        <ul className="flex flex-col gap-4">
          {data.memories.map((m) => (
            <li key={m.id}>
              <Link
                to={`/memories/${m.id}`}
                viewTransition
                className="paper block rounded-3xl p-5 transition hover:-translate-y-0.5"
              >
                <CertaintyMark temporal={m.temporal} compact />
                <p className="mt-2 font-display text-xl font-semibold">{m.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{m.summary ?? m.excerpt}</p>
                <div className="mt-3">
                  <EmotionRow emotions={m.emotions.slice(0, 4)} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {data.people.length > 0 && (
          <aside>
            <p className="eyebrow">people here</p>
            <ul className="mt-3 flex flex-col gap-2">
              {data.people.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/people/${p.id}`}
                    className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-ink/5"
                  >
                    <Portrait name={p.name} size={28} />
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-auto text-xs text-ink-soft">{p.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
