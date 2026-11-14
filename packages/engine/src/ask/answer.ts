import { DIFFICULT_EMOTIONS, POSITIVE_EMOTIONS, valence } from '../emotions/detect';
import { TermIndex } from '../retrieval/index';
import { sentenceAt } from '../text/sentences';
import type { Citation, GroundedAnswer, MemoryDoc } from '../types';

export interface AskContext {
  memories: Array<MemoryDoc & { changeKinds?: string[] }>;
  connections: Array<{ type: string; memoryIds: string[]; explanation: string; status: string }>;
  characters: Array<{ id: string; name: string; aliases: string[] }>;
}

export interface AskScope {
  characterId?: string;
  emotion?: string;
  ageMin?: number;
  ageMax?: number;
  centralOnly?: boolean;
  memoryIds?: string[];
  includeDifficult?: boolean;
}

const TOPIC_TERMS: Record<string, string[]> = {
  authority: [
    'teacher',
    'principal',
    'boss',
    'coach',
    'rule',
    'rules',
    'allowed',
    'punished',
    'grounded',
    'manager',
    'told me to',
    'in trouble',
    'parents',
    'police',
    'mom',
    'dad',
  ],
  confidence: [
    'confident',
    'confidence',
    'proud',
    'brave',
    'scared',
    'nervous',
    'stage',
    'spoke up',
    'believed in me',
    'performed',
    'won',
    'failed',
    'tried',
  ],
  wishes: [
    'wish',
    'wished',
    'dream',
    'dreamed',
    'hoped',
    'wanted to',
    'someday',
    'one day',
    'finally',
    'came true',
  ],
};

function ageLabel(memory: MemoryDoc): string {
  if (memory.ageMin === null) return 'date unknown';
  if (memory.ageMax === null) return `${memory.ageMin}+`;
  return memory.ageMin === memory.ageMax
    ? `age ${memory.ageMin}`
    : `age ${memory.ageMin}–${memory.ageMax}`;
}

function byAge(a: MemoryDoc, b: MemoryDoc): number {
  return (a.ageMin ?? 999) - (b.ageMin ?? 999);
}

function cite(memory: MemoryDoc, offset = 0): Citation {
  const sentence = sentenceAt(memory.text, offset);
  return {
    memoryId: memory.id,
    title: memory.title,
    quote: sentence.text,
    start: sentence.start,
    end: sentence.end,
    ageLabel: ageLabel(memory),
  };
}

function citeTerms(memory: MemoryDoc, terms: string[]): Citation {
  const lower = memory.text.toLowerCase();
  for (const term of terms) {
    const at = lower.indexOf(term.toLowerCase());
    if (at >= 0) return cite(memory, at);
  }
  return cite(memory);
}

function emotionWords(tags: string[]): string {
  const unique = [...new Set(tags)];
  if (!unique.length) return 'no feelings tagged';
  if (unique.length === 1) return unique[0]!;
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

function gaps(memories: MemoryDoc[]): string[] {
  const ages = memories
    .map((m) => m.ageMin)
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  const notes: string[] = [];
  for (let i = 1; i < ages.length; i += 1) {
    if (ages[i]! - ages[i - 1]! >= 4)
      notes.push(`Nothing recorded between ${ages[i - 1]! + 1} and ${ages[i]! - 1}.`);
  }
  return notes;
}

function applyScope(context: AskContext, scope: AskScope): MemoryDoc[] {
  return context.memories.filter((memory) => {
    if (scope.memoryIds?.length && !scope.memoryIds.includes(memory.id)) return false;
    if (memory.sensitive && !scope.includeDifficult) return false;
    if (scope.characterId) {
      const person = memory.people.find((p) => p.characterId === scope.characterId);
      if (!person) return false;
      if (scope.centralOnly && person.role !== 'central') return false;
    }
    if (scope.emotion && !memory.emotions.some((e) => e.tag === scope.emotion)) return false;
    if (scope.ageMin !== undefined && (memory.ageMax ?? memory.ageMin ?? -1) < scope.ageMin)
      return false;
    if (scope.ageMax !== undefined && (memory.ageMin ?? 999) > scope.ageMax) return false;
    return true;
  });
}

function findCharacter(question: string, context: AskContext) {
  const lower = question.toLowerCase();
  let best: { id: string; name: string; at: number } | null = null;
  for (const character of context.characters) {
    for (const alias of [character.name, ...character.aliases]) {
      const pattern = new RegExp(
        `\\b${alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      );
      const match = lower.match(pattern);
      if (match && match.index !== undefined && (!best || alias.length > 2)) {
        best = { id: character.id, name: character.name, at: match.index };
      }
    }
  }
  return best;
}

function characterJourney(
  question: string,
  characterId: string,
  name: string,
  pool: MemoryDoc[],
): GroundedAnswer {
  const memories = pool
    .filter((m) => m.people.some((p) => p.characterId === characterId))
    .sort(byAge);
  if (!memories.length) {
    return {
      intent: 'character',
      lines: [
        {
          text: `You haven't recorded any memories with ${name} yet, so there's nothing to look at.`,
          memoryIds: [],
        },
      ],
      citations: [],
      limitations: ['An empty archive can’t answer this. Add a memory and try again.'],
      consideredCount: 0,
    };
  }

  const lines: GroundedAnswer['lines'] = [];
  const first = memories[0]!;
  const last = memories[memories.length - 1]!;
  lines.push({
    text: `You've recorded ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} with ${name}, from ${ageLabel(first)} to ${ageLabel(last)}.`,
    memoryIds: memories.map((m) => m.id),
  });

  const central = memories.filter(
    (m) => m.people.find((p) => p.characterId === characterId)?.role === 'central',
  );
  if (central.length) {
    lines.push({
      text: `${name} is at the center of ${central.length} of them: ${central.map((m) => `“${m.title}”`).join(', ')}.`,
      memoryIds: central.map((m) => m.id),
    });
  }

  if (memories.length >= 2) {
    const half = Math.ceil(memories.length / 2);
    const early = memories.slice(0, half);
    const late = memories.slice(half);
    const earlyTags = early.flatMap((m) =>
      m.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
    );
    const lateTags = late.flatMap((m) =>
      m.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
    );
    if (late.length) {
      const shift = valence(lateTags) - valence(earlyTags);
      const direction =
        shift > 0.4
          ? 'warmer in the later ones'
          : shift < -0.4
            ? 'harder in the later ones'
            : 'about the same across the years';
      lines.push({
        text: `In the earlier memories you tagged ${emotionWords(earlyTags)}; in the later ones, ${emotionWords(lateTags)}. The feelings you recorded read ${direction}.`,
        memoryIds: memories.map((m) => m.id),
      });
    }
  }

  const nowTags = memories.flatMap((m) =>
    m.emotions.filter((e) => e.phase === 'now').map((e) => e.tag),
  );
  if (nowTags.length) {
    lines.push({
      text: `Looking back on some of these now, you described feeling ${emotionWords(nowTags)}.`,
      memoryIds: memories.filter((m) => m.emotions.some((e) => e.phase === 'now')).map((m) => m.id),
    });
  }

  lines.push({
    text: `This is how you remember ${name}, drawn only from what you've recorded. It doesn't say who ${name} is or why they did things.`,
    memoryIds: [],
  });

  const limitations = gaps(memories);
  if (memories.length < 4)
    limitations.push(
      `Only ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}, so this is a sketch, not a picture.`,
    );
  if (
    /changed|change|perception|relationship/.test(question.toLowerCase()) &&
    memories.length < 2
  ) {
    limitations.push('A change over time needs at least two memories from different ages.');
  }

  return {
    intent: 'character',
    lines,
    citations: memories.map((m) =>
      citeTerms(m, [
        name,
        ...m.people.filter((p) => p.characterId === characterId).map((p) => p.name),
      ]),
    ),
    limitations,
    consideredCount: memories.length,
  };
}

function rememberedDifferently(
  pool: Array<MemoryDoc & { changeKinds?: string[] }>,
): GroundedAnswer {
  const changed = pool.filter((m) => (m.versionCount ?? 1) > 1).sort(byAge);
  if (!changed.length) {
    return {
      intent: 'versions',
      lines: [
        {
          text: "You haven't retold any memory yet, so there's nothing to compare. When you add to an old memory, it'll show up here.",
          memoryIds: [],
        },
      ],
      citations: [],
      limitations: [],
      consideredCount: 0,
    };
  }
  const lines = changed.map((m) => {
    const kinds = [...new Set(m.changeKinds ?? [])].filter((k) => k !== 'consistent');
    const what = kinds.length ? kinds.join(', ').replace(/_/g, ' ') : 'small wording changes';
    return {
      text: `“${m.title}” (${ageLabel(m)}) has ${m.versionCount} tellings. What shifted: ${what}.`,
      memoryIds: [m.id],
    };
  });
  return {
    intent: 'versions',
    lines,
    citations: changed.map((m) => cite(m)),
    limitations: [
      'Memories change for lots of reasons. A different telling isn’t a sign that either one is false.',
    ],
    consideredCount: changed.length,
  };
}

function patternsAnswer(context: AskContext, pool: MemoryDoc[]): GroundedAnswer {
  const ids = new Set(pool.map((m) => m.id));
  const relevant = context.connections.filter(
    (c) =>
      c.status !== 'dismissed' &&
      ['repeating_pattern', 'breaking_pattern', 'full_circle', 'relationship_change'].includes(
        c.type,
      ) &&
      c.memoryIds.every((id) => ids.has(id)),
  );
  if (!relevant.length) {
    return {
      intent: 'patterns',
      lines: [
        {
          text: "I don't see any patterns yet. Try “Find connections” on the Memory Map, or link two memories yourself.",
          memoryIds: [],
        },
      ],
      citations: [],
      limitations: ['Patterns need several memories that resemble each other.'],
      consideredCount: pool.length,
    };
  }
  const byId = new Map(pool.map((m) => [m.id, m]));
  const lines = relevant.map((c) => ({
    text: `${c.status === 'confirmed' ? 'You linked' : 'Possible link'}: ${c.explanation}`,
    memoryIds: c.memoryIds,
  }));
  const citations = relevant.flatMap((c) =>
    c.memoryIds
      .map((id) => byId.get(id))
      .filter((m): m is MemoryDoc => !!m)
      .map((m) => cite(m)),
  );
  return {
    intent: 'patterns',
    lines,
    citations,
    limitations: relevant.some((c) => c.status !== 'confirmed')
      ? ['Some of these are suggestions you haven’t confirmed yet.']
      : [],
    consideredCount: pool.length,
  };
}

function topicAnswer(
  intent: string,
  terms: string[],
  pool: MemoryDoc[],
  label: string,
): GroundedAnswer {
  const hits = pool
    .map((m) => ({ memory: m, hits: terms.filter((t) => m.text.toLowerCase().includes(t)) }))
    .filter((h) => h.hits.length)
    .sort((a, b) => byAge(a.memory, b.memory));
  if (!hits.length) {
    return {
      intent,
      lines: [
        { text: `Nothing you've recorded talks about ${label} directly yet.`, memoryIds: [] },
      ],
      citations: [],
      limitations: ['This only searches what you’ve written or said here.'],
      consideredCount: pool.length,
    };
  }
  const lines = hits.map(({ memory }) => {
    const feelings = memory.emotions.filter((e) => e.phase === 'then').map((e) => e.tag);
    return {
      text: `${capitalize(ageLabel(memory))}: “${memory.title}”${feelings.length ? `, which you tagged ${emotionWords(feelings)}` : ''}.`,
      memoryIds: [memory.id],
    };
  });
  const tags = hits.map((h) => valence(h.memory.emotions.map((e) => e.tag)));
  if (hits.length >= 3) {
    const early = tags.slice(0, Math.ceil(tags.length / 2));
    const late = tags.slice(Math.ceil(tags.length / 2));
    const avg = (list: number[]) => list.reduce((s, v) => s + v, 0) / (list.length || 1);
    const shift = avg(late) - avg(early);
    lines.push({
      text:
        shift > 0.3
          ? 'Read in order, the later memories carry lighter feelings than the earlier ones.'
          : shift < -0.3
            ? 'Read in order, the later memories carry heavier feelings than the earlier ones.'
            : 'Read in order, the feelings stay fairly mixed.',
      memoryIds: hits.map((h) => h.memory.id),
    });
  }
  const limitations = gaps(hits.map((h) => h.memory));
  if (hits.length < 3) limitations.push('Only a few memories touch this, so take it lightly.');
  return {
    intent,
    lines,
    citations: hits.map((h) => citeTerms(h.memory, h.hits)),
    limitations,
    consideredCount: pool.length,
  };
}

function freeform(question: string, pool: MemoryDoc[], wantsPositive: boolean): GroundedAnswer {
  if (!pool.length) {
    return {
      intent: 'search',
      lines: [{ text: 'There are no memories to look through yet.', memoryIds: [] }],
      citations: [],
      limitations: [],
      consideredCount: 0,
    };
  }
  const index = new TermIndex(pool.map((m) => ({ id: m.id, text: `${m.title}. ${m.text}` })));
  const byId = new Map(pool.map((m) => [m.id, m]));
  let results = index.search(question, 6).filter((r) => r.score > 0.05);
  if (wantsPositive) {
    results = results.filter((r) => {
      const memory = byId.get(r.id)!;
      return (
        !memory.emotions.some((e) => DIFFICULT_EMOTIONS.has(e.tag)) ||
        memory.emotions.some((e) => POSITIVE_EMOTIONS.has(e.tag))
      );
    });
  }
  if (!results.length) {
    return {
      intent: 'search',
      lines: [
        {
          text: "I couldn't find anything in your memories that matches that. Try different words, or a person's name.",
          memoryIds: [],
        },
      ],
      citations: [],
      limitations: [
        'I only look at what you’ve recorded, so a missing answer means it isn’t written down yet.',
      ],
      consideredCount: pool.length,
    };
  }
  const memories = results.map((r) => byId.get(r.id)!).sort(byAge);
  return {
    intent: 'search',
    lines: [
      {
        text: `${memories.length === 1 ? 'One memory seems' : `${memories.length} memories seem`} related, from ${ageLabel(memories[0]!)} to ${ageLabel(memories[memories.length - 1]!)}.`,
        memoryIds: memories.map((m) => m.id),
      },
      ...results.map((r) => {
        const memory = byId.get(r.id)!;
        return {
          text: `“${memory.title}” shares ${
            r.shared
              .slice(0, 3)
              .map((s) => `“${s}”`)
              .join(', ') || 'a few words'
          } with your question.`,
          memoryIds: [memory.id],
        };
      }),
    ],
    citations: results.map((r) => citeTerms(byId.get(r.id)!, r.shared)),
    limitations: ['This is a word match across your memories, not an interpretation.'],
    consideredCount: pool.length,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function answerQuestion(
  question: string,
  context: AskContext,
  scope: AskScope = {},
): GroundedAnswer {
  const lower = question.toLowerCase();
  const wantsPositive =
    /\b(happy|good|joyful|fun|favorite|favourite|best|warm|proud)\b/.test(lower) &&
    !scope.includeDifficult;
  const pool = applyScope(context, scope);

  const characterId = scope.characterId ?? findCharacter(question, context)?.id;
  if (characterId) {
    const character = context.characters.find((c) => c.id === characterId);
    if (character) return characterJourney(question, character.id, character.name, pool);
  }
  if (/remember differently|differently now|changed my mind|versions?|retold|retell/.test(lower)) {
    return rememberedDifferently(pool);
  }
  if (/pattern|cycle|repeat|again and again|keep doing/.test(lower))
    return patternsAnswer(context, pool);
  if (/wish|dream|came true|hoped/.test(lower))
    return topicAnswer('wishes', TOPIC_TERMS.wishes!, pool, 'wishes or dreams');
  if (/authority|rules|teacher|boss/.test(lower))
    return topicAnswer('authority', TOPIC_TERMS.authority!, pool, 'authority');
  if (/confiden|brave|courage|shaped/.test(lower))
    return topicAnswer('confidence', TOPIC_TERMS.confidence!, pool, 'confidence');
  return freeform(question, pool, wantsPositive);
}

export const CURATED_QUESTIONS = [
  'How has my relationship with Mom changed over time?',
  'How has my perception of Mom changed?',
  'Which childhood wishes came true?',
  'What moments shaped my confidence?',
  'What do I remember differently now?',
  'What patterns or cycles appear in my memories?',
  'How has my relationship with authority changed over time?',
];
