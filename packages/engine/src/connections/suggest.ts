import { DIFFICULT_EMOTIONS, POSITIVE_EMOTIONS, valence } from '../emotions/detect';
import { TermIndex } from '../retrieval/index';
import { sentenceAt } from '../text/sentences';
import type { ConnectionEvidence, ConnectionSuggestion, MemoryDoc } from '../types';

interface PatternSet {
  victim: RegExp;
  agent: RegExp;
  theme: string;
}

const FULL_CIRCLE: PatternSet[] = [
  {
    theme: 'being left out',
    victim:
      /\b(?:i was|i felt|i got) (?:left out|excluded|ignored|picked last|the new kid)\b|\b(?:nobody|no one) (?:would )?(?:sat|sit|played|play|talked|talk|wanted to sit) with me\b|\bi (?:sat|ate) (?:alone|by myself)\b|\bleft me out\b/i,
    agent:
      /\bi (?:sat|went and sat|asked (?:him|her|them) to sit|made room|invited|included|waved (?:him|her|them) over|saved (?:him|her|them) a seat)\b|\bsat (?:down )?(?:next to|with) (?:him|her|them|the new)\b/i,
  },
  {
    theme: 'being picked on',
    victim:
      /\b(?:bullied|teased|picked on|laughed at|made fun of) me\b|\bi (?:was|got) (?:bullied|teased|picked on|laughed at|made fun of)\b/i,
    agent: /\bi (?:stood up for|defended|stepped in|told them to stop|stuck up for)\b/i,
  },
  {
    theme: 'being taught',
    victim: /\b(?:taught me|showed me how|helped me learn)\b/i,
    agent: /\bi (?:taught|showed (?:him|her|them|my)\b.* how|helped (?:him|her|them) learn)\b/i,
  },
  {
    theme: 'being looked after',
    victim: /\b(?:took care of me|looked after me|carried me|stayed with me)\b/i,
    agent: /\bi (?:took care of|looked after|stayed with|carried) (?:him|her|them|my)\b/i,
  },
];

const WISH =
  /\b(?:i (?:always )?(?:wished|wanted to|dreamed of|dreamt of|hoped to|hoped i'?d|begged to|longed to)|someday i'?(?:d|ll| would| will)|one day i'?(?:d|ll| would| will)|i promised myself)\b([^.!?]{3,90})/i;
const FULFILLED =
  /\b(?:finally|at last|for the first time|i got to|i made it|came true|i actually (?:got|went|saw|did|made)|i did it)\b/i;

const SILENCE =
  /\b(?:i (?:stayed|kept) (?:quiet|silent)|i didn'?t say anything|i said nothing|i (?:just )?(?:gave in|went along|backed down|walked away|froze|let it go|swallowed it))\b/i;
const VOICE =
  /\b(?:i (?:spoke up|said something|said no|pushed back|stood my ground|told (?:him|her|them) (?:how|what|that)|asked for|stood up to|didn'?t back down))\b/i;

function quote(memory: MemoryDoc, match: RegExpMatchArray | null): ConnectionEvidence {
  if (!match || match.index === undefined) {
    const first = sentenceAt(memory.text, 0);
    return { memoryId: memory.id, quote: first.text, start: first.start, end: first.end };
  }
  const sentence = sentenceAt(memory.text, match.index);
  return { memoryId: memory.id, quote: sentence.text, start: sentence.start, end: sentence.end };
}

function midAge(memory: MemoryDoc): number | null {
  if (memory.ageMin === null) return null;
  return (memory.ageMin + (memory.ageMax ?? memory.ageMin)) / 2;
}

function ageLabel(memory: MemoryDoc): string {
  if (memory.ageMin === null) return 'at some point';
  if (memory.ageMax === null || memory.ageMin === memory.ageMax) return `at ${memory.ageMin}`;
  return `at ${memory.ageMin} or ${memory.ageMax}`;
}

function chronological(a: MemoryDoc, b: MemoryDoc): [MemoryDoc, MemoryDoc] | null {
  const ageA = midAge(a);
  const ageB = midAge(b);
  if (ageA === null || ageB === null || ageA === ageB) return null;
  return ageA < ageB ? [a, b] : [b, a];
}

function tags(memory: MemoryDoc, phase?: 'then' | 'now'): string[] {
  return memory.emotions.filter((e) => !phase || e.phase === phase).map((e) => e.tag);
}

function fullCircle(earlier: MemoryDoc, later: MemoryDoc): ConnectionSuggestion | null {
  for (const set of FULL_CIRCLE) {
    const victim = earlier.text.match(set.victim);
    const agent = later.text.match(set.agent);
    if (victim && agent) {
      return {
        type: 'full_circle',
        memoryIds: [earlier.id, later.id],
        explanation: `${capitalize(ageLabel(earlier))} you were on the receiving end of ${set.theme}. ${capitalize(ageLabel(later))} you were the one who did something about it.`,
        evidence: [quote(earlier, victim), quote(later, agent)],
        score: 0.9,
      };
    }
  }
  return null;
}

function wishFulfilled(
  earlier: MemoryDoc,
  later: MemoryDoc,
  index: TermIndex,
): ConnectionSuggestion | null {
  const wish = earlier.text.match(WISH);
  const done = later.text.match(FULFILLED);
  if (!wish || !done) return null;
  const wishDoc = index.queryVector(wish[1] ?? '');
  const laterDoc = index.doc(later.id);
  if (!laterDoc) return null;
  const shared = index.distinctiveShared(wishDoc, laterDoc, 3);
  if (!shared.length) return null;
  return {
    type: 'wish_fulfilled',
    memoryIds: [earlier.id, later.id],
    explanation: `${capitalize(ageLabel(earlier))} you wished for something involving ${shared.map((s) => `“${s}”`).join(' and ')}. ${capitalize(ageLabel(later))} it sounds like it happened.`,
    evidence: [quote(earlier, wish), quote(later, done)],
    score: 0.6 + Math.min(0.3, shared.length * 0.1),
  };
}

function patterns(
  earlier: MemoryDoc,
  later: MemoryDoc,
  index: TermIndex,
): ConnectionSuggestion | null {
  const a = index.doc(earlier.id);
  const b = index.doc(later.id);
  if (!a || !b) return null;
  const textScore = index.cosine(a, b);
  const shared = index.distinctiveShared(a, b, 3);
  const gap = (midAge(later) ?? 0) - (midAge(earlier) ?? 0);
  if (gap < 2) return null;

  const silent = earlier.text.match(SILENCE);
  const voiced = later.text.match(VOICE);
  if (silent && voiced) {
    return {
      type: 'breaking_pattern',
      memoryIds: [earlier.id, later.id],
      explanation: `${capitalize(ageLabel(earlier))} you kept quiet. ${capitalize(ageLabel(later))}, in a similar spot, you said something.`,
      evidence: [quote(earlier, silent), quote(later, voiced)],
      score: 0.75 + Math.min(0.15, textScore),
    };
  }

  if (textScore < 0.12 || shared.length < 2) return null;
  const earlierValence = valence(tags(earlier, 'then'));
  const laterValence = valence(tags(later, 'then'));
  const sharedTags = tags(earlier, 'then').filter((t) => tags(later, 'then').includes(t));

  if (earlierValence < 0 && laterValence > 0) {
    return {
      type: 'breaking_pattern',
      memoryIds: [earlier.id, later.id],
      explanation: `Both involve ${shared.map((s) => `“${s}”`).join(', ')}. The earlier one felt hard; the later one went differently.`,
      evidence: [quote(earlier, null), quote(later, null)],
      score: 0.45 + textScore,
    };
  }
  if (sharedTags.length) {
    return {
      type: 'repeating_pattern',
      memoryIds: [earlier.id, later.id],
      explanation: `${capitalize(ageLabel(earlier))} and ${ageLabel(later)}: both involve ${shared.map((s) => `“${s}”`).join(', ')}, and both felt ${sharedTags.join(' and ')}.`,
      evidence: [quote(earlier, null), quote(later, null)],
      score: 0.4 + textScore,
    };
  }
  return null;
}

function relationshipChange(earlier: MemoryDoc, later: MemoryDoc): ConnectionSuggestion | null {
  const gap = (midAge(later) ?? 0) - (midAge(earlier) ?? 0);
  if (gap < 3) return null;
  const important = (m: MemoryDoc) => m.people.filter((p) => p.role !== 'mentioned');
  const shared = important(earlier).filter((p) =>
    important(later).some((q) => q.characterId === p.characterId),
  );
  if (!shared.length) return null;
  const before = tags(earlier, 'then');
  const after = tags(later, 'then');
  const beforeValence = valence(before);
  const afterValence = valence(after);
  if (
    beforeValence === 0 ||
    afterValence === 0 ||
    Math.sign(beforeValence) === Math.sign(afterValence)
  )
    return null;
  const person = shared[0]!;
  const describe = (list: string[]) =>
    list.length
      ? list.filter((t) => POSITIVE_EMOTIONS.has(t) || DIFFICULT_EMOTIONS.has(t)).join(' and ') ||
        list.join(' and ')
      : 'untagged';
  return {
    type: 'relationship_change',
    memoryIds: [earlier.id, later.id],
    explanation: `With ${person.name}: ${ageLabel(earlier)} you remembered feeling ${describe(before)}; ${ageLabel(later)}, ${describe(after)}. This is how you remember it, not a judgment about ${person.name}.`,
    evidence: [quote(earlier, null), quote(later, null)],
    score: 0.55 + Math.min(0.3, Math.abs(afterValence - beforeValence) / 4),
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function suggestConnections(
  memories: MemoryDoc[],
  options: { focusIds?: string[]; existingPairs?: Set<string>; limit?: number } = {},
): ConnectionSuggestion[] {
  const index = new TermIndex(memories.map((m) => ({ id: m.id, text: m.text })));
  const focus = options.focusIds ? new Set(options.focusIds) : null;
  const suggestions: ConnectionSuggestion[] = [];

  for (let i = 0; i < memories.length; i += 1) {
    for (let j = i + 1; j < memories.length; j += 1) {
      const a = memories[i]!;
      const b = memories[j]!;
      if (focus && !focus.has(a.id) && !focus.has(b.id)) continue;
      const ordered = chronological(a, b);
      if (!ordered) continue;
      const [earlier, later] = ordered;

      const found = [
        fullCircle(earlier, later),
        wishFulfilled(earlier, later, index),
        patterns(earlier, later, index),
        relationshipChange(earlier, later),
      ].filter((s): s is ConnectionSuggestion => s !== null);

      for (const suggestion of found) {
        const key = pairKey(suggestion.type, suggestion.memoryIds);
        if (options.existingPairs?.has(key)) continue;
        suggestions.push(suggestion);
      }
    }
  }
  return suggestions.sort((x, y) => y.score - x.score).slice(0, options.limit ?? 12);
}

export function pairKey(type: string, memoryIds: string[]): string {
  return `${type}:${[...memoryIds].sort().join('|')}`;
}
