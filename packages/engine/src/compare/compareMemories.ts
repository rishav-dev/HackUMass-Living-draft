import { TermIndex } from '../retrieval/index';
import { sentenceAt } from '../text/sentences';
import { valence } from '../emotions/detect';
import { suggestConnections } from '../connections/suggest';
import type { ConnectionSuggestion, MemoryDoc } from '../types';

export interface ComparedPerson {
  characterId: string;
  name: string;
  roles: Array<{ memoryId: string; role: string | null }>;
}

export interface MemoryComparison {
  memoryIds: string[];
  sharedPeople: ComparedPerson[];
  onlyIn: Array<{ memoryId: string; people: string[]; terms: string[] }>;
  sharedTerms: Array<{
    term: string;
    quotes: Array<{ memoryId: string; quote: string; start: number; end: number }>;
  }>;
  emotions: Array<{ memoryId: string; then: string[]; now: string[] }>;
  timeline: Array<{ memoryId: string; ageMin: number | null; ageMax: number | null }>;
  summary: string[];
  suggestions: ConnectionSuggestion[];
}

function ageText(m: MemoryDoc): string {
  if (m.ageMin === null) return 'an unknown age';
  if (m.ageMax === null || m.ageMin === m.ageMax) return `age ${m.ageMin}`;
  return `age ${m.ageMin}–${m.ageMax}`;
}

export function compareMemories(memories: MemoryDoc[], question?: string): MemoryComparison {
  const index = new TermIndex(memories.map((m) => ({ id: m.id, text: m.text })));
  const docs = memories.map((m) => index.doc(m.id)!);

  const termCounts = new Map<string, number>();
  for (const doc of docs)
    for (const term of doc.terms) termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  const sharedStems = [...termCounts.entries()]
    .filter(([, count]) => count >= Math.min(2, memories.length) && count >= 2)
    .sort((a, b) => b[1] - a[1] || index.idf(b[0]) - index.idf(a[0]))
    .slice(0, 6)
    .map(([term]) => term);

  const sharedTerms = sharedStems.map((stemmed) => {
    const surface = index.surface(stemmed);
    return {
      term: surface,
      quotes: memories
        .filter((m) => index.doc(m.id)!.terms.has(stemmed))
        .map((m) => {
          const at = m.text
            .toLowerCase()
            .indexOf(surface.slice(0, Math.max(3, surface.length - 2)));
          const sentence = sentenceAt(m.text, Math.max(0, at));
          return { memoryId: m.id, quote: sentence.text, start: sentence.start, end: sentence.end };
        }),
    };
  });

  const people = new Map<string, ComparedPerson>();
  for (const memory of memories) {
    for (const person of memory.people) {
      const entry = people.get(person.characterId) ?? {
        characterId: person.characterId,
        name: person.name,
        roles: [],
      };
      entry.roles.push({ memoryId: memory.id, role: person.role });
      people.set(person.characterId, entry);
    }
  }
  const sharedPeople = [...people.values()].filter((p) => p.roles.length >= 2);
  for (const person of sharedPeople) {
    for (const memory of memories) {
      if (!person.roles.some((r) => r.memoryId === memory.id))
        person.roles.push({ memoryId: memory.id, role: null });
    }
  }

  const sharedSet = new Set(sharedStems);
  const onlyIn = memories.map((memory) => ({
    memoryId: memory.id,
    people: memory.people
      .filter((p) => !sharedPeople.some((s) => s.characterId === p.characterId))
      .map((p) => p.name),
    terms: [...index.doc(memory.id)!.terms]
      .filter((t) => !sharedSet.has(t) && termCounts.get(t) === 1)
      .sort((a, b) => index.idf(b) - index.idf(a))
      .slice(0, 5)
      .map((t) => index.surface(t)),
  }));

  const emotions = memories.map((m) => ({
    memoryId: m.id,
    then: m.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
    now: m.emotions.filter((e) => e.phase === 'now').map((e) => e.tag),
  }));

  const ordered = [...memories].sort((a, b) => (a.ageMin ?? 999) - (b.ageMin ?? 999));
  const summary: string[] = [];
  const lower = (question ?? '').toLowerCase();

  if (sharedPeople.length) {
    const roleNotes = sharedPeople.map((p) => {
      const roles = p.roles.map((r) => r.role ?? 'absent');
      const same = roles.every((r) => r === roles[0]);
      return same
        ? `${p.name} is ${roles[0]} in each`
        : `${p.name} goes from ${roles.join(' to ')}`;
    });
    summary.push(`Shared people: ${roleNotes.join('; ')}.`);
  } else {
    summary.push('These memories don’t share any people.');
  }

  if (sharedTerms.length)
    summary.push(`Common ground: ${sharedTerms.map((t) => `“${t.term}”`).join(', ')}.`);
  else summary.push('They don’t have much wording in common.');

  if (ordered.length >= 2) {
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const firstTags = emotions.find((e) => e.memoryId === first.id)!.then;
    const lastTags = emotions.find((e) => e.memoryId === last.id)!.then;
    if (firstTags.length || lastTags.length) {
      const shift = valence(lastTags) - valence(firstTags);
      const how = shift > 0.3 ? 'lighter' : shift < -0.3 ? 'heavier' : 'similar';
      summary.push(
        `Feelings: ${ageText(first)} you tagged ${firstTags.join(', ') || 'nothing'}; ${ageText(last)}, ${lastTags.join(', ') || 'nothing'}. The later one reads ${how}.`,
      );
    }
  }

  const suggestions = suggestConnections(memories, { limit: 4 });
  if (/full.circle/.test(lower) && !suggestions.some((s) => s.type === 'full_circle')) {
    summary.push(
      'I don’t see a clear full-circle shape here, but you can still link them yourself if it feels like one.',
    );
  }
  if (suggestions.length) summary.push(`Possible link: ${suggestions[0]!.explanation}`);

  return {
    memoryIds: memories.map((m) => m.id),
    sharedPeople,
    onlyIn,
    sharedTerms,
    emotions,
    timeline: memories.map((m) => ({ memoryId: m.id, ageMin: m.ageMin, ageMax: m.ageMax })),
    summary,
    suggestions,
  };
}

export const COMPARE_QUESTIONS = [
  'What do these have in common?',
  'How are the outcomes different?',
  'What changed for the people in them?',
  'What was the emotional difference?',
  'Do these form a full-circle moment?',
];
