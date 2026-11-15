export interface ReadingSegment {
  text: string;
  pause: number;
  speed: number;
}

const SLOW = new Set([
  'sad',
  'disappointed',
  'peaceful',
  'nostalgic',
  'grateful',
  'confused',
  'hurt',
  'lonely',
  'regretful',
  'guilty',
  'betrayed',
]);
const LIVELY = new Set(['happy', 'excited', 'proud', 'confident', 'hopeful']);

function baseSpeed(mood: string | null | undefined): number {
  if (!mood) return 0.94;
  if (SLOW.has(mood)) return 0.88;
  if (LIVELY.has(mood)) return 0.98;
  if (mood === 'anxious' || mood === 'angry') return 0.95;
  return 0.94;
}

function tidy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\.{3,}/g, '…')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim();
}

function splitLong(sentence: string): string[] {
  if (sentence.length <= 220) return [sentence];
  const middle = sentence.length / 2;
  const cuts = [...sentence.matchAll(/[;,]\s+/g)].map((m) => (m.index ?? 0) + 1);
  if (!cuts.length) return [sentence];
  const cut = cuts.reduce((best, c) => (Math.abs(c - middle) < Math.abs(best - middle) ? c : best));
  return [...splitLong(sentence.slice(0, cut).trim()), ...splitLong(sentence.slice(cut).trim())];
}

function pauseAfter(sentence: string, paragraphEnd: boolean): number {
  const end = sentence.replace(/["”’)\]]+$/, '').slice(-1);
  const base =
    end === '?'
      ? 560
      : end === '!'
        ? 420
        : end === '…'
          ? 720
          : end === ':'
            ? 380
            : end === ',' || end === ';'
              ? 160
              : 440;
  return base + (paragraphEnd ? 480 : 0);
}

export function planReading(
  text: string,
  options: { mood?: string | null; title?: string | null } = {},
): ReadingSegment[] {
  const speed = baseSpeed(options.mood);
  const segments: ReadingSegment[] = [];
  if (options.title)
    segments.push({
      text: tidy(options.title).replace(/[^.!?…]$/, '$&.'),
      pause: 750,
      speed: speed * 0.96,
    });

  const paragraphs = text
    .split(/\n{2,}/)
    .map(tidy)
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    const sentences = (paragraph.match(/[^.!?…]+(?:[.!?…]+["”’)]*|$)/g) ?? [paragraph])
      .map((s) => s.trim())
      .filter(Boolean);
    const merged: string[] = [];
    for (const sentence of sentences) {
      const last = merged[merged.length - 1];
      if (last && last.length < 14 && !/[?!…]["”’)]*$/.test(last))
        merged[merged.length - 1] = `${last} ${sentence}`;
      else merged.push(sentence);
    }
    const pieces = merged.flatMap(splitLong);
    pieces.forEach((piece, i) => {
      const words = piece.split(/\s+/).length;
      const question = /\?["”’)]*$/.test(piece);
      const variation = question ? 1.02 : words > 26 ? 1.03 : words < 7 ? 0.95 : 1;
      segments.push({
        text: /[.!?…,;:]["”’)]*$/.test(piece) ? piece : `${piece}.`,
        pause: pauseAfter(piece, i === pieces.length - 1),
        speed: Math.round(speed * variation * 100) / 100,
      });
    });
  }
  return segments;
}

const JOINERS = new Set([
  'and',
  'but',
  'because',
  'when',
  'before',
  'after',
  'so',
  'then',
  'until',
  'while',
  'as',
  'where',
  'which',
]);

export function leadIn(segment: ReadingSegment): ReadingSegment[] {
  const words = segment.text.split(' ');
  if (segment.text.length < 56 || words.length < 9) return [segment];
  let cut = -1;
  let pause = 140;
  for (let i = 2; i < Math.min(12, words.length - 3); i += 1) {
    if (/,["”’)]*$/.test(words[i]!)) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) {
    for (let i = 3; i < Math.min(12, words.length - 3); i += 1) {
      if (JOINERS.has(words[i]!.toLowerCase())) {
        cut = i;
        pause = 90;
        break;
      }
    }
  }
  if (cut < 0) return [segment];
  const head = words.slice(0, cut).join(' ');
  return [
    { text: /,["”’)]*$/.test(head) ? head : `${head},`, pause, speed: segment.speed },
    { text: words.slice(cut).join(' '), pause: segment.pause, speed: segment.speed },
  ];
}
