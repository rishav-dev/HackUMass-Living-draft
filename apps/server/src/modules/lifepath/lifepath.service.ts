import type {
  AgeNodeDto,
  ChapterDto,
  DayDto,
  LifePathDto,
  MemoryCardDto,
  PlaybackDto,
  PlaybackSceneDto,
  Season,
} from '@living-draft/contracts';
import {
  chapterDateRange,
  chapterRecap,
  chapterTitle,
  detectMotifs,
  monthsForSeason,
  splitSentences,
} from '@living-draft/engine';
import { HttpError, notFound } from '../../lib/http';
import { Archive, sortChronologically } from '../archive/snapshot';
import { dayMemoryIds, findArt } from '../art/art.service';
import { cachedDayWeather } from '../weather/weather.service';

const FUTURE_CHAPTERS = 3;

function countTop(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function cardsAtAge(archive: Archive, age: number): MemoryCardDto[] {
  return archive.cards().filter((card) => card.temporal.placedAges.includes(age));
}

function milestonesAt(archive: Archive, age: number) {
  return archive.milestones
    .filter(
      (m) =>
        m.age_min !== null &&
        m.age_min <= age &&
        (m.age_max ?? m.age_min) >= age &&
        (m.age_max ?? m.age_min) - m.age_min <= 2,
    )
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title))
    .map((m) => ({ id: m.id, title: m.title, date: m.date }));
}

export function lifePath(): LifePathDto {
  const archive = Archive.load();
  const { profile } = archive;
  const cards = archive.cards();
  const ages: AgeNodeDto[] = [];

  for (let age = 0; age <= profile.currentAge; age += 1) {
    const atAge = cards.filter((c) => c.temporal.placedAges.includes(age));
    const cover = atAge.find((c) => c.cover)?.cover ?? null;
    ages.push({
      age,
      title: chapterTitle(age),
      dateRange: chapterDateRange(profile.birthDate, age),
      memoryCount: atAge.length,
      uncertainCount: atAge.filter((c) => c.temporal.certainty !== 'certain').length,
      milestones: milestonesAt(archive, age),
      cover,
      topEmotions: countTop(
        atAge.flatMap((c) => c.emotions.filter((e) => e.phase === 'then').map((e) => e.tag)),
        3,
      ),
      people: countTop(
        atAge.flatMap((c) => c.people.map((p) => p.name)),
        3,
      ),
      seasons: [...new Set(atAge.map((c) => c.temporal.season).filter((s): s is Season => !!s))],
      connectionCount: atAge.reduce((sum, c) => sum + c.connectionTypes.length, 0),
    });
  }

  const today = new Date();
  const onThisDay = cards.filter(
    (c) =>
      !c.sensitive &&
      c.temporal.precision === 'exact' &&
      c.temporal.month === today.getMonth() + 1 &&
      c.temporal.day === today.getDate(),
  );
  const provisional = new Set(archive.characters.filter((c) => c.provisional).map((c) => c.id));

  return {
    profile,
    ages,
    future: Array.from({ length: FUTURE_CHAPTERS }, (_, i) => profile.currentAge + i + 1),
    unplacedCount: cards.filter((c) => c.temporal.certainty === 'unplaced').length,
    needsReviewCount: cards.filter(
      (c) =>
        c.reviewStatus === 'needs_review' || c.people.some((p) => provisional.has(p.characterId)),
    ).length,
    totalMemories: cards.length,
    onThisDay,
  };
}

export function chapter(age: number): ChapterDto {
  const archive = Archive.load();
  const { profile } = archive;
  if (age < 0 || age > profile.currentAge)
    throw new HttpError(400, 'That chapter has not been written yet');

  const memories = sortChronologically(cardsAtAge(archive, age)).map((card) => ({
    ...card,
    sharedWith: card.temporal.placedAges.filter((a) => a !== age),
  }));

  const characterCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const card of memories) {
    for (const person of card.people) {
      const entry = characterCounts.get(person.characterId) ?? {
        id: person.characterId,
        name: person.name,
        count: 0,
      };
      entry.count += 1;
      characterCounts.set(person.characterId, entry);
    }
  }

  const ids = new Set(memories.map((m) => m.id));
  const confirmedConnections = archive.connections.filter(
    (c) => c.status === 'confirmed' && archive.connectionMemoryIds(c.id).some((id) => ids.has(id)),
  ).length;
  const milestones = milestonesAt(archive, age);
  const title = chapterTitle(age);

  return {
    age,
    title,
    dateRange: chapterDateRange(profile.birthDate, age),
    recap: chapterRecap({
      label: title,
      memories: memories.map((m) => ({
        title: m.title,
        season: m.temporal.season,
        month: m.temporal.month,
        approximate: m.temporal.certainty !== 'certain',
        people: m.people.map((p) => p.name),
      })),
      characterCount: characterCounts.size,
      milestoneCount: milestones.length,
      connectionCount: confirmedConnections,
      knownSeasons: profile.hemisphere === 'north' || profile.hemisphere === 'south',
    }),
    memories,
    characters: [...characterCounts.values()].sort((a, b) => b.count - a.count),
    milestones,
    hemisphere: profile.hemisphere,
    previousAge: age > 0 ? age - 1 : null,
    nextAge: age < profile.currentAge ? age + 1 : null,
  };
}

function dateOf(t: {
  precision: string;
  year: number | null;
  month: number | null;
  day: number | null;
}): string | null {
  if (t.precision !== 'exact' || !t.year || !t.month || !t.day) return null;
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

function scene(archive: Archive, id: string, art: Map<string, string>): PlaybackSceneDto {
  const card = archive.card(id);
  const media = archive.media(id);
  const text = archive.text(id);
  return {
    memoryId: id,
    title: card.title,
    when: card.temporal.label,
    certainty: card.temporal.certainty,
    season:
      card.temporal.season ?? seasonFromMonth(card.temporal.month, archive.profile.hemisphere),
    paragraphs: text
      .split(/\n{2,}/)
      .flatMap((p) => splitSentences(p).map((s) => s.text))
      .filter(Boolean),
    photos: media.filter((m) => m.kind === 'photo' || m.kind === 'scan'),
    videos: media.filter((m) => m.kind === 'video'),
    audio: media.filter((m) => m.kind === 'audio'),
    people: card.people.map((p) => p.name),
    emotions: card.emotions.map((e) => e.tag),
    feelings: card.emotions.map((e) => ({ tag: e.tag, phase: e.phase })),
    motifs: detectMotifs(`${card.title} ${text}`),
    artKey: `memory:${id}`,
    artUrl: art.get(`memory:${id}`) ?? null,
    sensitive: card.sensitive,
    date: dateOf(card.temporal),
    weather: cachedDayWeather(id),
    connections: archive
      .connectionsFor(id)
      .filter((c) => c.status === 'confirmed')
      .flatMap((c) => {
        const dto = archive.connectionDto(c);
        return dto.endpoints
          .filter((e) => e.nodeType === 'memory' && e.nodeId !== id)
          .map((e) => ({
            memoryId: e.nodeId,
            title: e.title,
            type: c.type,
            label: dto.label,
            explanation: c.explanation,
          }));
      }),
  };
}

function scenes(archive: Archive, ids: string[]): PlaybackSceneDto[] {
  const art = findArt([...ids.map((id) => `memory:${id}`)]);
  return ids.map((id) => scene(archive, id, art));
}

export function days(): DayDto[] {
  const archive = Archive.load();
  const groups = new Map<string, string[]>();
  for (const memory of archive.memories) {
    const date = dateOf(archive.temporal(memory.id));
    if (!date) continue;
    groups.set(date, [...(groups.get(date) ?? []), memory.id]);
  }
  const keys = [...groups.keys()].map((d) => `day:${d}`);
  const art = findArt(keys);
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ids]) => {
      const cards = archive.cards(ids);
      const texts = ids.map((id) => `${archive.memory(id)!.title} ${archive.text(id)}`).join(' ');
      return {
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        age: cards[0]?.temporal.ageMin ?? null,
        count: ids.length,
        memories: cards.map((c) => ({
          id: c.id,
          title: c.title,
          emotions: c.emotions.map((e) => e.tag),
        })),
        emotions: [...new Set(cards.flatMap((c) => c.emotions.map((e) => e.tag)))],
        motifs: detectMotifs(texts),
        artKey: `day:${date}`,
        artUrl: art.get(`day:${date}`) ?? null,
        cover: cards.find((c) => c.cover)?.cover ?? null,
      };
    });
}

function seasonFromMonth(month: number | null, hemisphere: string): Season | null {
  if (!month || (hemisphere !== 'north' && hemisphere !== 'south')) return null;
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
    if (monthsForSeason(season, hemisphere).includes(month)) return season;
  }
  return null;
}

export function playback(options: {
  age?: number;
  memoryId?: string;
  characterId?: string;
  date?: string;
}): PlaybackDto {
  const archive = Archive.load();
  if (options.date) {
    const ids = sortChronologically(archive.cards(dayMemoryIds(archive, options.date))).map(
      (c) => c.id,
    );
    if (!ids.length) throw notFound('Day');
    return {
      title: new Date(`${options.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      subtitle: `${ids.length} ${ids.length === 1 ? 'moment' : 'moments'} on this day`,
      scenes: scenes(archive, ids),
    };
  }
  if (options.memoryId) {
    if (!archive.memory(options.memoryId)) throw notFound('Memory');
    const card = archive.card(options.memoryId);
    return {
      title: card.title,
      subtitle: card.temporal.label,
      scenes: scenes(archive, [options.memoryId]),
    };
  }
  if (options.characterId) {
    const character = archive.character(options.characterId);
    if (!character) throw notFound('Person');
    const cards = sortChronologically(
      archive.cards().filter((c) => c.people.some((p) => p.characterId === options.characterId)),
    );
    return {
      title: `With ${character.name}`,
      subtitle: `${cards.length} memories`,
      scenes: scenes(
        archive,
        cards.map((c) => c.id),
      ),
    };
  }
  if (options.age !== undefined) {
    const cards = sortChronologically(cardsAtAge(archive, options.age));
    return {
      title: chapterTitle(options.age),
      subtitle: `Age ${options.age}`,
      scenes: scenes(
        archive,
        cards.map((c) => c.id),
      ),
    };
  }
  const cards = sortChronologically(
    archive.cards().filter((c) => c.temporal.certainty !== 'unplaced'),
  );
  return {
    title: `${archive.profile.preferredName}'s story`,
    subtitle: 'From the beginning',
    scenes: scenes(
      archive,
      cards.map((c) => c.id),
    ),
  };
}
