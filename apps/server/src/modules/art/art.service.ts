import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ArtStatusDto } from '@living-draft/contracts';
import { detectMotifs, MOTIF_SCENES, type Motif } from '@living-draft/engine';
import { all, get, placeholders, run } from '../../db/database';
import { config } from '../../config';
import { now } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import { findProfile } from '../profile/profile.repository';

const ENDPOINT = process.env.LIVING_DRAFT_ART_ENDPOINT ?? 'https://image.pollinations.ai/prompt/';
const TIMEOUT_MS = 90_000;
const FREE_GAP_MS = 46_000;
const MAX_ATTEMPTS = 3;

const LIGHT: Record<string, string> = {
  happy: 'warm golden light, vivid saturated color',
  excited: 'electric magenta and yellow light, high energy',
  peaceful: 'calm teal and soft green light, serene stillness',
  nostalgic: 'faded amber film tones, soft grain, late afternoon haze',
  grateful: 'warm rose and gold light, tender glow',
  proud: 'rising golden light, epic sky, triumphant',
  sad: 'cold deep blue tones, soft rain, quiet melancholy',
  disappointed: 'muted grey blue tones, overcast, subdued',
  angry: 'deep red and orange glow, drifting embers, dramatic contrast',
  anxious: 'violet and cyan haze, restless flickering light',
  confused: 'shifting indigo and teal fog, dreamlike distortion',
};

interface ArtRow {
  key: string;
  file_name: string;
  prompt: string;
  provider: string;
  created_at: string;
}

let queue: Promise<unknown> = Promise.resolve();
let nextSlot = 0;
const inFlight = new Map<string, Promise<ArtResult>>();

export type ArtResult =
  | { url: string }
  | { url: null; reason: 'disabled' | 'quota' | 'failed' | 'missing' | 'queued' | 'declined' };

class RateLimited extends Error {
  constructor(readonly waitMs: number) {
    super('Art service asked us to wait');
  }
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

export function artUrl(fileName: string): string {
  return `/media/${fileName}`;
}

export function findArt(keys: string[]): Map<string, string> {
  if (!keys.length) return new Map();
  return new Map(
    all<ArtRow>(`SELECT * FROM scene_art WHERE key IN (${placeholders(keys.length)})`, ...keys).map(
      (row) => [row.key, artUrl(row.file_name)],
    ),
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function artStatus(): ArtStatusDto {
  const profile = findProfile();
  const used =
    get<{ count: number }>('SELECT count FROM art_usage WHERE day = ?', today())?.count ?? 0;
  const limit = profile?.artDailyLimit ?? 8;
  return {
    online: profile?.artOnline ?? false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    queued: inFlight.size,
  };
}

function describe(
  texts: string[],
  emotions: string[],
  season: string | null,
): { prompt: string; seed: number } {
  const motifs = detectMotifs(texts.join(' '), 2) as Motif[];
  const scene = motifs.map((m) => MOTIF_SCENES[m]).join(', blending into ');
  const counts = new Map<string, number>();
  for (const e of emotions) counts.set(e, (counts.get(e) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const light = dominant ? (LIGHT[dominant] ?? 'luminous night colors') : 'luminous night colors';
  const seasonText = season ? `${season} season, ` : '';
  const prompt = `${scene}, ${seasonText}${light}, dreamlike cinematic digital painting, volumetric light, glowing particles, rich depth, no text, no people`;
  let seed = 0;
  for (const char of texts.join('')) seed = (seed * 31 + char.charCodeAt(0)) % 1_000_000;
  return { prompt, seed };
}

export function promptFor(key: string): { prompt: string; seed: number } | null {
  const archive = Archive.load();
  if (key.startsWith('memory:')) {
    const id = key.slice(7);
    if (!archive.memory(id)) return null;
    const doc = archive.doc(id);
    return describe(
      [doc.title, doc.text],
      doc.emotions.map((e) => e.tag),
      doc.season,
    );
  }
  if (key.startsWith('day:')) {
    const date = key.slice(4);
    const ids = dayMemoryIds(archive, date);
    if (!ids.length) return null;
    const docs = ids.map((id) => archive.doc(id));
    return describe(
      docs.map((d) => `${d.title} ${d.text}`),
      docs.flatMap((d) => d.emotions.map((e) => e.tag)),
      docs[0]?.season ?? null,
    );
  }
  return null;
}

export function dayMemoryIds(archive: Archive, date: string): string[] {
  const [year, month, day] = date.split('-').map(Number);
  return archive.memories
    .filter((m) => {
      const t = archive.temporal(m.id);
      return t.precision === 'exact' && t.year === year && t.month === month && t.day === day;
    })
    .map((m) => m.id);
}

async function download(prompt: string, seed: number): Promise<Buffer> {
  const url = `${ENDPOINT}${encodeURIComponent(prompt)}?width=1280&height=760&seed=${seed}&nologo=true&enhance=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'living-draft/0.1' },
    });
    if (response.status === 402 || response.status === 429) {
      const text = await response.text();
      const seconds = Number(
        /retry after (\d+)/i.exec(text)?.[1] ?? response.headers.get('retry-after') ?? 45,
      );
      throw new RateLimited((seconds + 2) * 1000);
    }
    if (!response.ok) throw new Error(`Art service answered ${response.status}`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error('Art service did not return an image');
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export function storeArt(
  key: string,
  prompt: string,
  provider: string,
  data: Buffer,
  ext = '.jpg',
): string {
  fs.mkdirSync(config.mediaDir, { recursive: true });
  const fileName = `art-${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(config.mediaDir, fileName), data);
  const previous = get<ArtRow>('SELECT * FROM scene_art WHERE key = ?', key);
  if (previous) fs.rmSync(path.join(config.mediaDir, previous.file_name), { force: true });
  run(
    `INSERT INTO scene_art (key, file_name, prompt, provider, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET file_name = excluded.file_name, prompt = excluded.prompt, provider = excluded.provider, created_at = excluded.created_at`,
    key,
    fileName,
    prompt,
    provider,
    now(),
  );
  return artUrl(fileName);
}

function countUse() {
  run(
    'INSERT INTO art_usage (day, count) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET count = count + 1',
    today(),
  );
}

async function fetchPaced(prompt: string, seed: number): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    const wait = nextSlot - Date.now();
    if (wait > 0) await pause(wait);
    nextSlot = Date.now() + FREE_GAP_MS;
    try {
      return await download(prompt, seed);
    } catch (error) {
      if (!(error instanceof RateLimited) || attempt >= MAX_ATTEMPTS) throw error;
      nextSlot = Date.now() + error.waitMs;
    }
  }
}

function isDeclined(key: string): boolean {
  return Boolean(get<{ key: string }>('SELECT key FROM art_declined WHERE key = ?', key));
}

export function declineArt(key: string) {
  deleteArt([key]);
  run(
    'INSERT INTO art_declined (key, declined_at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET declined_at = excluded.declined_at',
    key,
    now(),
  );
}

function check(key: string, options: { ignoreQuota?: boolean; fresh?: boolean }): ArtResult | null {
  const existing = findArt([key]).get(key);
  if (existing && !options.fresh) return { url: existing };
  if (!options.fresh && isDeclined(key)) return { url: null, reason: 'declined' };
  if (options.ignoreQuota) return null;
  const status = artStatus();
  if (!status.online) return { url: null, reason: 'disabled' };
  if (status.remaining - status.queued <= 0) return { url: null, reason: 'quota' };
  return null;
}

export function generateArt(
  key: string,
  options: { ignoreQuota?: boolean; fresh?: boolean } = {},
): Promise<ArtResult> {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const early = check(key, options);
  if (early) return Promise.resolve(early);

  const job = (queue = queue.then(async (): Promise<ArtResult> => {
    const again = findArt([key]).get(key);
    if (again && !options.fresh) return { url: again };
    const spec = promptFor(key);
    if (!spec) return { url: null, reason: 'missing' };
    const seed = options.fresh ? Math.floor(Math.random() * 1_000_000) : spec.seed;
    try {
      const data = await fetchPaced(spec.prompt, seed);
      countUse();
      return { url: storeArt(key, spec.prompt, 'pollinations', data) };
    } catch {
      return { url: null, reason: 'failed' };
    }
  })) as Promise<ArtResult>;
  inFlight.set(key, job);
  void job.finally(() => inFlight.delete(key));
  return job;
}

export function requestArt(key: string, fresh = false): ArtResult {
  const early = inFlight.has(key) ? null : check(key, { fresh });
  if (early) return early;
  if (fresh) {
    run('DELETE FROM art_declined WHERE key = ?', key);
    deleteArt([key]);
  }
  void generateArt(key, { fresh });
  return { url: null, reason: 'queued' };
}

export function deleteArt(keys: string[]) {
  for (const row of keys.length
    ? all<ArtRow>(`SELECT * FROM scene_art WHERE key IN (${placeholders(keys.length)})`, ...keys)
    : []) {
    fs.rmSync(path.join(config.mediaDir, row.file_name), { force: true });
    run('DELETE FROM scene_art WHERE key = ?', row.key);
  }
}
