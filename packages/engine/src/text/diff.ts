import type { DiffSegment } from '../types';

const MAX_CELLS = 4_000_000;

function words(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

function comparable(word: string): string {
  return word.trim();
}

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = words(before);
  const b = words(after);

  if (a.length * b.length > MAX_CELLS) {
    return [
      { type: 'removed', text: before },
      { type: 'added', text: after },
    ];
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        comparable(a[i]!) === comparable(b[j]!)
          ? table[(i + 1) * cols + j + 1]! + 1
          : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment['type'], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (comparable(a[i]!) === comparable(b[j]!)) {
      push('same', b[j]!);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) {
      push('removed', a[i]!);
      i += 1;
    } else {
      push('added', b[j]!);
      j += 1;
    }
  }
  while (i < a.length) push('removed', a[i++]!);
  while (j < b.length) push('added', b[j++]!);
  return segments;
}
