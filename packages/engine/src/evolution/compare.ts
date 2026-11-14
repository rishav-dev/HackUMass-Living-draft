import { splitClauses } from '../text/sentences';
import { jaccard, overlap, termSet } from '../text/tokens';
import { NUMBER_PATTERN, parseNumber } from '../text/numbers';
import type { DetailChange, DetailChangeKind, TextSpan, VersionComparison } from '../types';

const HEDGE_PHRASES =
  /\b(?:i'?m not (?:really |totally |completely |even )?sure(?: if| whether| that)?|not sure(?: if| whether)?|maybe|i think|i guess|might have|may have|or did (?:she|he|they|i|we)|i don'?t know if|i don'?t know whether|can'?t remember (?:if|whether)|i assumed|just assumed|assumed|perhaps|or maybe|not certain|i might be wrong)\b/gi;
const STRONG_CORRECTION =
  /\b(?:i was wrong|that'?s wrong|that was wrong|wasn'?t right|i misremembered|i mixed (?:it|that) up|turns out|it turns out|correction|i got that wrong|that'?s not what happened|it wasn'?t \w+,? it was)\b/i;
const SOFT_CORRECTION = /\b(?:actually|really it was|in fact)\b/i;
const PERSPECTIVE =
  /\b(?:looking back|now i (?:see|think|realize|realise|understand|know|get)|i realize|i realise|in hindsight|these days i|i see it differently|i understand (?:now|why)|i get it now|now that i'?m older|as an adult|i used to think)\b/i;
const NEGATION =
  /\b(?:not|never|no|didn'?t|wasn'?t|weren'?t|don'?t|doesn'?t|isn'?t|aren'?t|couldn'?t|wouldn'?t|won'?t|nobody|nothing|nowhere|none|hadn'?t)\b/i;
const QUANTITY = new RegExp(`\\b(${NUMBER_PATTERN})\\s+([a-z]+)`, 'gi');

const ALIGN_THRESHOLD = 0.3;
const CONSISTENT_THRESHOLD = 0.62;

const NOTES: Record<DetailChangeKind, string> = {
  consistent: 'Same detail both times.',
  new: 'A detail that wasn’t there before.',
  omitted: 'Not mentioned this time. That doesn’t mean it changed.',
  changed: 'Told a little differently.',
  contradictory: 'These two seem to disagree. It might be worth a look.',
  uncertain: 'You sound less sure about this now.',
  corrected: 'You said the earlier version wasn’t right.',
  reflected: 'A different way of seeing it, not a different fact.',
};

interface Clause {
  span: TextSpan;
  terms: Set<string>;
}

function clausesOf(text: string): Clause[] {
  return splitClauses(text).map((span) => ({ span, terms: termSet(span.text) }));
}

function similarity(a: Set<string>, b: Set<string>): number {
  const shared = overlap(a, b).length;
  if (!shared) return 0;
  const coefficient = shared / Math.min(a.size, b.size);
  return 0.5 * jaccard(a, b) + 0.5 * coefficient;
}

function withoutHedges(text: string): string {
  return text.replace(HEDGE_PHRASES, ' ');
}

function hasHedge(text: string): boolean {
  HEDGE_PHRASES.lastIndex = 0;
  const found = HEDGE_PHRASES.test(text);
  HEDGE_PHRASES.lastIndex = 0;
  return found;
}

function isNegated(text: string): boolean {
  return NEGATION.test(withoutHedges(text));
}

function quantities(text: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const match of text.matchAll(QUANTITY)) {
    const value = parseNumber(match[1]);
    if (value === null) continue;
    const unit = match[2]!.toLowerCase().replace(/s$/, '');
    if (['year', 'old'].includes(unit)) continue;
    found.set(unit, value);
  }
  return found;
}

function conflictingQuantity(a: string, b: string): boolean {
  const left = quantities(a);
  const right = quantities(b);
  for (const [unit, value] of left) {
    const other = right.get(unit);
    if (other !== undefined && other !== value) return true;
  }
  return false;
}

function classifyPair(earlier: Clause, later: Clause, score: number): DetailChangeKind {
  const before = earlier.span.text;
  const after = later.span.text;
  if (STRONG_CORRECTION.test(after)) return 'corrected';
  if (hasHedge(after) && !hasHedge(before)) return 'uncertain';
  if (SOFT_CORRECTION.test(after) && !hasHedge(after) && score < CONSISTENT_THRESHOLD + 0.2)
    return 'corrected';
  if (isNegated(before) !== isNegated(after) && overlap(earlier.terms, later.terms).length > 0)
    return 'contradictory';
  if (conflictingQuantity(before, after)) return 'contradictory';
  if (PERSPECTIVE.test(after) && !PERSPECTIVE.test(before)) return 'reflected';
  if (score >= CONSISTENT_THRESHOLD) return 'consistent';
  return 'changed';
}

function emptyCounts(): Record<DetailChangeKind, number> {
  return {
    consistent: 0,
    new: 0,
    omitted: 0,
    changed: 0,
    contradictory: 0,
    uncertain: 0,
    corrected: 0,
    reflected: 0,
  };
}

export function compareVersions(
  earlierText: string,
  laterText: string,
  mode: 'retelling' | 'addition' = 'retelling',
): VersionComparison {
  const earlier = clausesOf(earlierText);
  const later = clausesOf(laterText);
  const changes: DetailChange[] = [];
  const matchedEarlier = new Set<number>();

  for (const clause of later) {
    let bestIndex = -1;
    let bestScore = 0;
    earlier.forEach((candidate, index) => {
      const score = similarity(clause.terms, candidate.terms);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore >= ALIGN_THRESHOLD) {
      const match = earlier[bestIndex]!;
      matchedEarlier.add(bestIndex);
      const kind = classifyPair(match, clause, bestScore);
      changes.push({
        kind,
        earlier: match.span,
        later: clause.span,
        note: NOTES[kind],
        sharedTerms: overlap(match.terms, clause.terms),
      });
      continue;
    }

    const kind: DetailChangeKind = PERSPECTIVE.test(clause.span.text)
      ? 'reflected'
      : hasHedge(clause.span.text) && earlier.some((e) => overlap(e.terms, clause.terms).length > 0)
        ? 'uncertain'
        : STRONG_CORRECTION.test(clause.span.text)
          ? 'corrected'
          : 'new';
    const related =
      kind === 'new' ? null : bestIndex >= 0 && bestScore > 0 ? earlier[bestIndex]!.span : null;
    changes.push({
      kind,
      earlier: related,
      later: clause.span,
      note: NOTES[kind],
      sharedTerms: [],
    });
  }

  if (mode === 'retelling') {
    earlier.forEach((clause, index) => {
      if (matchedEarlier.has(index)) return;
      changes.push({
        kind: 'omitted',
        earlier: clause.span,
        later: null,
        note: NOTES.omitted,
        sharedTerms: [],
      });
    });
  }

  const counts = emptyCounts();
  for (const change of changes) counts[change.kind] += 1;
  const whole = jaccard(termSet(earlierText), termSet(laterText));

  return {
    changes,
    counts,
    similarity: Math.round(whole * 100) / 100,
    needsReview: counts.contradictory + counts.uncertain + counts.corrected > 0,
  };
}

export const CHANGE_LABELS: Record<DetailChangeKind, string> = {
  consistent: 'Consistent',
  new: 'New detail',
  omitted: 'Left out',
  changed: 'Told differently',
  contradictory: 'Possible inconsistency',
  uncertain: 'Less certain',
  corrected: 'Corrected',
  reflected: 'Seen differently',
};
