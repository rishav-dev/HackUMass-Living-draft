import type { TextSpan } from '../types';

const SENTENCE_END = /[.!?]+["')\]]*(?=\s|$)|\n+/g;

export function splitSentences(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let cursor = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = (match.index ?? 0) + match[0].length;
    pushTrimmed(spans, text, cursor, end);
    cursor = end;
  }
  pushTrimmed(spans, text, cursor, text.length);
  return spans;
}

const CLAUSE_BREAK =
  /;|,\s*(?:and then|but|so|and|because)\s+|\s+(?:but|because|and then)\s+|\s+—\s+/gi;

export function splitClauses(text: string): TextSpan[] {
  const clauses: TextSpan[] = [];
  for (const sentence of splitSentences(text)) {
    let cursor = sentence.start;
    const body = text.slice(sentence.start, sentence.end);
    for (const match of body.matchAll(CLAUSE_BREAK)) {
      const breakStart = sentence.start + (match.index ?? 0);
      pushTrimmed(clauses, text, cursor, breakStart);
      cursor = breakStart + match[0].length;
    }
    pushTrimmed(clauses, text, cursor, sentence.end);
  }
  return clauses;
}

function pushTrimmed(target: TextSpan[], text: string, start: number, end: number) {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text[s] ?? '')) s += 1;
  while (e > s && /\s/.test(text[e - 1] ?? '')) e -= 1;
  if (e - s > 1 && /[A-Za-z0-9]/.test(text.slice(s, e))) {
    target.push({ start: s, end: e, text: text.slice(s, e) });
  }
}

export function sentenceAt(text: string, offset: number): TextSpan {
  const sentences = splitSentences(text);
  return (
    sentences.find((s) => offset >= s.start && offset < s.end) ??
    sentences[sentences.length - 1] ?? { start: 0, end: text.length, text }
  );
}

export function snippetAround(text: string, start: number, end: number, radius = 60): TextSpan {
  const sentence = sentenceAt(text, start);
  if (sentence.end - sentence.start <= radius * 2.5) return sentence;
  const from = Math.max(sentence.start, start - radius);
  const to = Math.min(sentence.end, end + radius);
  return { start: from, end: to, text: text.slice(from, to) };
}
