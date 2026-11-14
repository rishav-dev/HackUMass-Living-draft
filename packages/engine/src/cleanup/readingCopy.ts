import { diffWords } from '../text/diff';
import type { ReadingCopy } from '../types';

const FILLER_WORDS = /(^|[\s,])(?:u+m+|u+h+|e+r+m+|uhm+|hm+|mm+)(?=[\s,.!?]|$)[,]?/gi;
const SPOKEN_ASIDES = /,\s*(?:you know|i mean|like)\s*,/gi;
const LEADING_ASIDE = /(^|[.!?]\s+)(?:so,?\s+)?(?:you know|i mean),\s*/gi;
const STUTTER = /\b([a-z]{1,4})-\s+(?=\1)/gi;
const REPEATED_WORD = /\b([a-z']+)(?:\s+\1\b)+/gi;
const KEEP_DOUBLED = new Set([
  'had',
  'that',
  'is',
  'very',
  'so',
  'really',
  'bye',
  'no',
  'yes',
  'ha',
]);

function removeFillers(text: string): { text: string; count: number } {
  let count = 0;
  let next = text.replace(FILLER_WORDS, (_match, lead: string) => {
    count += 1;
    return lead === ',' ? ',' : lead;
  });
  next = next.replace(SPOKEN_ASIDES, () => {
    count += 1;
    return ',';
  });
  next = next.replace(LEADING_ASIDE, (_match, lead: string) => {
    count += 1;
    return lead;
  });
  return { text: next, count };
}

function removeRepeats(text: string): { text: string; count: number } {
  let count = 0;
  let next = text.replace(STUTTER, () => {
    count += 1;
    return '';
  });
  next = next.replace(REPEATED_WORD, (match, word: string) => {
    if (KEEP_DOUBLED.has(word.toLowerCase())) return match;
    count += 1;
    return word;
  });
  return { text: next, count };
}

function tidySpacing(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[A-Za-z])/g, '$1 ')
    .replace(/([.!?])(?=[A-Z])/g, '$1 ')
    .replace(/,\s*,/g, ',')
    .replace(/(^|[.!?]\s+),\s*/g, '$1')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fixCapitals(text: string): string {
  let next = text.replace(/\bi\b(?=('m|'ve|'d|'ll|\s|[,.!?]|$))/g, 'I');
  next = next.replace(
    /(^|[.!?]\s+|\n)([a-z])/g,
    (_m, lead: string, letter: string) => lead + letter.toUpperCase(),
  );
  return next;
}

function closeSentence(text: string): string {
  if (!text) return text;
  return /[.!?"')\]]$/.test(text) ? text : `${text}.`;
}

export function makeReadingCopy(original: string): ReadingCopy {
  const normalized = original.replace(/\r\n?/g, '\n').replace(/[’]/g, "'");
  const fillers = removeFillers(normalized);
  const repeats = removeRepeats(fillers.text);
  const text = closeSentence(fixCapitals(tidySpacing(repeats.text)));
  return {
    text,
    diff: diffWords(original.trim(), text),
    removedFillers: fillers.count,
    removedRepeats: repeats.count,
  };
}
