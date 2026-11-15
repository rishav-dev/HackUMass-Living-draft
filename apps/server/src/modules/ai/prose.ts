const LEADS_INTO_NAME =
  /(?:^|[\s(])(?:in|from|than|and|or|with|of|to|both|between|like|unlike|while|whereas|but|as|on|for|at|by|after|before)\s*$/i;

export function plain(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const dashes = sentence.match(/[—–]/g)?.length ?? 0;
      return sentence.replace(/\s*[—–]\s*/g, dashes === 1 ? ': ' : ', ');
    })
    .join(' ')
    .replace(/[,:]\s*([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function nameRefs(text: string, titleFor: (n: number) => string | undefined): string {
  return text.replace(
    /\s*\[(\d+(?:\s*,\s*\d+)*)\]/g,
    (_match, list: string, offset: number, whole: string) => {
      const before = whole.slice(0, offset);
      const titles = list
        .split(',')
        .map((n) => titleFor(Number(n.trim())))
        .filter((t): t is string => Boolean(t));
      if (!titles.length) return '';
      const startOfSentence = !before.trim() || /[.!?:]\s*$/.test(before);
      if (!startOfSentence && !LEADS_INTO_NAME.test(before)) return '';
      const names = titles.map((t) => `“${t}”`).join(' and ');
      return before && !/[(]$/.test(before) ? ` ${names}` : names;
    },
  );
}

export function refsIn(text: string): number[] {
  return [...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) =>
    m[1]!.split(',').map((n) => Number(n.trim())),
  );
}

const norm = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

export interface SourceText {
  id: string;
  title: string;
  text: string;
}

export function quotedFrom(paragraph: string, source: SourceText): string | null {
  const body = norm(source.text);
  for (const m of paragraph.matchAll(/(?:^|[\s(,:])['"“‘](.{12,200}?)['"”’](?=[\s.,;:!?)]|$)/g)) {
    const phrase = norm(m[1]!);
    if (phrase.trim().length >= 12 && body.includes(phrase)) return m[1]!.trim();
  }
  return null;
}

export function likelySources(paragraph: string, sources: SourceText[]): string[] {
  const docs = sources.map((s) => ({ id: s.id, body: norm(`${s.title} ${s.text}`), source: s }));
  const score = new Map<string, number>();
  const add = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n);
  for (const doc of docs) {
    if (quotedFrom(paragraph, doc.source)) add(doc.id, 4);
    if (norm(paragraph).includes(norm(doc.source.title))) add(doc.id, 3);
  }
  const words = new Set(
    norm(paragraph)
      .split(' ')
      .filter((w) => w.length > 4),
  );
  for (const word of words) {
    const holders = docs.filter((d) => d.body.includes(` ${word}`));
    if (holders.length === 1) add(holders[0]!.id, 1);
  }
  return [...score.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);
}
