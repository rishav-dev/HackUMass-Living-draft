import { NUMBER_PATTERN, ORDINAL_PATTERN, parseNumber, parseOrdinal } from '../text/numbers';
import type { DateOrder, Season, TemporalClue, TextSpan } from '../types';

const MONTHS =
  '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
const MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};
const YEAR = '((?:19|20)\\d{2})';
const HEDGE_WORDS = '(?:about|around|maybe|probably|like|roughly|almost|nearly|only|just|barely)';

const HEDGES = [
  /\bi think\b/gi,
  /\bi guess\b/gi,
  /\bmaybe\b/gi,
  /\bprobably\b/gi,
  /\b(?:i'?m|i am) not (?:totally |really |completely )?sure\b/gi,
  /\bnot sure\b/gi,
  /\bor so\b/gi,
  /\bsomething like\b/gi,
  /\bmust have been\b/gi,
  /\bmight have been\b/gi,
  /\bi don'?t remember exactly\b/gi,
  /\bif i remember (?:right|correctly)\b/gi,
];

const LIFE_STAGES: Array<{ pattern: RegExp; ageMin: number; ageMax: number; note: string }> = [
  {
    pattern: /\bas (?:a|an) (?:little )?(?:baby|infant)\b/gi,
    ageMin: 0,
    ageMax: 1,
    note: 'as a baby',
  },
  { pattern: /\bas a toddler\b/gi, ageMin: 1, ageMax: 3, note: 'as a toddler' },
  { pattern: /\b(?:preschool|pre-?k|nursery school)\b/gi, ageMin: 3, ageMax: 4, note: 'preschool' },
  { pattern: /\bkindergarten\b/gi, ageMin: 5, ageMax: 6, note: 'kindergarten' },
  {
    pattern: /\b(?:in|during|at) (?:elementary|primary|grade) school\b/gi,
    ageMin: 5,
    ageMax: 11,
    note: 'elementary school',
  },
  {
    pattern: /\b(?:in|during|at) middle school\b/gi,
    ageMin: 11,
    ageMax: 14,
    note: 'middle school',
  },
  {
    pattern: /\b(?:in|during|at) (?:high|secondary) school\b/gi,
    ageMin: 14,
    ageMax: 18,
    note: 'high school',
  },
  { pattern: /\bas a teen(?:ager)?\b/gi, ageMin: 13, ageMax: 19, note: 'as a teenager' },
  {
    pattern: /\b(?:in|during|at) (?:college|university|uni)\b/gi,
    ageMin: 18,
    ageMax: 22,
    note: 'college',
  },
  {
    pattern: /\b(?:in|during) grad(?:uate)? school\b/gi,
    ageMin: 22,
    ageMax: 27,
    note: 'grad school',
  },
  { pattern: /\bas a (?:little )?(?:kid|child)\b/gi, ageMin: 3, ageMax: 11, note: 'as a kid' },
];

const SCHOOL_YEARS: Record<string, [number, number]> = {
  freshman: [14, 15],
  sophomore: [15, 16],
  junior: [16, 17],
  senior: [17, 18],
};

const HOLIDAY_MONTHS: Array<{ pattern: RegExp; month: number }> = [
  { pattern: /\bchristmas\b/gi, month: 12 },
  { pattern: /\bnew year'?s eve\b/gi, month: 12 },
  { pattern: /\bhalloween\b/gi, month: 10 },
  { pattern: /\bthanksgiving\b/gi, month: 11 },
  { pattern: /\bvalentine'?s day\b/gi, month: 2 },
  { pattern: /\bfourth of july\b/gi, month: 7 },
];

function span(match: RegExpMatchArray, offset = 0, length?: number): TextSpan {
  const start = (match.index ?? 0) + offset;
  const text =
    length === undefined ? match[0].slice(offset) : match[0].slice(offset, offset + length);
  return { start, end: start + text.length, text };
}

function overlaps(a: TextSpan, b: TextSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

function normalizeSeason(raw: string): Season {
  const value = raw.toLowerCase();
  return value === 'fall' ? 'autumn' : (value as Season);
}

function isHedged(text: string, at: TextSpan): boolean {
  const windowStart = Math.max(0, at.start - 40);
  const nearby = text.slice(windowStart, Math.min(text.length, at.end + 25)).toLowerCase();
  const hedgeWord = new RegExp(`\\b${HEDGE_WORDS}\\b`);
  return (
    HEDGES.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(nearby);
    }) ||
    hedgeWord.test(at.text.toLowerCase()) ||
    hedgeWord.test(text.slice(windowStart, at.start).toLowerCase().slice(-18))
  );
}

export function findHedges(text: string): TextSpan[] {
  const found: TextSpan[] = [];
  for (const pattern of HEDGES) {
    for (const match of text.matchAll(pattern)) found.push(span(match));
  }
  return found.sort((a, b) => a.start - b.start);
}

export function extractTemporalClues(
  text: string,
  options: { dateOrder?: DateOrder } = {},
): TemporalClue[] {
  const clues: TemporalClue[] = [];
  const taken: TextSpan[] = [];
  const add = (clue: Omit<TemporalClue, 'hedged'> & { hedged?: boolean }) => {
    if (taken.some((t) => overlaps(t, clue.span))) return;
    taken.push(clue.span);
    clues.push({ ...clue, hedged: clue.hedged ?? isHedged(text, clue.span) });
  };

  const unknown =
    /\b(?:i\s+)?(?:don'?t|do not|can'?t|cannot)\s+(?:really\s+)?(?:know|remember|recall)\s+(?:exactly\s+)?when\b|\bno idea when\b|\bnot sure when\b/gi;
  for (const match of text.matchAll(unknown))
    add({ kind: 'unknown', span: span(match), hedged: true });

  const monthDayYear = new RegExp(
    `\\b${MONTHS}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+${YEAR}\\b`,
    'gi',
  );
  for (const match of text.matchAll(monthDayYear)) {
    add({
      kind: 'exact_date',
      span: span(match),
      month: MONTH_INDEX[match[1]!.toLowerCase()],
      day: Number(match[2]),
      year: Number(match[3]),
    });
  }

  const dayMonthYear = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS},?\\s+${YEAR}\\b`,
    'gi',
  );
  for (const match of text.matchAll(dayMonthYear)) {
    add({
      kind: 'exact_date',
      span: span(match),
      day: Number(match[1]),
      month: MONTH_INDEX[match[2]!.toLowerCase()],
      year: Number(match[3]),
    });
  }

  for (const match of text.matchAll(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g)) {
    add({
      kind: 'exact_date',
      span: span(match),
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    });
  }

  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/((?:19|20)?\d{2})\b/g)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const rawYear = match[3]!;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const [month, day] = options.dateOrder === 'dmy' ? [second, first] : [first, second];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      add({ kind: 'exact_date', span: span(match), year, month, day, note: 'numeric date' });
    }
  }

  const monthYear = new RegExp(`\\b${MONTHS}\\.?\\s+(?:of\\s+)?${YEAR}\\b`, 'gi');
  for (const match of text.matchAll(monthYear)) {
    add({
      kind: 'month_year',
      span: span(match),
      month: MONTH_INDEX[match[1]!.toLowerCase()],
      year: Number(match[2]),
    });
  }

  const seasonYear = new RegExp(
    `\\b(spring|summer|autumn|fall|winter)\\s+(?:of\\s+)?${YEAR}\\b`,
    'gi',
  );
  for (const match of text.matchAll(seasonYear)) {
    add({
      kind: 'season_year',
      span: span(match),
      season: normalizeSeason(match[1]!),
      year: Number(match[2]),
    });
  }

  const yearInContext = new RegExp(
    `\\b(?:in|during|around|back in|since|by|of|year)\\s+${YEAR}\\b`,
    'gi',
  );
  for (const match of text.matchAll(yearInContext)) {
    const yearText = match[1]!;
    const offset = match[0].lastIndexOf(yearText);
    add({ kind: 'year', span: span(match, offset, yearText.length), year: Number(yearText) });
  }

  const birthday = new RegExp(
    `\\bmy\\s+(${NUMBER_PATTERN}|${ORDINAL_PATTERN}|\\d{1,2}(?:st|nd|rd|th))\\s+birthday\\b`,
    'gi',
  );
  for (const match of text.matchAll(birthday)) {
    const raw = match[1]!;
    const age =
      parseOrdinal(raw) ?? parseNumber(raw.replace(/(st|nd|rd|th)$/i, '')) ?? parseOrdinalWord(raw);
    if (age !== null) add({ kind: 'birthday', span: span(match), ageMin: age, ageMax: age });
  }

  const agePatterns: RegExp[] = [
    new RegExp(
      `\\b(?:when|while|since|by the time|back when|the year)\\s+i\\s+(?:was|turned|had just turned|was just)\\s+(?:${HEDGE_WORDS}\\s+)?(${NUMBER_PATTERN})(?:\\s*(?:or|to|-)\\s*(${NUMBER_PATTERN}))?(?:\\s+years?\\s+old)?\\b`,
      'gi',
    ),
    new RegExp(
      `\\bi\\s+(?:was|must have been|might have been|would have been|was probably|was maybe)\\s+(?:${HEDGE_WORDS}\\s+)?(${NUMBER_PATTERN})(?:\\s*(?:or|to|-)\\s*(${NUMBER_PATTERN}))?\\s*(?:years?\\s+old|yrs? old)\\b`,
      'gi',
    ),
    new RegExp(
      `\\bi\\s+(?:was|must have been|might have been)\\s+(?:${HEDGE_WORDS}\\s+)?(${NUMBER_PATTERN})\\s+or\\s+(${NUMBER_PATTERN})\\b`,
      'gi',
    ),
    new RegExp(
      `\\bi\\s+was\\s+(?:${HEDGE_WORDS}\\s+)?(${NUMBER_PATTERN})(?=\\s*(?:[,.;!?]|$|\\s+(?:and|in|at|when|that|so|then)\\b))`,
      'gi',
    ),
    new RegExp(
      `\\b(?:at|around|about)\\s+(?:the\\s+)?age(?:\\s+of)?\\s+(${NUMBER_PATTERN})(?:\\s*(?:or|to|-)\\s*(${NUMBER_PATTERN}))?\\b`,
      'gi',
    ),
    new RegExp(
      `\\bage(?:d)?\\s+(${NUMBER_PATTERN})(?:\\s*(?:or|to|-)\\s*(${NUMBER_PATTERN}))?\\b`,
      'gi',
    ),
    new RegExp(`\\bat\\s+(${NUMBER_PATTERN})(?=\\s*,|\\s+(?:i|my|we|me|our)\\b)`, 'gi'),
    new RegExp(
      `\\b(?:spring|summer|autumn|fall|winter|year|day|night|week|month)\\s+(?:that\\s+|when\\s+)?i\\s+was\\s+(?:${HEDGE_WORDS}\\s+)?(${NUMBER_PATTERN})(?:\\s+or\\s+(${NUMBER_PATTERN}))?\\b`,
      'gi',
    ),
    new RegExp(`\\bas an?\\s+(${NUMBER_PATTERN})[- ]year[- ]old\\b`, 'gi'),
    new RegExp(`\\b(${NUMBER_PATTERN})[- ]year[- ]old me\\b`, 'gi'),
  ];
  for (const pattern of agePatterns) {
    for (const match of text.matchAll(pattern)) {
      const first = parseNumber(match[1]);
      const second = parseNumber(match[2]);
      if (first === null || first > 110) continue;
      const low = second !== null ? Math.min(first, second) : first;
      const high = second !== null ? Math.max(first, second) : first;
      if (high - low > 10) continue;
      add({ kind: 'age', span: span(match), ageMin: low, ageMax: high });
    }
  }

  const grade = new RegExp(
    `\\b(${ORDINAL_PATTERN})\\s+grade\\b|\\bgrade\\s+(${NUMBER_PATTERN})\\b`,
    'gi',
  );
  for (const match of text.matchAll(grade)) {
    const level = parseOrdinal(match[1]) ?? parseNumber(match[2]);
    if (level === null || level < 1 || level > 12) continue;
    add({
      kind: 'grade',
      span: span(match),
      ageMin: level + 5,
      ageMax: level + 6,
      note: `In the US, ${match[0].toLowerCase()} usually means about ${level + 5} or ${level + 6}. School years differ by country, so this is only a hint.`,
    });
  }

  const schoolYear =
    /\b(freshman|sophomore|junior|senior)\s+year(?:\s+(?:of|in)\s+(high school|college|university))?\b/gi;
  for (const match of text.matchAll(schoolYear)) {
    const [low, high] = SCHOOL_YEARS[match[1]!.toLowerCase()]!;
    const college = /college|university/i.test(match[2] ?? '');
    add({
      kind: 'grade',
      span: span(match),
      ageMin: college ? low + 4 : low,
      ageMax: college ? high + 4 : high,
      note: `${match[0]} usually means about ${college ? low + 4 : low} or ${college ? high + 4 : high}.`,
    });
  }

  for (const stage of LIFE_STAGES) {
    for (const match of text.matchAll(stage.pattern)) {
      add({
        kind: 'life_stage',
        span: span(match),
        ageMin: stage.ageMin,
        ageMax: stage.ageMax,
        note: stage.note,
      });
    }
  }

  const yearsAgo = new RegExp(
    `\\b(${NUMBER_PATTERN}|a couple of|a few|a)\\s+(years?|summers?|winters?|springs?|autumns?|falls?)\\s+ago\\b`,
    'gi',
  );
  for (const match of text.matchAll(yearsAgo)) {
    const raw = match[1]!.toLowerCase();
    const count =
      raw === 'a' ? 1 : raw === 'a couple of' ? 2 : raw === 'a few' ? 3 : parseNumber(raw);
    if (count === null) continue;
    const unit = match[2]!.toLowerCase().replace(/s$/, '');
    add({
      kind: 'years_ago',
      span: span(match),
      yearsAgo: count,
      season: unit === 'year' ? undefined : normalizeSeason(unit),
      hedged: raw.startsWith('a '),
    });
  }

  for (const match of text.matchAll(/\blast\s+(year|spring|summer|autumn|fall|winter)\b/gi)) {
    const unit = match[1]!.toLowerCase();
    add({
      kind: 'years_ago',
      span: span(match),
      yearsAgo: 1,
      season: unit === 'year' ? undefined : normalizeSeason(unit),
    });
  }

  const relative =
    /\b(right before|just before|before|right after|just after|after|around the time|around when|the year)\s+((?:my|our|we|i|the|mom|dad|grandma|grandpa)\b[^,.;!?]{2,60})/gi;
  for (const match of text.matchAll(relative)) {
    const word = match[1]!.toLowerCase();
    const relation = word.includes('before')
      ? 'before'
      : word.includes('after')
        ? 'after'
        : 'around';
    const phrase = trimAnchor(match[2]!);
    if (phrase.split(/\s+/).length < 2) continue;
    add({ kind: 'relative', span: span(match), relation, anchorPhrase: phrase, hedged: false });
  }
  for (const match of text.matchAll(
    /\b(before|after)\s+(graduation|the move|the divorce|the wedding|the funeral|the accident|college|high school)\b/gi,
  )) {
    add({
      kind: 'relative',
      span: span(match),
      relation: match[1]!.toLowerCase() === 'before' ? 'before' : 'after',
      anchorPhrase: match[2]!.toLowerCase(),
      hedged: false,
    });
  }

  const seasonWord =
    /\b(?:(?:the|that|in|last|this|one|during|early|late|mid|every)\s+)?(spring|summer|autumn|winter|fall)(?:\s+(?:vacation|holidays?|break|semester|camp|term|of))?\b/gi;
  for (const match of text.matchAll(seasonWord)) {
    const raw = match[1]!.toLowerCase();
    if (
      raw === 'fall' &&
      !/^(?:the|that|in|last|this|one|during|early|late|mid|every)\s/i.test(match[0]) &&
      !/fall\s+(?:vacation|holidays?|break|semester|term|of)/i.test(match[0])
    ) {
      continue;
    }
    add({ kind: 'season', span: span(match), season: normalizeSeason(raw) });
  }

  const monthOnly = new RegExp(
    `\\b(?:in|that|last|during|one|early|late|mid-?|every|this)\\s+${MONTHS}\\b`,
    'gi',
  );
  for (const match of text.matchAll(monthOnly)) {
    const month = MONTH_INDEX[match[1]!.toLowerCase()];
    if (month) add({ kind: 'month', span: span(match), month });
  }

  for (const holiday of HOLIDAY_MONTHS) {
    for (const match of text.matchAll(holiday.pattern)) {
      add({ kind: 'month', span: span(match), month: holiday.month, note: match[0] });
    }
  }

  return clues.sort((a, b) => a.span.start - b.span.start);
}

function parseOrdinalWord(raw: string): number | null {
  const tens: Record<string, number> = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50 };
  return tens[raw.toLowerCase()] ?? null;
}

function trimAnchor(raw: string): string {
  return raw
    .replace(/\s+(?:and|but|so|when|then|because)\s.*$/i, '')
    .replace(/\s+(?:we|i)\s+(?:went|were|had|used|lived|got)\b.*$/i, '')
    .trim();
}
