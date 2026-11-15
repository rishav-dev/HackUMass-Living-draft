import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, MapPin, X } from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { CertaintyMark, EmotionRow, Portrait } from '../../components/memory/bits';
import { plural } from '../../lib/format';
import type { MapPlace, PlaceCluster } from './placeMap';

function ages(memories: MemoryCardDto[]) {
  const all = memories
    .flatMap((m) => [m.temporal.ageMin, m.temporal.ageMax])
    .filter((a): a is number => a !== null);
  if (!all.length) return null;
  const from = Math.min(...all);
  const to = Math.max(...all);
  return from === to ? `around age ${from}` : `from age ${from} to ${to}`;
}

function PlaceSection({
  place,
  cards,
  open,
  onToggle,
  single,
}: {
  place: MapPlace;
  cards: Map<string, MemoryCardDto>;
  open: boolean;
  onToggle: () => void;
  single: boolean;
}) {
  const memories = place.memoryIds
    .map((id) => cards.get(id))
    .filter((m): m is MemoryCardDto => Boolean(m))
    .sort((a, b) => (a.temporal.ageMin ?? 999) - (b.temporal.ageMin ?? 999));
  const people = new Map<string, { id: string; name: string; count: number }>();
  for (const memory of memories)
    for (const person of memory.people) {
      const entry = people.get(person.characterId) ?? {
        id: person.characterId,
        name: person.name,
        count: 0,
      };
      entry.count += 1;
      people.set(person.characterId, entry);
    }
  const span = ages(memories);
  const where = [place.region, place.country].filter(Boolean).join(', ');

  return (
    <section className={single ? '' : 'rounded-2xl bg-white/4'}>
      {!single && (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        >
          <MapPin className="size-4 shrink-0 text-gold-deep" />
          <span className="flex-1 font-semibold">{place.name}</span>
          <span className="text-xs text-ink-soft">
            {plural(memories.length, 'memory', 'memories')}
          </span>
          <ChevronDown className={`size-4 text-ink-soft transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && (
        <div className={single ? '' : 'px-3 pb-3'}>
          <p className="text-sm text-ink-soft">
            {plural(memories.length, 'memory', 'memories')}
            {span ? `, ${span}` : ''}
            {where && single ? ` · ${where}` : ''}
          </p>
          {people.size > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...people.values()]
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((p) => (
                  <Link
                    key={p.id}
                    to={`/people/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/6 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold hover:bg-white/12"
                  >
                    <Portrait name={p.name} size={22} />
                    {p.name}
                  </Link>
                ))}
            </div>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {memories.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/memories/${m.id}`}
                  viewTransition
                  className="block rounded-2xl bg-white/5 p-3 transition hover:bg-white/10"
                >
                  <CertaintyMark temporal={m.temporal} compact />
                  <p className="mt-1.5 font-display text-lg font-semibold leading-snug">
                    {m.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                    {m.summary ?? m.excerpt}
                  </p>
                  <div className="mt-2">
                    <EmotionRow emotions={m.emotions.slice(0, 3)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to={`/places/${place.id}`}
            viewTransition
            className="mt-3 inline-block text-sm font-semibold text-lavender-deep hover:underline"
          >
            Everything about {place.name.split(',')[0]} →
          </Link>
        </div>
      )}
    </section>
  );
}

export function PlacePanel({
  cluster,
  cards,
  onClose,
  onCloser,
}: {
  cluster: PlaceCluster;
  cards: Map<string, MemoryCardDto>;
  onClose: () => void;
  onCloser?: () => void;
}) {
  const single = cluster.places.length === 1;
  const [open, setOpen] = useState<string | null>(cluster.places[0]?.id ?? null);
  return (
    <div className="absolute bottom-3 right-3 top-3 z-20 flex w-[min(23rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151219]/96 shadow-2xl">
      <div className="flex items-start gap-3 border-b border-white/8 p-5 pb-4">
        <div className="flex-1">
          <p className="eyebrow">{single ? 'memories from here' : 'close together'}</p>
          <h2 className="font-display text-2xl font-semibold leading-tight">
            {single ? cluster.places[0]!.name : `${cluster.places.length} places`}
          </h2>
          {!single && (
            <p className="mt-1 text-sm text-ink-soft">
              {plural(cluster.count, 'memory', 'memories')} in{' '}
              {cluster.places.map((p) => p.name.split(',')[0]).join(', ')}.
              {onCloser && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onCloser}
                    className="font-semibold text-lavender-deep hover:underline"
                  >
                    Zoom in to separate them
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-soft hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {cluster.places.map((place) => (
            <PlaceSection
              key={place.id}
              place={place}
              cards={cards}
              single={single}
              open={single || open === place.id}
              onToggle={() => setOpen(open === place.id ? null : place.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
