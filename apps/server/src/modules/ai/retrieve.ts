import type { MemoryDoc } from '@living-draft/engine';
import { all, get, run } from '../../db/database';
import { config } from '../../config';
import { Archive } from '../archive/snapshot';

const KIN: string[][] = [
  ['father', 'dad', 'daddy', 'papa', 'pa', 'pop', 'pops', 'baba', 'abba', 'pitaji', 'appa'],
  ['mother', 'mom', 'mum', 'mommy', 'mummy', 'mama', 'ma', 'maa', 'amma', 'mataji', 'mam'],
  ['grandmother', 'grandma', 'granny', 'nani', 'dadi', 'gran', 'nanima', 'dadima'],
  ['grandfather', 'grandpa', 'granddad', 'nanaji', 'dadaji', 'gramps'],
  ['brother', 'bro', 'bhaiya', 'bhai'],
  ['sister', 'sis', 'didi', 'behen'],
  ['husband', 'hubby'],
  ['wife', 'wifey'],
  ['boyfriend', 'bf'],
  ['girlfriend', 'gf'],
  ['teacher', 'sir', 'maam', "ma'am", 'miss'],
  ['coach', 'trainer'],
  ['boss', 'manager', 'supervisor'],
];

const STOP = new Set(
  'a an the and or but of to in on at for with about my me i is was were has have had how why what when who did do does my your his her their it this that there because from as be been being over into than then so'.split(
    ' ',
  ),
);

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

const close = (word: string, target: string) =>
  word === target ||
  (word.length >= 4 &&
    target.length >= 4 &&
    distance(word, target) <= (target.length >= 7 ? 2 : 1));

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export function resolvePeople(question: string, archive: Archive): string[] {
  const asked = words(question);
  const found = new Set<string>();
  for (const character of archive.characters) {
    const names = [character.name, ...archive.aliases(character.id), character.relationship ?? '']
      .map((n) => n.toLowerCase().trim())
      .filter(Boolean);
    const nameWords = names.flatMap((n) => n.split(/\s+/));
    const families = KIN.filter((family) => nameWords.some((n) => family.includes(n)));
    const hit = asked.some(
      (w) =>
        names.some((n) => close(w, n)) ||
        nameWords.some((n) => n.length >= 3 && close(w, n)) ||
        families.some((family) => family.some((k) => close(w, k))),
    );
    if (hit) found.add(character.id);
  }
  return [...found];
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

type Embedder = (texts: string[]) => Promise<number[][]>;
let embedder: Promise<Embedder> | null = null;
const MODEL = 'Xenova/all-MiniLM-L6-v2';

function loadEmbedder(): Promise<Embedder> {
  embedder ??= (async () => {
    const transformers = await import('@huggingface/transformers');
    if (typeof process !== 'undefined' && process.versions?.node)
      transformers.env.cacheDir = config.modelDir;
    const extract = await transformers.pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    return async (texts: string[]) => {
      const output = await extract(texts, { pooling: 'mean', normalize: true });
      return output.tolist() as number[][];
    };
  })();
  embedder.catch(() => {
    embedder = null;
  });
  return embedder;
}

const docText = (doc: MemoryDoc) => `${doc.title}. ${doc.text}`.slice(0, 2400);

async function vectors(docs: MemoryDoc[]): Promise<Map<string, number[]>> {
  const stored = new Map(
    all<{ memory_id: string; text_hash: string; vector: string }>(
      'SELECT memory_id, text_hash, vector FROM memory_vectors WHERE model = ?',
      MODEL,
    ).map((row) => [row.memory_id, row]),
  );
  const result = new Map<string, number[]>();
  const stale = docs.filter((doc) => {
    const row = stored.get(doc.id);
    if (row && row.text_hash === hash(docText(doc))) {
      result.set(doc.id, JSON.parse(row.vector) as number[]);
      return false;
    }
    return true;
  });
  if (stale.length) {
    const embed = await loadEmbedder();
    for (let i = 0; i < stale.length; i += 16) {
      const batch = stale.slice(i, i + 16);
      const out = await embed(batch.map(docText));
      batch.forEach((doc, j) => {
        const vector = out[j]!.map((v) => Math.round(v * 10000) / 10000);
        result.set(doc.id, vector);
        run(
          `INSERT INTO memory_vectors (memory_id, model, text_hash, vector) VALUES (?, ?, ?, ?)
           ON CONFLICT (memory_id) DO UPDATE SET model = excluded.model, text_hash = excluded.text_hash, vector = excluded.vector`,
          doc.id,
          MODEL,
          hash(docText(doc)),
          JSON.stringify(vector),
        );
      });
    }
  }
  return result;
}

const cosine = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

export interface Retrieved {
  doc: MemoryDoc;
  score: number;
  viaPeople: boolean;
}

export async function retrieve(
  question: string,
  options: { limit?: number; includeQuiet?: boolean; memoryIds?: string[] } = {},
): Promise<{ found: Retrieved[]; people: string[]; archive: Archive }> {
  const archive = Archive.load();
  const docs = archive
    .docs()
    .filter((d) => options.includeQuiet || !d.sensitive)
    .filter((d) => !options.memoryIds?.length || options.memoryIds.includes(d.id));
  const people = resolvePeople(question, archive);
  const asked = words(question);
  let semantic = new Map<string, number>();
  try {
    const all = await vectors(docs);
    const [query] = await (await loadEmbedder())([question]);
    semantic = new Map(docs.map((d) => [d.id, cosine(query!, all.get(d.id) ?? [])]));
  } catch {
    semantic = new Map();
  }
  const scored = docs.map((doc) => {
    const viaPeople = doc.people.some((p) => people.includes(p.characterId));
    const roleBoost = doc.people
      .filter((p) => people.includes(p.characterId))
      .reduce(
        (best, p) =>
          Math.max(best, p.role === 'central' ? 0.35 : p.role === 'supporting' ? 0.25 : 0.12),
        0,
      );
    const text = docText(doc).toLowerCase();
    const keyword =
      asked.filter((w) => w.length > 3 && text.includes(w)).length / Math.max(3, asked.length);
    const score = (semantic.get(doc.id) ?? 0) + roleBoost + keyword * 0.3;
    return { doc, score, viaPeople };
  });
  const limit = options.limit ?? 9;
  const ranked = scored.sort((a, b) => b.score - a.score);
  const chosen = [
    ...ranked.filter((r) => r.viaPeople).slice(0, limit),
    ...ranked.filter((r) => !r.viaPeople && r.score > 0.32),
  ].slice(0, limit);
  const order = (r: Retrieved) => r.doc.ageMin ?? r.doc.ageMax ?? 999;
  return { found: chosen.sort((a, b) => order(a) - order(b)), people, archive };
}

export function followupsFor(memoryId: string): Array<{ question: string; answer: string }> {
  return all<{ question: string; answer: string }>(
    'SELECT question, answer FROM memory_questions WHERE memory_id = ? AND answer IS NOT NULL ORDER BY asked_at',
    memoryId,
  );
}

export function memoryLabel(memoryId: string): string {
  return (
    get<{ title: string }>('SELECT title FROM memories WHERE id = ?', memoryId)?.title ?? 'a memory'
  );
}
