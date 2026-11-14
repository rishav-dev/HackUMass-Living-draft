import type { CandidateMatch, MemoryDoc } from '../types';
import { TermIndex } from './index';

export interface CaptureSignals {
  text: string;
  ageMin: number | null;
  ageMax: number | null;
  season: string | null;
  peopleKeys: string[];
  emotionTags: string[];
}

const RETELLING_CUES =
  /\b(?:that time|that summer|that day|the same|i told you|like i said|i forgot to (?:say|mention)|another thing about|more about|also remember|one more thing|actually|now that i think|thinking about it again|i'm not sure (?:if|whether|that)|i don't think (?:she|he|they|we) (?:actually|really))\b/i;

export const MATCH_THRESHOLDS = {
  likelySame: 0.42,
  related: 0.2,
  minTextSimilarityForSame: 0.16,
};

function temporalFit(
  a: { ageMin: number | null; ageMax: number | null },
  b: { ageMin: number | null; ageMax: number | null },
): number {
  if (a.ageMin === null || a.ageMax === null || b.ageMin === null || b.ageMax === null) return 0.5;
  if (a.ageMin <= b.ageMax && b.ageMin <= a.ageMax) return 1;
  const gap = Math.min(Math.abs(a.ageMin - b.ageMax), Math.abs(b.ageMin - a.ageMax));
  if (gap === 1) return 0.4;
  return 0;
}

function setOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function readableTerms(terms: string[]): string {
  return terms.map((t) => `"${t}"`).join(', ');
}

export function findCandidates(
  capture: CaptureSignals,
  memories: Array<MemoryDoc & { peopleKeys: string[] }>,
  limit = 3,
): CandidateMatch[] {
  if (!memories.length) return [];
  const index = new TermIndex(memories.map((m) => ({ id: m.id, text: `${m.title}. ${m.text}` })));
  const query = index.queryVector(capture.text);
  const cueBonus = RETELLING_CUES.test(capture.text) ? 0.06 : 0;

  const scored: CandidateMatch[] = [];
  for (const memory of memories) {
    const doc = index.doc(memory.id);
    if (!doc) continue;
    const text = index.similarity(query, doc);
    const people = setOverlap(capture.peopleKeys, memory.peopleKeys);
    const time = temporalFit(capture, memory);
    const emotions = setOverlap(
      capture.emotionTags,
      memory.emotions.map((e) => e.tag),
    );
    const seasonMatch =
      capture.season && memory.season ? (capture.season === memory.season ? 1 : 0) : 0.5;

    let score =
      text * 0.55 + people * 0.17 + time * 0.13 + emotions * 0.05 + seasonMatch * 0.04 + cueBonus;
    if (time === 0) score *= 0.55;
    if (capture.season && memory.season && capture.season !== memory.season) score *= 0.75;

    if (score < MATCH_THRESHOLDS.related) continue;

    const shared = index.distinctiveShared(query, doc, 5);
    const reasons: string[] = [];
    if (shared.length) reasons.push(`Both mention ${readableTerms(shared.slice(0, 3))}`);
    if (people > 0) {
      const names = memory.people
        .filter(
          (p) =>
            capture.peopleKeys.includes(p.characterId) ||
            capture.peopleKeys.includes(p.name.toLowerCase()),
        )
        .map((p) => p.name);
      reasons.push(names.length ? `Same people: ${names.join(', ')}` : 'Some of the same people');
    }
    if (time === 1 && memory.ageMin !== null) {
      reasons.push(
        memory.ageMin === memory.ageMax
          ? `Both around age ${memory.ageMin}`
          : `Overlapping ages (${memory.ageMin}–${memory.ageMax})`,
      );
    }
    if (time === 0 && memory.ageMin !== null)
      reasons.push(`Different ages, so probably a separate event`);
    if (capture.season && memory.season === capture.season)
      reasons.push(`Both in ${capture.season}`);

    const sameEnough =
      score >= MATCH_THRESHOLDS.likelySame &&
      text >= MATCH_THRESHOLDS.minTextSimilarityForSame &&
      time > 0;
    scored.push({
      memoryId: memory.id,
      title: memory.title,
      score: Math.round(score * 100) / 100,
      verdict: sameEnough ? 'likely_same' : 'related',
      reasons,
      sharedTerms: shared,
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
