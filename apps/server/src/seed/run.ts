import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PersonDecision, TemporalInput } from '@living-draft/contracts';
import { ageOnDate, seasonForMonth } from '@living-draft/engine';
import { config } from '../config';
import { all, closeDatabase, get, openDatabase, run } from '../db/database';
import { newId } from '../lib/http';
import { fetchPaced, generateArt } from '../modules/art/art.service';
import { setPassphrase } from '../modules/auth/auth.service';
import { addVersion, createMemory } from '../modules/capture/capture.service';
import { createConnection } from '../modules/connections/connection.service';
import { lifePath, days } from '../modules/lifepath/lifepath.service';
import { insertMedia } from '../modules/media/media.repository';
import { attachMedia } from '../modules/memories/memory.service';
import { createMilestone } from '../modules/milestones/milestone.service';
import { createProfile, findProfile, updateProfile } from '../modules/profile/profile.repository';
import { createReflection } from '../modules/reflections/reflection.service';
import {
  KINJAL_ACCOUNT,
  KINJAL_CAPSULES,
  KINJAL_MEMORIES,
  KINJAL_MILESTONES,
  KINJAL_PLACE_COORDS,
  KINJAL_REFLECTION,
  KINJAL_THREADS,
} from './kinjal';
import type { SampleMemory } from './kinjal-types';
import { SAMPLE_PASSPHRASE, SAMPLE_PLACE, SAMPLE_PROFILE } from './sample-archive';
import { fireCrackle, oceanWaves, pianoNote, rainOnPorch } from './sound';

const force = process.argv.includes('--force');
const skipArt = process.argv.includes('--no-art');

if (fs.existsSync(config.databaseFile)) {
  openDatabase(config.databaseFile);
  const existing = findProfile();
  closeDatabase();
  if (existing && !force) {
    console.log(
      `${existing.preferredName}'s archive is already here, so I left it alone. Start the app with "npm run dev".
To replace it with the fresh sample, run "npm run seed -- --force" (that erases what's there now).`,
    );
    process.exit(0);
  }
  for (const suffix of ['', '-wal', '-shm'])
    fs.rmSync(`${config.databaseFile}${suffix}`, { force: true });
}
fs.rmSync(config.mediaDir, { recursive: true, force: true });
fs.mkdirSync(config.mediaDir, { recursive: true });
fs.rmSync(config.voiceDir, { recursive: true, force: true });
openDatabase(config.databaseFile);

function writeFile(contents: Buffer, ext: string) {
  const fileName = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(config.mediaDir, fileName), contents);
  return { fileName, size: contents.byteLength };
}

const sounds = { piano: pianoNote, ocean: oceanWaves, rain: rainOnPorch, fire: fireCrackle };
const lengths = { piano: 10, ocean: 14, rain: 12, fire: 10 };

function daysAgo(days: number, hour = 19): string {
  const date = new Date(Date.now() - days * 24 * 3600 * 1000);
  date.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return date.toISOString();
}

const ageAt = (y: number, m: number, d: number) =>
  ageOnDate(SAMPLE_PROFILE.birthDate, new Date(Date.UTC(y, m - 1, d)));

function temporalFor(memory: SampleMemory): TemporalInput {
  const base = { evidence: [], confirmed: true, approximate: false };
  const when = memory.when;
  if ('date' in when) {
    const [y, m, d] = when.date.split('-').map(Number) as [number, number, number];
    const age = ageAt(y, m, d);
    return {
      ...base,
      precision: 'exact',
      ageMin: age,
      ageMax: age,
      year: y,
      month: m,
      day: d,
      season: seasonForMonth(m, SAMPLE_PROFILE.hemisphere),
      confidence: 'high',
      explanation: 'You gave the date.',
    };
  }
  if ('month' in when) {
    const [y, m] = when.month.split('-').map(Number) as [number, number];
    const first = ageAt(y, m, 1);
    const last = ageAt(y, m, 28);
    return {
      ...base,
      precision: 'month',
      ageMin: first,
      ageMax: last,
      year: y,
      month: m,
      day: null,
      season: seasonForMonth(m, SAMPLE_PROFILE.hemisphere),
      confidence: 'high',
      explanation: 'You gave the month and year.',
    };
  }
  if ('ages' in when) {
    const [from, to] = when.ages;
    return {
      ...base,
      precision: from === to ? (when.season ? 'season_age' : 'age') : 'age_range',
      ageMin: from,
      ageMax: to,
      year: null,
      month: null,
      day: null,
      season: when.season ?? null,
      approximate: true,
      confidence: 'medium',
      explanation:
        from === to
          ? `You said you were about ${from}.`
          : `You said this went on from about ${from} to ${to}.`,
    };
  }
  return {
    ...base,
    precision: 'unknown',
    ageMin: null,
    ageMax: null,
    year: null,
    month: null,
    day: null,
    season: null,
    confidence: 'low',
    explanation: 'No time was given.',
  };
}

setPassphrase(SAMPLE_PASSPHRASE);
run(
  'UPDATE auth SET email = ?, display_name = ?, verified_at = ?, two_step = 0 WHERE id = 1',
  KINJAL_ACCOUNT.email,
  KINJAL_ACCOUNT.name,
  new Date().toISOString(),
);
createProfile(SAMPLE_PROFILE, { isSample: true });
updateProfile({ ...SAMPLE_PLACE, locationMode: 'home' });

const milestoneIds = new Map(
  KINJAL_MILESTONES.map((m) => [m.title, createMilestone({ ...m, memoryIds: [] }).id]),
);
const memoryIds = new Map<string, string>();
const people = new Map<string, string>();

function decisions(memory: SampleMemory, text: string): PersonDecision[] {
  return memory.people.map((person) => {
    const surfaces = [...new Set([person.name, ...person.said])].filter((s) => text.includes(s));
    return {
      label: person.name,
      surfaces: surfaces.length ? surfaces : [person.name],
      characterId: people.get(person.name) ?? null,
      relationship: person.relationship ?? null,
      role: person.role,
      addAlias: true,
    };
  });
}

function remember(memoryId: string) {
  for (const row of all<{ id: string; name: string }>(
    `SELECT DISTINCT c.id, c.name FROM characters c JOIN character_mentions m ON m.character_id = c.id
     WHERE m.memory_id = ?`,
    memoryId,
  ))
    if (!people.has(row.name)) people.set(row.name, row.id);
}

const photos: Array<{ memoryId: string; scene: string; caption: string }> = [];

for (const memory of KINJAL_MEMORIES) {
  const mediaIds: string[] = [];
  if (memory.sound) {
    const { fileName, size } = writeFile(sounds[memory.sound](), '.wav');
    mediaIds.push(
      insertMedia({
        fileName,
        originalName: `${memory.sound}.wav`,
        mimeType: 'audio/wav',
        sizeBytes: size,
        kind: 'audio',
        caption: memory.soundCaption ?? null,
        durationMs: lengths[memory.sound] * 1000,
      }).id,
    );
  }
  const { memoryId } = createMemory({
    title: memory.title,
    originalText: memory.raw,
    readingCopy: memory.story,
    sourceKind: memory.sourceKind,
    temporal: temporalFor(memory),
    people: decisions(memory, memory.story),
    emotions: memory.feelings.map(([tag, phase]) => ({
      tag,
      phase,
      source: 'suggested' as const,
      evidence: null,
    })),
    milestoneIds:
      memory.milestone && milestoneIds.has(memory.milestone)
        ? [milestoneIds.get(memory.milestone)!]
        : [],
    newMilestones: [],
    mediaIds,
    sensitive: memory.sensitive ?? false,
    place: memory.places[0] ?? null,
    understanding: {
      summary: memory.summary,
      time: memory.time,
      themes: (memory.themes ?? []).map(([theme, evidence]) => ({ theme, evidence })),
      followups: (memory.questions ?? []).map(([question, answer]) => ({ question, answer })),
      places: memory.places.map((name) => ({ name, kind: null })),
    },
  });
  memoryIds.set(memory.key, memoryId);
  remember(memoryId);
  run(
    'UPDATE memory_versions SET recorded_at = ?, created_at = ? WHERE memory_id = ?',
    daysAgo(memory.recordedDaysAgo),
    daysAgo(memory.recordedDaysAgo),
    memoryId,
  );
  run(
    'UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?',
    daysAgo(memory.recordedDaysAgo),
    daysAgo(memory.recordedDaysAgo),
    memoryId,
  );
  run(
    'UPDATE memory_questions SET asked_at = ? WHERE memory_id = ?',
    daysAgo(memory.recordedDaysAgo),
    memoryId,
  );

  for (const telling of memory.tellings ?? []) {
    const { versionId } = addVersion(memoryId, {
      originalText: telling.raw,
      readingCopy: telling.story,
      sourceKind: telling.sourceKind ?? 'speech',
      mode: 'addition',
      people: decisions(memory, telling.story).filter((p) =>
        p.surfaces.some((s) => telling.story.includes(s)),
      ),
      emotions: [],
      mediaIds: [],
    });
    run(
      'UPDATE memory_versions SET recorded_at = ?, created_at = ? WHERE id = ?',
      daysAgo(telling.recordedDaysAgo),
      daysAgo(telling.recordedDaysAgo),
      versionId,
    );
    run(
      'UPDATE memories SET updated_at = ? WHERE id = ?',
      daysAgo(telling.recordedDaysAgo),
      memoryId,
    );
  }
  run('DELETE FROM review_items WHERE memory_id = ?', memoryId);
  run("UPDATE memories SET review_status = 'ok' WHERE id = ?", memoryId);
  for (const photo of memory.photos ?? []) photos.push({ memoryId, ...photo });
}

run('UPDATE characters SET provisional = 0');
run(
  'UPDATE memories SET bookmarked_at = ? WHERE id IN (?, ?, ?)',
  new Date().toISOString(),
  memoryIds.get('raise')!,
  memoryIds.get('nani-garden')!,
  memoryIds.get('not-the-team')!,
);

const reflection = createReflection({
  originalText: KINJAL_REFLECTION.text,
  readingCopy: KINJAL_REFLECTION.text,
  memoryIds: [memoryIds.get(KINJAL_REFLECTION.memoryKey)!],
});
run('UPDATE reflections SET recorded_at = ? WHERE id = ?', daysAgo(5), reflection.id);

for (const capsule of KINJAL_CAPSULES) {
  run(
    `INSERT INTO capsules (id, title, original_text, body, authored_at, authored_age, unlock_kind, unlock_date, unlock_milestone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    capsule.title,
    capsule.text,
    capsule.text,
    capsule.authoredAt,
    capsule.authoredAge,
    capsule.unlockKind,
    'unlockDate' in capsule ? capsule.unlockDate : null,
    'unlockMilestone' in capsule ? capsule.unlockMilestone : null,
    capsule.authoredAt,
  );
}

function evidence(memoryId: string, quote: string) {
  const text =
    get<{ composed_text: string }>(
      'SELECT v.composed_text FROM memories m JOIN memory_versions v ON v.id = m.current_version_id WHERE m.id = ?',
      memoryId,
    )?.composed_text ?? '';
  const at = text.indexOf(quote);
  if (at < 0) throw new Error(`Quote not found: "${quote}"`);
  return { memoryId, quote, start: at, end: at + quote.length };
}

for (const thread of KINJAL_THREADS) {
  const from = memoryIds.get(thread.from)!;
  const to = memoryIds.get(thread.to)!;
  createConnection({
    type: thread.type,
    explanation: thread.explanation,
    status: thread.status,
    note: null,
    memoryIds: [from, to],
    evidence: [evidence(from, thread.fromQuote), evidence(to, thread.toQuote)],
  });
}

for (const [name, [lat, lon]] of Object.entries(KINJAL_PLACE_COORDS))
  run('UPDATE places SET lat = ?, lon = ? WHERE name = ? COLLATE NOCASE', lat, lon, name);

const counts = all<{ kind: string; n: number }>(
  `SELECT 'memories' AS kind, COUNT(*) AS n FROM memories UNION ALL SELECT 'tellings', COUNT(*) FROM memory_versions
   UNION ALL SELECT 'people', COUNT(*) FROM characters UNION ALL SELECT 'places', COUNT(*) FROM places
   UNION ALL SELECT 'threads', COUNT(*) FROM connections UNION ALL SELECT 'questions', COUNT(*) FROM memory_questions`,
);
console.log(
  `Sample archive ready for ${SAMPLE_PROFILE.preferredName} (fictional). Sign in with ${KINJAL_ACCOUNT.email} / ${SAMPLE_PASSPHRASE}, or use "Explore the demo".`,
);
for (const { kind, n } of counts) console.log(`  ${n} ${kind}`);
console.log(`  ${days().length} dated days, ${lifePath().unplacedCount} unplaced`);

if (!skipArt) {
  console.log(`Painting ${photos.length} photos for the sample (scene words only)…`);
  for (const [i, photo] of photos.entries()) {
    try {
      const data = await fetchPaced(photo.scene, 7000 + i);
      const { fileName, size } = writeFile(data, '.jpg');
      const media = insertMedia({
        fileName,
        originalName: `${photo.caption}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: size,
        kind: 'photo',
        caption: photo.caption,
        durationMs: null,
      });
      attachMedia(photo.memoryId, [media.id]);
      process.stdout.write('.');
    } catch {
      process.stdout.write('x');
    }
  }
  const keys = [
    ...days().map((d) => d.artKey),
    ...[...memoryIds.values()].map((id) => `memory:${id}`),
  ];
  console.log(
    `\nGenerating scene art for ${keys.length} days and memories (free tier allows one every ~45s). Ctrl+C to stop; \`npm run art\` picks up the rest later.`,
  );
  let made = 0;
  for (const key of keys) {
    const result = await generateArt(key, { ignoreQuota: true });
    if (result.url) made += 1;
    process.stdout.write(result.url ? '.' : 'x');
  }
  console.log(`\n  ${made} of ${keys.length} scenes generated`);
}
closeDatabase();
