import { splitSentences } from '../text/sentences';
import type { CharacterRole, PersonKind, PersonMention, TextSpan } from '../types';
import {
  CONFLICT_WITH,
  DRIVER_VERBS,
  KIN_GROUPS,
  NAME_TITLES,
  NOT_NAMES,
  PLACE_WORDS,
  ROLE_WORDS,
  SUPPORT_VERBS,
} from './lexicon';

interface RawMention {
  key: string;
  label: string;
  kind: PersonKind;
  span: TextSpan;
  relationship?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function surfacePattern(surfaces: string[]): RegExp {
  const sorted = [...surfaces].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`\\b(?:(?:my|our|his|her|their)\\s+)?(${sorted.join('|')})(?:'s)?\\b`, 'gi');
}

const KIN_PATTERNS = KIN_GROUPS.map((group) => ({
  group,
  pattern: surfacePattern(group.surfaces),
}));
const ROLE_PATTERNS = ROLE_WORDS.map((role) => ({ role, pattern: surfacePattern(role.surfaces) }));

export function normalizePersonKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']s$/, '')
    .replace(/^(my|our|the)\s+/, '')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function kinKeyFor(surface: string): string | null {
  const normalized = surface
    .toLowerCase()
    .replace(/^(my|our)\s+/, '')
    .trim();
  const group = KIN_GROUPS.find((g) => g.surfaces.includes(normalized));
  return group?.key ?? null;
}

function findKin(text: string): RawMention[] {
  const found: RawMention[] = [];
  for (const { group, pattern } of KIN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const word = match[1]!;
      const start = (match.index ?? 0) + match[0].indexOf(word);
      const precededByTitle = /\b(?:aunt|uncle|grandma|grandpa)\s*$/i.test(
        text.slice(Math.max(0, start - 8), start),
      );
      if (precededByTitle) continue;
      const followedByName = text.slice(start + word.length).match(/^\s+([A-Z][a-z]+)/);
      if (
        followedByName &&
        !NOT_NAMES.has(followedByName[1]!.toLowerCase()) &&
        ['aunt', 'uncle', 'grandma', 'grandpa'].includes(group.key)
      ) {
        continue;
      }
      found.push({
        key: group.key,
        label: group.label,
        kind: 'kin',
        span: { start, end: start + word.length, text: word },
      });
    }
  }
  return found;
}

function findRoles(text: string): RawMention[] {
  const found: RawMention[] = [];
  for (const { role, pattern } of ROLE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const word = match[1]!;
      if (
        role.key === 'friend' &&
        /best\s+$/i.test(text.slice(0, (match.index ?? 0) + match[0].indexOf(word)))
      )
        continue;
      if (
        /^friends?\b/i.test(word) &&
        /\b(?:make|made|making|have|had)\s+(?:new\s+)?$/i.test(text.slice(0, match.index ?? 0))
      )
        continue;
      const start = (match.index ?? 0) + match[0].indexOf(word);
      const owned = /^(?:my|our)\s/i.test(match[0]);
      if (!owned && !/\bthe\s+$/i.test(text.slice(Math.max(0, start - 4), start))) continue;
      found.push({
        key: role.key,
        label: role.label,
        kind: 'role',
        span: { start, end: start + word.length, text: word },
      });
    }
  }
  return found;
}

function findNames(text: string): RawMention[] {
  const found: RawMention[] = [];
  const sentenceStarts = new Set(splitSentences(text).map((s) => s.start));
  const titleAlternatives = NAME_TITLES.map(
    (t) => `[${t[0]!.toUpperCase()}${t[0]}]${t.slice(1)}`,
  ).join('|');
  const titled = new RegExp(`\\b(${titleAlternatives})\\.?\\s+([A-Z][a-zA-Z'-]+)`, 'g');
  const titledSpans: TextSpan[] = [];

  for (const match of text.matchAll(titled)) {
    const title = match[1]!;
    const name = match[2]!;
    if (NOT_NAMES.has(name.toLowerCase()) || PLACE_WORDS.has(name.toLowerCase())) continue;
    const start = match.index ?? 0;
    const full = `${capitalizeTitle(title)} ${name}`;
    const spanText = match[0];
    titledSpans.push({ start, end: start + spanText.length, text: spanText });
    found.push({
      key: normalizePersonKey(full),
      label: full,
      kind: 'name',
      span: { start, end: start + spanText.length, text: spanText },
    });
  }

  const capitalized = /\b([A-Z][a-z]{1,}(?:['-][A-Za-z]+)?)(?:\s+([A-Z][a-z]{1,}))?\b/g;
  const counts = new Map<string, number>();
  for (const match of text.matchAll(capitalized))
    counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + 1);

  for (const match of text.matchAll(capitalized)) {
    const first = match[1]!;
    const start = match.index ?? 0;
    if (titledSpans.some((t) => start >= t.start && start < t.end)) continue;
    if (NOT_NAMES.has(first.toLowerCase()) || PLACE_WORDS.has(first.toLowerCase())) continue;
    if (
      /\b(?:to|in|from|at|near|through|across|visit|visited|visiting|outside|around|of)\s+$/i.test(
        text.slice(Math.max(0, start - 12), start),
      )
    )
      continue;
    const atSentenceStart =
      sentenceStarts.has(start) || /[“"(]\s*$/.test(text.slice(Math.max(0, start - 2), start));
    if (atSentenceStart) {
      const looksLikeName =
        (counts.get(first) ?? 0) > 1 ||
        /^\s+(?:and\s+(?:I|me)|said|told|was|asked|came|helped|gave|took|cried|laughed|smiled|looked|walked|had|would|could|got|made)\b/.test(
          text.slice(start + first.length),
        );
      if (!looksLikeName) continue;
    }
    const second = match[2];
    const useSecond = second && !NOT_NAMES.has(second.toLowerCase());
    const name = useSecond ? `${first} ${second}` : first;
    const spanText = useSecond ? match[0] : first;
    found.push({
      key: normalizePersonKey(name),
      label: name,
      kind: 'name',
      span: { start, end: start + spanText.length, text: spanText },
    });
  }
  return found;
}

function capitalizeTitle(title: string): string {
  const lower = title.toLowerCase();
  const map: Record<string, string> = {
    mr: 'Mr.',
    mrs: 'Mrs.',
    ms: 'Ms.',
    dr: 'Dr.',
    prof: 'Prof.',
  };
  return map[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
}

interface RoleScore {
  score: number;
  evidence: string;
}

function scoreRole(text: string, spans: TextSpan[]): RoleScore {
  let score = spans.length >= 3 ? 2 : spans.length === 2 ? 1 : 0;
  let evidence = '';
  const sentences = splitSentences(text);

  for (const mention of spans) {
    const after = text.slice(mention.end, mention.end + 40).toLowerCase();
    const before = text.slice(Math.max(0, mention.start - 22), mention.start).toLowerCase();
    const sentence = sentences.find((s) => mention.start >= s.start && mention.start < s.end);

    const driver = DRIVER_VERBS.find((verb) =>
      new RegExp(
        `^\\s+(?:had\\s+|has\\s+|just\\s+|finally\\s+|never\\s+|also\\s+|then\\s+)?${verb}\\b`,
      ).test(after),
    );
    if (driver) {
      score += 3;
      evidence ||= sentence?.text ?? '';
      continue;
    }
    const conflict = CONFLICT_WITH.find(
      (phrase) => before.trimEnd().endsWith(phrase) || before.includes(`${phrase} my`),
    );
    if (conflict) {
      score += 3;
      evidence ||= sentence?.text ?? '';
      continue;
    }
    const support = SUPPORT_VERBS.find((verb) =>
      new RegExp(`^\\s+(?:had\\s+|also\\s+|then\\s+|just\\s+)?${verb}\\b`).test(after),
    );
    if (support) {
      score += 1;
      evidence ||= sentence?.text ?? '';
    }
  }
  if (!evidence) {
    const first = spans[0];
    const sentence = first
      ? sentences.find((s) => first.start >= s.start && first.start < s.end)
      : undefined;
    evidence = sentence?.text ?? '';
  }
  return { score, evidence };
}

function roleFor(score: number): CharacterRole {
  if (score >= 4) return 'central';
  if (score >= 1) return 'supporting';
  return 'mentioned';
}

export function detectPeople(text: string): PersonMention[] {
  const raw = [...findNames(text), ...findKin(text), ...findRoles(text)];
  raw.sort((a, b) => a.span.start - b.span.start);

  const deduped: RawMention[] = [];
  for (const mention of raw) {
    if (deduped.some((k) => mention.span.start < k.span.end && k.span.start < mention.span.end))
      continue;
    deduped.push(mention);
  }

  const kept: RawMention[] = [];
  const namedKin = new Map<string, string>();
  deduped.forEach((mention, index) => {
    const next = deduped[index + 1];
    const between = next ? text.slice(mention.span.end, next.span.start) : '';
    if (mention.kind !== 'name' && next?.kind === 'name' && /^\s*,?\s*$/.test(between)) {
      namedKin.set(next.key, mention.label);
      return;
    }
    kept.push(mention);
  });
  for (const mention of kept) {
    const relationship = namedKin.get(mention.key);
    if (relationship) mention.relationship = relationship;
  }

  const grouped = new Map<string, RawMention[]>();
  for (const mention of kept) {
    const list = grouped.get(mention.key) ?? [];
    list.push(mention);
    grouped.set(mention.key, list);
  }

  const people: PersonMention[] = [];
  for (const [key, mentions] of grouped) {
    const first = mentions[0]!;
    const spans = mentions.map((m) => m.span);
    const { score, evidence } = scoreRole(text, spans);
    people.push({
      key,
      label: first.label,
      kind: first.kind,
      surfaces: [...new Set(mentions.map((m) => m.span.text))],
      spans,
      role: roleFor(score),
      roleEvidence: evidence,
      confidence: first.kind === 'kin' ? 0.9 : first.kind === 'role' ? 0.6 : 0.7,
      relationship: mentions.find((m) => m.relationship)?.relationship,
    });
  }

  const order: Record<CharacterRole, number> = { central: 0, supporting: 1, mentioned: 2 };
  return people.sort(
    (a, b) => order[a.role] - order[b.role] || a.spans[0]!.start - b.spans[0]!.start,
  );
}

export function findSurfaceSpans(text: string, surfaces: string[]): TextSpan[] {
  const spans: TextSpan[] = [];
  const unique = [...new Set(surfaces.filter((s) => s.trim().length > 1))].sort(
    (a, b) => b.length - a.length,
  );
  for (const surface of unique) {
    const pattern = new RegExp(`\\b${escapeRegex(surface)}\\b`, 'gi');
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const span = { start, end: start + match[0].length, text: match[0] };
      if (spans.some((s) => span.start < s.end && s.start < span.end)) continue;
      spans.push(span);
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
