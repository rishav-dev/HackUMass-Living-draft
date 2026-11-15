import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  CaptureAnalysisDto,
  ChapterDto,
  LifePathDto,
  DayWeatherDto,
  MemoryDetailDto,
  ProfileDto,
  VoiceStatusDto,
  WeatherNowDto,
} from '@living-draft/contracts';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-draft-test-'));
process.env.LIVING_DRAFT_DATA_DIR = dataDir;

let server: Server;
let base = '';
let cookie = '';

async function call<T>(
  method: string,
  url: string,
  payload?: unknown,
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (payload) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}/api${url}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]!;
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

async function capture(text: string) {
  const { body } = await call<CaptureAnalysisDto>('POST', '/memories/analyze', {
    text,
    kind: 'memory',
  });
  return body;
}

function decisions(analysis: CaptureAnalysisDto) {
  return analysis.people.map((p) => ({
    label: p.suggestion?.name ?? p.label,
    surfaces: p.surfaces,
    characterId: p.suggestion?.characterId ?? null,
    relationship: p.relationship,
    role: p.role,
    roleEvidence: p.roleEvidence,
    addAlias: true,
  }));
}

beforeAll(async () => {
  const { openDatabase } = await import('../src/db/database');
  const { createApp } = await import('../src/app');
  openDatabase(':memory:');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('Living Draft API', () => {
  let promiseId = '';

  it('locks the archive behind a passphrase once one is set', async () => {
    const setup = await call('POST', '/auth/setup', { passphrase: 'correct horse battery' });
    expect(setup.status).toBe(201);
    const saved = cookie;
    cookie = '';
    expect((await call('GET', '/life-path')).status).toBe(401);
    expect((await call('POST', '/auth/login', { passphrase: 'wrong one' })).status).toBe(401);
    expect(cookie).toBe('');
    const login = await call<{ authenticated: boolean }>('POST', '/auth/login', {
      passphrase: 'correct horse battery',
    });
    expect(login.body.authenticated).toBe(true);
    expect(cookie).not.toBe('');
    expect(cookie).not.toBe(saved);
  });

  it('sets up a profile and an empty life path', async () => {
    const created = await call('POST', '/profile', {
      preferredName: 'Sam',
      currentAge: 23,
      hemisphere: 'north',
    });
    expect(created.status).toBe(201);
    const { body } = await call<LifePathDto>('GET', '/life-path');
    expect(body.ages).toHaveLength(24);
    expect(body.future.length).toBeGreaterThan(0);
    expect(body.totalMemories).toBe(0);
  });

  it('saves a memory with the original words, a reading copy and an honest placement', async () => {
    const original =
      "Um, in sixth grade, around age 12, summer vacation started. I finished my assignments in four days because Mom promised she'd take us somewhere. Then Mom said we weren't going anywhere. I felt hurt and I argued with Mom.";
    const analysis = await capture(original);
    expect(analysis.temporal.ageMin).toBe(12);
    expect(analysis.temporal.season).toBe('summer');
    expect(analysis.people.find((p) => p.key === 'mom')?.role).toBe('central');

    const { status, body } = await call<MemoryDetailDto>('POST', '/memories', {
      title: analysis.title,
      originalText: original,
      readingCopy: analysis.readingCopy,
      sourceKind: 'typing',
      temporal: { ...analysis.temporal, confirmed: true },
      people: decisions(analysis),
      emotions: analysis.emotions.map((e) => ({
        tag: e.tag,
        phase: e.phase,
        source: 'suggested',
        evidence: e.quote,
      })),
    });
    expect(status).toBe(201);
    promiseId = body.id;
    expect(body.versions[0]!.originalText).toBe(original);
    expect(body.readingCopy).not.toMatch(/^Um/);
    expect(body.mentions.filter((m) => m.characterName === 'Mom').length).toBe(3);

    const chapter = await call<ChapterDto>('GET', '/chapters/12');
    expect(chapter.body.memories.map((m) => m.id)).toContain(promiseId);
  });

  it('suggests the existing memory for a later detail and keeps it as a new version', async () => {
    const text = 'Dad sided with Mom and nobody took me anywhere that summer.';
    const analysis = await capture(text);
    expect(analysis.matches[0]?.memoryId).toBe(promiseId);

    const { body } = await call<{
      memory: MemoryDetailDto;
      comparison: { counts: Record<string, number> };
    }>('POST', `/memories/${promiseId}/versions`, {
      originalText: text,
      readingCopy: analysis.readingCopy,
      sourceKind: 'typing',
      mode: 'addition',
      people: decisions(analysis),
    });
    expect(body.memory.versions).toHaveLength(2);
    expect(body.comparison.counts.contradictory).toBe(0);
    expect(body.memory.people.map((p) => p.name).sort()).toEqual(['Dad', 'Mom']);
    expect(body.memory.people.find((p) => p.name === 'Mom')?.role).toBe('central');
  });

  it('flags a less certain retelling for review without overwriting the original', async () => {
    const text =
      "Thinking about that summer again, I'm not sure Mom actually promised. Maybe I just assumed we'd go somewhere.";
    const analysis = await capture(text);
    const { body } = await call<{ memory: MemoryDetailDto }>(
      'POST',
      `/memories/${promiseId}/versions`,
      {
        originalText: text,
        readingCopy: analysis.readingCopy,
        sourceKind: 'speech',
        mode: 'addition',
        people: decisions(analysis),
      },
    );
    expect(body.memory.reviewStatus).toBe('needs_review');
    expect(body.memory.pendingReview.some((c) => c.kind === 'uncertain')).toBe(true);
    expect(body.memory.versions[0]!.originalText).toMatch(/Mom promised/);

    const item = body.memory.pendingReview[0]!;
    const resolved = await call<{ memory: MemoryDetailDto }>(
      'POST',
      `/memories/${promiseId}/resolutions`,
      {
        reviewItemId: item.id,
        earlierVersionId: item.earlierVersionId,
        laterVersionId: item.laterVersionId,
        changeKind: item.kind,
        earlierText: item.earlier?.text ?? null,
        laterText: item.later?.text ?? null,
        resolution: 'mark_uncertain',
      },
    );
    expect(resolved.body.memory.resolutions).toHaveLength(1);
    expect(resolved.body.memory.versions).toHaveLength(3);
  });

  it('keeps a capsule sealed and out of the life path', async () => {
    const future = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const created = await call<{ body: string | null; unlocked: boolean }>('POST', '/capsules', {
      title: 'To me at 25',
      originalText: 'I hope you still sing in the car.',
      readingCopy: 'I hope you still sing in the car.',
      unlockKind: 'date',
      unlockDate: future,
    });
    expect(created.body.unlocked).toBe(false);
    expect(created.body.body).toBeNull();
    const { body } = await call<LifePathDto>('GET', '/life-path');
    expect(body.totalMemories).toBe(1);
  });

  it('answers a question with citations from recorded memories only', async () => {
    const { body } = await call<{
      citations: Array<{ memoryId: string }>;
      lines: Array<{ text: string }>;
    }>('POST', '/ask', {
      question: 'How has my relationship with Mom changed over time?',
    });
    expect(body.citations.every((c) => c.memoryId === promiseId)).toBe(true);
    expect(body.lines.some((l) => /not who Mom is|doesn't say who Mom is/.test(l.text))).toBe(true);
  });

  it('keeps chapter notes, story order and scene art on this machine', async () => {
    const note = await call<{ body: string }>('PUT', '/chapters/12/note', {
      body: 'The summer things changed.',
    });
    expect(note.body.body).toBe('The summer things changed.');
    const notes = await call<Array<{ age: number }>>('GET', '/chapter-notes');
    expect(notes.body.map((n) => n.age)).toContain(12);

    expect((await call('PUT', '/story-order', { memoryIds: [promiseId] })).status).toBe(204);
    const cards = await call<Array<{ id: string; storyOrder: number | null }>>('GET', '/memories');
    expect(cards.body.find((c) => c.id === promiseId)?.storyOrder).toBe(0);

    await call('PATCH', '/profile', { artOnline: false });
    const art = await call<{ url: string | null; reason?: string }>('POST', '/art/generate', {
      key: `memory:${promiseId}`,
    });
    expect(art.body).toEqual({ url: null, reason: 'disabled' });
    const status = await call<{ online: boolean; used: number }>('GET', '/art/status');
    expect(status.body.online).toBe(false);
    expect(status.body.used).toBe(0);
    expect((await call('POST', '/art/generate', { key: 'anything else' })).status).toBe(400);

    const scene = await call<{ scenes: Array<{ artKey: string; motifs: string[] }> }>(
      'GET',
      `/playback?memoryId=${promiseId}`,
    );
    expect(scene.body.scenes[0]?.artKey).toBe(`memory:${promiseId}`);
    expect(scene.body.scenes[0]?.motifs.length).toBeGreaterThan(0);
    expect(Array.isArray((await call('GET', '/days')).body)).toBe(true);
  });

  it('keeps fiction in its own story book, apart from the life path', async () => {
    const created = await call<{ id: string }>('POST', '/stories', {
      title: 'The Lighthouse Keeper',
      premise: 'A girl inherits a lighthouse that only lights for ships that sank.',
    });
    expect(created.status).toBe(201);
    const bookId = created.body.id;

    const first = await call<{
      scene: { id: string; chapterId: string | null };
      newNames: string[];
    }>('POST', `/stories/${bookId}/scenes`, {
      text: 'The lighthouse was dark when Elena reached it. She found a broken brass compass in the drawer.',
      characterIds: [],
    });
    expect(first.status).toBe(201);
    expect(first.body.scene.chapterId).toBeNull();
    expect(first.body.newNames).toContain('Elena');

    const book = await call<{ chapters: Array<{ id: string }>; floating: string[] }>(
      'GET',
      `/stories/${bookId}`,
    );
    expect(book.body.floating).toEqual([first.body.scene.id]);
    const chapterId = book.body.chapters[0]!.id;

    await call('POST', `/stories/${bookId}/characters`, { name: 'Elena', role: 'protagonist' });
    const later = await call<{ echoes: Array<{ sceneId: string; type: string }> }>(
      'POST',
      `/stories/${bookId}/scenes`,
      {
        text: 'Years later the brass compass from the lighthouse drawer finally points somewhere.',
        chapterId,
        characterIds: [],
      },
    );
    expect(later.body.echoes[0]?.sceneId).toBe(first.body.scene.id);

    const moved = await call<{ floating: string[]; chapters: Array<{ sceneIds: string[] }> }>(
      'PATCH',
      `/stories/${bookId}/scenes/${first.body.scene.id}`,
      { chapterId },
    );
    expect(moved.status).toBe(200);
    const after = await call<{
      floating: string[];
      chapters: Array<{ sceneIds: string[] }>;
      characters: unknown[];
    }>('GET', `/stories/${bookId}`);
    expect(after.body.floating).toEqual([]);
    expect(after.body.chapters[0]!.sceneIds).toHaveLength(2);
    expect(after.body.characters).toHaveLength(1);

    const life = await call<{ totalMemories: number }>('GET', '/life-path');
    const search = await call<Array<{ title: string }>>('GET', '/memories?q=lighthouse');
    expect(search.body).toHaveLength(0);
    expect(life.body.totalMemories).toBeGreaterThan(0);

    expect((await call('DELETE', `/stories/${bookId}`)).status).toBe(204);
    expect((await call('GET', `/stories/${bookId}`)).status).toBe(404);
  });

  it('keeps the weather out until asked, and remembers when each telling was written', async () => {
    const off = await call<WeatherNowDto | null>('GET', '/weather/now');
    expect(off.status).toBe(200);
    expect(off.body).toBeNull();
    const day = await call<DayWeatherDto>('GET', `/weather/memory/${promiseId}`);
    expect(day.body.status).toBe('off');

    const saved = await call<ProfileDto>('PATCH', '/profile', {
      placeName: 'Amherst, Massachusetts',
      placeLat: 42.4,
      placeLon: -72.5,
      tempUnit: 'f',
    });
    expect(saved.body.placeName).toBe('Amherst, Massachusetts');
    expect(saved.body.tempUnit).toBe('f');
    expect(saved.body.weatherOn).toBe(false);
    expect((await call('GET', '/weather/now')).body).toBeNull();

    const context = {
      part: 'evening',
      weekday: 'Saturday',
      weatherKind: 'rain',
      weatherLabel: 'light rain',
      temperature: 8,
      place: 'Amherst, Massachusetts',
    };
    const text = 'The night of the first snow we built a lopsided snowman under the porch light.';
    const analysis = await capture(text);
    const { status, body } = await call<MemoryDetailDto>('POST', '/memories', {
      title: analysis.title,
      originalText: text,
      readingCopy: analysis.readingCopy,
      sourceKind: 'typing',
      temporal: { ...analysis.temporal, confirmed: false },
      people: decisions(analysis),
      emotions: [],
      context,
    });
    expect(status).toBe(201);
    expect(body.versions[0]!.context).toEqual(context);
  });

  it('keeps the narrator on this machine and checks what it is asked to read', async () => {
    const status = await call<VoiceStatusDto>('GET', '/voice');
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('idle');
    expect(status.body.downloaded).toBe(false);
    const bad = await call('POST', '/voice/speak', {
      text: 'Hello',
      voice: 'someone_else',
      speed: 1,
    });
    expect(bad.status).toBe(400);
  });

  it('saves a long, messy recollection exactly as the capture screen sends it', async () => {
    const spoken = `So this was the spring concert in tenth grade, we had the big Mozart piece, the Requiem I think, and um Mr. Halvorsen our piano coach gave me the hardest part, the accompaniment for the Lacrimosa, which honestly I was not ready for and I told him that like three times. He kept saying I'd grow into it. His wife came to every rehearsal and she would sit in the back and sometimes she'd say something to him and then he'd change the tempo again, which made it worse because I had practiced it one way for weeks. The week before the concert he moved the tempo up again and I basically panicked. I practiced every night until my hands hurt. On the night of the concert I lost my place on the second page and the choir had to stop and start again and everyone was looking at me. After, he said it wasn't my fault but then he told my mom I needed to be more prepared, and I was so angry because I had told him from the start it was too hard and he didn't listen. I still think if he had given me the second part or kept the tempo the same it would have been fine. My mom took me for ice cream after and I didn't even want it. I kind of stopped playing for a while after that, like a few months, and I didn't go back to his lessons.`;
    const text = spoken.replace(/[.,]/g, '').replace(/\s+/g, ' ');
    const analysis = await capture(text);
    const { status, body } = await call<MemoryDetailDto & { error?: string; details?: unknown }>(
      'POST',
      '/memories',
      {
        title: analysis.title,
        originalText: text,
        readingCopy: analysis.readingCopy,
        sourceKind: 'typing',
        temporal: { ...analysis.temporal, confirmed: true },
        people: decisions(analysis),
        emotions: analysis.emotions.map((e) => ({
          tag: e.tag,
          phase: e.phase,
          source: 'suggested',
          evidence: e.quote,
        })),
        context: {
          part: 'evening',
          weekday: 'Saturday',
          weatherKind: 'clear',
          weatherLabel: 'clear',
          temperature: 0.6,
          place: 'Amherst, Massachusetts',
        },
      },
    );
    expect(body.details ?? null).toBeNull();
    expect(status).toBe(201);
  });

  it('lets milestones be made up, moved, dated and deleted', async () => {
    type Milestone = {
      id: string;
      title: string;
      ageMin: number | null;
      ageMax: number | null;
      date: string | null;
    };
    const made = await call<Milestone>('POST', '/milestones', {
      title: 'Learned to swim',
      ageMin: 8,
      ageMax: null,
      description: 'At the Y pool',
      memoryIds: [promiseId],
    });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ ageMin: 8, ageMax: 8, date: null });

    const moved = await call<Milestone>('PUT', `/milestones/${made.body.id}`, {
      title: 'Learned to swim',
      ageMin: 9,
      ageMax: 10,
      memoryIds: [],
    });
    expect(moved.body).toMatchObject({ ageMin: 9, ageMax: 10 });

    const dated = await call<Milestone>('PUT', `/milestones/${made.body.id}`, {
      title: 'Learned to swim',
      ageMin: null,
      ageMax: null,
      date: `${new Date().getFullYear() - 14}-07`,
      memoryIds: [],
    });
    expect(dated.body.date).toMatch(/-07$/);
    expect(dated.body.ageMin).not.toBeNull();

    const life = await call<LifePathDto>('GET', '/life-path');
    const at = life.body.ages.find((a) => a.milestones.some((m) => m.id === made.body.id));
    expect(at?.age).toBe(dated.body.ageMin);

    const bad = await call('POST', '/milestones', {
      title: 'x',
      ageMin: null,
      ageMax: null,
      date: '2020',
    });
    expect(bad.status).toBe(400);

    expect((await call('DELETE', `/milestones/${made.body.id}`)).status).toBe(204);
    const list = await call<Milestone[]>('GET', '/milestones');
    expect(list.body.some((m) => m.id === made.body.id)).toBe(false);
  });

  it('really deletes a memory and its history', async () => {
    const removed = await call('DELETE', `/memories/${promiseId}`);
    expect(removed.status).toBe(204);
    const gone = await call('GET', `/memories/${promiseId}`);
    expect(gone.status).toBe(404);
    const { db } = await import('../src/db/database');
    const versions = db()
      .prepare('SELECT COUNT(*) AS n FROM memory_versions WHERE memory_id = ?')
      .get(promiseId) as { n: number };
    expect(versions.n).toBe(0);
  });

  it('rejects bad input with a readable error', async () => {
    const { status, body } = await call<{ error: string }>('POST', '/memories', { title: '' });
    expect(status).toBe(400);
    expect(body.error).toBe('The title is empty or too short.');
  });
});
