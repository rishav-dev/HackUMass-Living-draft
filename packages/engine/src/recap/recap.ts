import { countPhrase, numberToWords } from '../text/numbers';

export function chapterTitle(age: number): string {
  return `Chapter ${numberToWords(age)}`;
}

export interface RecapInput {
  label: string;
  memories: Array<{
    title: string;
    season: string | null;
    month: number | null;
    approximate: boolean;
    people: string[];
  }>;
  characterCount: number;
  milestoneCount: number;
  connectionCount: number;
  knownSeasons: boolean;
}

export function chapterRecap(input: RecapInput): string[] {
  const { memories } = input;
  if (!memories.length) {
    return [
      `${input.label} is still blank. Nothing has to go here, but if a memory from this time comes back to you, this is where it lives.`,
    ];
  }

  const parts = [
    countPhrase(memories.length, 'memory', 'memories'),
    input.characterCount ? countPhrase(input.characterCount, 'person', 'people') : null,
    input.milestoneCount ? countPhrase(input.milestoneCount, 'milestone') : null,
    input.connectionCount ? countPhrase(input.connectionCount, 'confirmed connection') : null,
  ].filter((p): p is string => !!p);
  const listed =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
      : parts[0]!;
  const lines = [`${input.label} has ${listed}.`];

  const peopleCounts = new Map<string, number>();
  for (const memory of memories)
    for (const name of memory.people) peopleCounts.set(name, (peopleCounts.get(name) ?? 0) + 1);
  const top = [...peopleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2)
    lines.push(`${top[0]} shows up most, in ${countPhrase(top[1], 'memory', 'memories')}.`);

  const seasonCounts = new Map<string, number>();
  for (const memory of memories)
    if (memory.season) seasonCounts.set(memory.season, (seasonCounts.get(memory.season) ?? 0) + 1);
  const busiest = [...seasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest && memories.length > 1)
    lines.push(`${busiest[0].charAt(0).toUpperCase()}${busiest[0].slice(1)} has the most pages.`);
  if (input.knownSeasons) {
    const empty = ['spring', 'summer', 'autumn', 'winter'].filter((s) => !seasonCounts.has(s));
    if (empty.length && empty.length < 4) lines.push(`Nothing yet for ${empty.join(', ')}.`);
  }

  const loose = memories.filter((m) => m.approximate).length;
  if (loose)
    lines.push(
      `${loose === 1 ? 'One memory is' : `${numberToWords(loose)} memories are`} loosely dated.`,
    );
  return lines;
}

export interface CollectionRecapInput {
  label: string;
  memories: Array<{
    title: string;
    ages: number[];
    season: string | null;
    approximate: boolean;
    people: string[];
    feelingsThen: string[];
    feelingsNow: string[];
    sensitive: boolean;
  }>;
  connectionCount: number;
  includeQuiet: boolean;
  focusPeople?: string[];
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function topCounts(values: string[], limit: number): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function collectionRecap(input: CollectionRecapInput): string[] {
  const quiet = input.memories.filter((m) => m.sensitive);
  const memories = input.includeQuiet ? input.memories : input.memories.filter((m) => !m.sensitive);
  if (!memories.length) {
    return quiet.length
      ? [
          `${input.label}: ${countPhrase(quiet.length, 'memory is', 'memories are')} kept quiet, so there's nothing to summarize unless you ask for them.`,
        ]
      : [`${input.label} has nothing recorded yet. Nothing here is missing; it's just unwritten.`];
  }

  const lines: string[] = [];
  const ages = [...new Set(memories.flatMap((m) => m.ages))].sort((a, b) => a - b);
  const span =
    ages.length === 0
      ? 'none of them placed in time yet'
      : ages.length === 1
        ? `all around age ${ages[0]}`
        : `from age ${ages[0]} to ${ages[ages.length - 1]}`;
  lines.push(`${input.label}: ${countPhrase(memories.length, 'memory', 'memories')}, ${span}.`);

  if (ages.length > 1) {
    const gaps: string[] = [];
    for (let i = 1; i < ages.length; i += 1) {
      const from = ages[i - 1]!;
      const to = ages[i]!;
      if (to - from >= 3) gaps.push(`${from + 1}–${to - 1}`);
    }
    if (gaps.length) lines.push(`Nothing is recorded yet for ages ${joinList(gaps.slice(0, 3))}.`);
  }

  const focus = new Set((input.focusPeople ?? []).map((name) => name.toLowerCase()));
  const people = topCounts(
    memories.flatMap((m) => m.people).filter((name) => !focus.has(name.toLowerCase())),
    3,
  ).filter(([, n]) => n >= 2);
  if (people.length)
    lines.push(
      `${focus.size ? 'Also there most often' : 'Who comes up most'}: ${joinList(people.map(([name, n]) => `${name} (${countPhrase(n, 'memory', 'memories')})`))}.`,
    );

  const then = topCounts(
    memories.flatMap((m) => m.feelingsThen),
    3,
  );
  const now = topCounts(
    memories.flatMap((m) => m.feelingsNow),
    2,
  );
  if (then.length)
    lines.push(`Feelings you named at the time: ${joinList(then.map(([tag]) => tag))}.`);
  if (now.length)
    lines.push(`Looking back now, you described feeling ${joinList(now.map(([tag]) => tag))}.`);

  const seasons = topCounts(
    memories.map((m) => m.season).filter((s): s is string => !!s),
    1,
  );
  if (seasons[0] && seasons[0][1] >= 2 && memories.length > 2)
    lines.push(
      `${seasons[0][0].charAt(0).toUpperCase()}${seasons[0][0].slice(1)} comes up more than any other season.`,
    );

  if (input.connectionCount)
    lines.push(
      `${countPhrase(input.connectionCount, 'confirmed thread')} ${input.connectionCount === 1 ? 'ties' : 'tie'} these to other memories.`,
    );

  const loose = memories.filter((m) => m.approximate).length;
  if (loose)
    lines.push(
      `${loose === 1 ? 'One is' : `${numberToWords(loose)} are`} dated loosely, so the order is a best guess.`,
    );

  if (!input.includeQuiet && quiet.length)
    lines.push(
      `${countPhrase(quiet.length, 'memory', 'memories')} kept quiet ${quiet.length === 1 ? "isn't" : "aren't"} included here.`,
    );
  return lines;
}
