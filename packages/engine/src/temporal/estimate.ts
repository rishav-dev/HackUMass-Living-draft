import { termSet, overlap } from '../text/tokens';
import type {
  Confidence,
  KnownEvent,
  Season,
  TemporalAnchor,
  TemporalClue,
  TemporalContext,
  TemporalEstimate,
  TemporalEvidence,
} from '../types';
import {
  ageRangeForInterval,
  capitalize,
  monthInterval,
  monthName,
  seasonForMonth,
  yearInterval,
} from './calendar';

const MAX_PLACEMENT_SPREAD = 2;

type Range = { min: number; max: number };

function intersect(a: Range, b: Range): Range | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  return min <= max ? { min, max } : null;
}

function evidenceFrom(clue: TemporalClue, reason: string): TemporalEvidence {
  return { quote: clue.span.text, start: clue.span.start, end: clue.span.end, reason };
}

function rangeLabel(range: Range): string {
  if (range.min === range.max) return `${range.min}`;
  if (range.max - range.min === 1) return `${range.min} or ${range.max}`;
  return `${range.min} to ${range.max}`;
}

export function emptyEstimate(explanation: string): TemporalEstimate {
  return {
    precision: 'unknown',
    ageMin: null,
    ageMax: null,
    year: null,
    month: null,
    day: null,
    season: null,
    approximate: true,
    confidence: 'low',
    anchors: [],
    evidence: [],
    explanation,
    conflicts: [],
  };
}

export function estimateTemporal(
  clues: TemporalClue[],
  context: TemporalContext,
): TemporalEstimate {
  const profile = {
    today: context.today,
    currentAge: context.currentAge,
    birthDate: context.birthDate,
  };
  const evidence: TemporalEvidence[] = [];
  const reasons: string[] = [];
  const conflicts: string[] = [];
  const anchors: TemporalAnchor[] = [];

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let season: Season | null = null;
  let dateRange: Range | null = null;
  let statedRange: Range | null = null;
  let hintRange: Range | null = null;
  let hedged = false;
  let hasDate = false;

  const byKind = (kind: TemporalClue['kind']) => clues.filter((c) => c.kind === kind);

  const exact = byKind('exact_date')[0];
  const monthYear = byKind('month_year')[0];
  const seasonYear = byKind('season_year')[0];
  const yearOnly = byKind('year')[0];

  if (exact?.year && exact.month && exact.day) {
    year = exact.year;
    month = exact.month;
    day = exact.day;
    hasDate = true;
    const date = new Date(Date.UTC(year, month - 1, day));
    const r = ageRangeForInterval(date, date, profile);
    dateRange = { min: r.ageMin, max: r.ageMax };
    hedged ||= exact.hedged;
    evidence.push(evidenceFrom(exact, 'a specific date'));
    reasons.push(`you gave a date, "${exact.span.text}"`);
  } else if (monthYear?.year && monthYear.month) {
    year = monthYear.year;
    month = monthYear.month;
    hasDate = true;
    const [start, end] = monthInterval(year, month);
    const r = ageRangeForInterval(start, end, profile);
    dateRange = { min: r.ageMin, max: r.ageMax };
    hedged ||= monthYear.hedged;
    evidence.push(evidenceFrom(monthYear, 'a month and year'));
    reasons.push(`you said "${monthYear.span.text}"`);
  } else if (seasonYear?.year || yearOnly?.year) {
    const clue = (seasonYear ?? yearOnly)!;
    year = clue.year!;
    season = clue.season ?? null;
    hasDate = true;
    const [start, end] = yearInterval(year);
    const r = ageRangeForInterval(start, end, profile);
    dateRange = { min: r.ageMin, max: r.ageMax };
    hedged ||= clue.hedged;
    evidence.push(evidenceFrom(clue, season ? 'a season and year' : 'a year'));
    reasons.push(`you mentioned ${clue.span.text}`);
  }

  for (const clue of [...byKind('birthday'), ...byKind('age')]) {
    const range = { min: clue.ageMin!, max: clue.ageMax! };
    hedged ||= clue.hedged;
    evidence.push(evidenceFrom(clue, 'your age at the time'));
    if (!statedRange) {
      statedRange = range;
      reasons.push(`you said "${clue.span.text}"`);
    } else {
      const narrowed = intersect(statedRange, range);
      if (narrowed) statedRange = narrowed;
      else
        conflicts.push(
          `"${clue.span.text}" doesn't line up with an earlier age in the same account.`,
        );
    }
  }

  for (const clue of [...byKind('grade'), ...byKind('life_stage')]) {
    const range = { min: clue.ageMin!, max: clue.ageMax! };
    evidence.push(evidenceFrom(clue, clue.note ?? 'a stage of life'));
    if (statedRange) {
      if (intersect(statedRange, range)) {
        reasons.push(`"${clue.span.text}" fits that`);
      } else {
        conflicts.push(
          `"${clue.span.text}" usually means ${rangeLabel(range)}, which doesn't match the age you gave. Keeping your age.`,
        );
      }
      continue;
    }
    if (!hintRange) {
      hintRange = range;
      reasons.push(
        clue.kind === 'grade'
          ? `"${clue.span.text}" usually means ${rangeLabel(range)} in the US`
          : `"${clue.span.text}" suggests roughly ${rangeLabel(range)}`,
      );
    } else {
      const narrowed = intersect(hintRange, range);
      if (narrowed) hintRange = narrowed;
    }
  }

  for (const clue of byKind('years_ago')) {
    const n = clue.yearsAgo ?? 1;
    const range = {
      min: Math.max(0, context.currentAge - n - 1),
      max: Math.max(0, context.currentAge - n),
    };
    evidence.push(evidenceFrom(clue, 'counted back from today'));
    if (!statedRange && !dateRange) {
      statedRange = range;
      hedged = true;
      reasons.push(`"${clue.span.text}" counts back to about ${rangeLabel(range)}`);
    }
    if (clue.season && !season) season = clue.season;
  }

  for (const clue of byKind('relative')) {
    if (!clue.anchorPhrase || !clue.relation) continue;
    anchors.push({ relation: clue.relation, phrase: clue.anchorPhrase });
    evidence.push(evidenceFrom(clue, `${clue.relation} another event`));
  }

  const seasonClue = byKind('season')[0];
  if (seasonClue && !season) {
    season = seasonClue.season ?? null;
    evidence.push(evidenceFrom(seasonClue, 'a season'));
    reasons.push(`you mentioned ${seasonClue.span.text.toLowerCase()}`);
  }
  const monthClue = byKind('month')[0];
  if (monthClue && !month) {
    month = monthClue.month ?? null;
    evidence.push(evidenceFrom(monthClue, 'a month'));
    reasons.push(`you mentioned ${monthClue.span.text}`);
  }
  if (month && !season) season = seasonForMonth(month, context.hemisphere);

  let ageRange: Range | null = statedRange ?? hintRange;
  if (dateRange) {
    if (ageRange) {
      const narrowed = intersect(dateRange, ageRange);
      if (narrowed) ageRange = narrowed;
      else {
        conflicts.push(
          `The date points to age ${rangeLabel(dateRange)}, but the age you gave is ${rangeLabel(ageRange)}. Keeping the date.`,
        );
        ageRange = dateRange;
      }
    } else {
      ageRange = dateRange;
    }
  }

  const sawUnknown = byKind('unknown').length > 0;
  const precision = pickPrecision({
    hasDate,
    day,
    month,
    year,
    ageRange,
    season,
    anchors,
    sawUnknown,
  });

  if (precision === 'unknown') {
    const partial = season ?? (month ? `that month` : null);
    const estimate = emptyEstimate(
      sawUnknown
        ? "You said you're not sure when this happened, so it stays unplaced until you know more."
        : partial
          ? `You mentioned ${season ? `a ${season}` : partial}, but not which year or how old you were, so it waits in your loose pages for now.`
          : 'There were no time clues in what you said, so this stays unplaced for now.',
    );
    estimate.evidence = evidence;
    estimate.season = season;
    estimate.month = month;
    estimate.conflicts = conflicts;
    return estimate;
  }

  const approximate =
    hedged ||
    (!statedRange && !hasDate) ||
    (ageRange !== null && ageRange.min !== ageRange.max) ||
    precision === 'relative';

  const confidence: Confidence =
    hasDate || (statedRange && !hedged)
      ? conflicts.length
        ? 'medium'
        : 'high'
      : statedRange
        ? 'medium'
        : 'low';

  const estimate: TemporalEstimate = {
    precision,
    ageMin: ageRange?.min ?? null,
    ageMax: ageRange?.max ?? null,
    year,
    month,
    day,
    season,
    approximate,
    confidence,
    anchors,
    evidence,
    explanation: '',
    conflicts,
  };
  estimate.explanation = explain(estimate, reasons);
  return estimate;
}

function pickPrecision(input: {
  hasDate: boolean;
  day: number | null;
  month: number | null;
  year: number | null;
  ageRange: Range | null;
  season: Season | null;
  anchors: TemporalAnchor[];
  sawUnknown: boolean;
}): TemporalEstimate['precision'] {
  if (input.hasDate && input.day) return 'exact';
  if (input.hasDate && input.month) return 'month';
  if (input.hasDate && input.year) return 'year';
  if (input.ageRange) {
    if (input.ageRange.min !== input.ageRange.max) return 'age_range';
    return input.season || input.month ? 'season_age' : 'age';
  }
  if (input.anchors.length) return 'relative';
  return 'unknown';
}

function explain(estimate: TemporalEstimate, reasons: string[]): string {
  const parts: string[] = [];
  if (reasons.length) parts.push(`I placed this because ${joinReasons(reasons)}.`);
  if (estimate.precision === 'relative') {
    parts.push(
      'It depends on when another event happened, so I need that event before I can place it.',
    );
  }
  if (estimate.approximate && estimate.precision !== 'relative') {
    parts.push('This is an estimate, not a fixed date.');
  }
  return parts.join(' ');
}

function joinReasons(reasons: string[]): string {
  const unique = [...new Set(reasons)];
  if (unique.length === 1) return unique[0]!;
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

export function resolveAnchors(estimate: TemporalEstimate, events: KnownEvent[]): TemporalEstimate {
  if (!estimate.anchors.length || !events.length) return estimate;
  let range: Range | null =
    estimate.ageMin !== null && estimate.ageMax !== null
      ? { min: estimate.ageMin, max: estimate.ageMax }
      : null;
  const notes: string[] = [];

  for (const anchor of estimate.anchors) {
    const anchorTerms = termSet(anchor.phrase);
    let best: { event: KnownEvent; shared: string[] } | null = null;
    for (const event of events) {
      if (event.ageMin === null || event.ageMax === null) continue;
      const shared = overlap(anchorTerms, termSet(event.label));
      if (shared.length && (!best || shared.length > best.shared.length)) best = { event, shared };
    }
    if (!best) continue;
    const { event } = best;
    const bound: Range =
      anchor.relation === 'before'
        ? { min: 0, max: event.ageMax! }
        : anchor.relation === 'after'
          ? { min: event.ageMin!, max: 200 }
          : { min: event.ageMin!, max: event.ageMax! };
    const next: Range | null = range ? intersect(range, bound) : bound;
    if (!next) continue;
    range = next;
    const where =
      event.ageMin === event.ageMax
        ? `age ${event.ageMin}`
        : `ages ${event.ageMin} to ${event.ageMax}`;
    notes.push(
      `You said this was ${anchor.relation} "${anchor.phrase}". "${event.label}" is at ${where}`,
    );
  }

  if (!range || !notes.length) return estimate;
  const max = range.max === 200 ? null : range.max;
  const resolved: TemporalEstimate = {
    ...estimate,
    ageMin: range.min,
    ageMax: max ?? range.min,
    precision:
      range.min === (max ?? range.min) ? (estimate.season ? 'season_age' : 'age') : 'age_range',
    approximate: true,
    confidence: estimate.confidence === 'high' ? 'medium' : estimate.confidence,
  };
  const label =
    max === null
      ? `age ${range.min} or later`
      : range.min === 0
        ? `age ${max} or younger`
        : `about ${rangeLabel({ min: range.min, max })}`;
  resolved.explanation = `${notes.join('. ')}, so this is probably ${label}. It's a suggestion until you confirm it.`;
  if (max === null) resolved.ageMax = null;
  return resolved;
}

export function placementAges(estimate: Pick<TemporalEstimate, 'ageMin' | 'ageMax'>): number[] {
  const { ageMin, ageMax } = estimate;
  if (ageMin === null || ageMax === null) return [];
  if (ageMax - ageMin > MAX_PLACEMENT_SPREAD) return [];
  const ages: number[] = [];
  for (let age = ageMin; age <= ageMax; age += 1) ages.push(age);
  return ages;
}

export function describeWhen(estimate: {
  precision: string;
  ageMin: number | null;
  ageMax: number | null;
  year: number | null;
  month: number | null;
  day: number | null;
  season: string | null;
  approximate: boolean;
}): string {
  const { precision, ageMin, ageMax, year, month, day, season, approximate } = estimate;
  const about = approximate ? 'about ' : '';
  const ageText =
    ageMin === null
      ? ''
      : ageMax === null
        ? `age ${ageMin} or later`
        : ageMin === ageMax
          ? `age ${about}${ageMin}`
          : ageMax - ageMin === 1
            ? `age ${ageMin} or ${ageMax}`
            : ageMin === 0
              ? `age ${ageMax} or younger`
              : `between ${ageMin} and ${ageMax}`;

  switch (precision) {
    case 'exact':
      return `${monthName(month!)} ${day}, ${year}`;
    case 'month':
      return `${monthName(month!)} ${year}`;
    case 'year':
      return season ? `${capitalize(season)} ${year}` : `${year}`;
    case 'season_age':
      return `${capitalize(month ? monthName(month) : (season ?? ''))}, ${ageText}`;
    case 'age':
      return capitalize(ageText);
    case 'age_range':
      return season || month
        ? `${capitalize(month ? monthName(month) : season!)}, ${ageText}`
        : capitalize(ageText);
    case 'relative':
      return 'Placed by another event';
    default:
      return season ? `Some ${season}, year unknown` : 'Not placed yet';
  }
}
