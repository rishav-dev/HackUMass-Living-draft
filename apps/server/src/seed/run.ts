import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CaptureAnalysisDto, PersonDecision, TemporalInput } from '@living-draft/contracts';
import { ageOnDate, seasonForMonth } from '@living-draft/engine';
import { config } from '../config';
import { all, closeDatabase, openDatabase, run } from '../db/database';
import { newId } from '../lib/http';
import { generateArt } from '../modules/art/art.service';
import { setPassphrase } from '../modules/auth/auth.service';
import { addVersion, analyzeCapture, createMemory } from '../modules/capture/capture.service';
import { suggestAndStore, updateConnection } from '../modules/connections/connection.service';
import { lifePath, days } from '../modules/lifepath/lifepath.service';
import { insertMedia } from '../modules/media/media.repository';
import { createMilestone } from '../modules/milestones/milestone.service';
import { createProfile, findProfile, updateProfile } from '../modules/profile/profile.repository';
import { createReflection } from '../modules/reflections/reflection.service';
import {
  SAMPLE_CAPSULES,
  SAMPLE_MEMORIES,
  SAMPLE_MILESTONES,
  SAMPLE_PASSPHRASE,
  SAMPLE_PLACE,
  SAMPLE_PROFILE,
  SAMPLE_REFLECTION,
} from './sample-archive';
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

function decide(analysis: CaptureAnalysisDto): PersonDecision[] {
  return analysis.people.map((person) => ({
    label: person.suggestion?.name ?? person.label,
    surfaces: person.surfaces,
    characterId: person.suggestion?.characterId ?? null,
    relationship: person.relationship,
    role: person.role,
    roleEvidence: person.roleEvidence,
    addAlias: true,
  }));
}

function exactDate(date: string): TemporalInput {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const age = ageOnDate(SAMPLE_PROFILE.birthDate, new Date(Date.UTC(year, month - 1, day)));
  return {
    precision: 'exact',
    ageMin: age,
    ageMax: age,
    year,
    month,
    day,
    season: seasonForMonth(month, SAMPLE_PROFILE.hemisphere),
    approximate: false,
    confidence: 'high',
    explanation: 'You gave the exact date.',
    evidence: [],
    confirmed: true,
  };
}

setPassphrase(SAMPLE_PASSPHRASE);
createProfile(SAMPLE_PROFILE, { isSample: true });
updateProfile(SAMPLE_PLACE);
const milestoneIds = new Map(
  SAMPLE_MILESTONES.map((m) => [m.title, createMilestone({ ...m, memoryIds: [] }).id]),
);
const memoryIds = new Map<string, string>();

for (const sample of SAMPLE_MEMORIES) {
  const analysis = analyzeCapture({ text: sample.text, kind: 'memory' });
  const mediaIds: string[] = [];
  if (sample.sound) {
    const { fileName, size } = writeFile(sounds[sample.sound](), '.wav');
    mediaIds.push(
      insertMedia({
        fileName,
        originalName: `${sample.sound}.wav`,
        mimeType: 'audio/wav',
        sizeBytes: size,
        kind: 'audio',
        caption: sample.soundCaption ?? null,
        durationMs: lengths[sample.sound] * 1000,
      }).id,
    );
  }

  const { memoryId } = createMemory({
    title: sample.title ?? analysis.title,
    originalText: sample.text,
    readingCopy: analysis.readingCopy,
    sourceKind: sample.sourceKind,
    temporal: sample.date
      ? exactDate(sample.date)
      : { ...analysis.temporal, confirmed: analysis.temporal.certainty !== 'unplaced' },
    people: decide(analysis),
    emotions: analysis.emotions.map((e) => ({
      tag: e.tag,
      phase: e.phase,
      source: 'suggested' as const,
      evidence: e.quote,
    })),
    milestoneIds: sample.milestone ? [milestoneIds.get(sample.milestone)!] : [],
    newMilestones: [],
    mediaIds,
    sensitive: sample.sensitive ?? false,
  });
  memoryIds.set(sample.key, memoryId);
  if (sample.place) run('UPDATE memories SET place = ? WHERE id = ?', sample.place, memoryId);
  run(
    'UPDATE memory_versions SET recorded_at = ?, created_at = ? WHERE memory_id = ?',
    daysAgo(sample.recordedDaysAgo),
    daysAgo(sample.recordedDaysAgo),
    memoryId,
  );
  run(
    'UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?',
    daysAgo(sample.recordedDaysAgo),
    daysAgo(sample.recordedDaysAgo),
    memoryId,
  );

  for (const retelling of sample.retellings ?? []) {
    const next = analyzeCapture({ text: retelling.text, kind: 'memory', memoryId });
    const { versionId } = addVersion(memoryId, {
      originalText: retelling.text,
      readingCopy: next.readingCopy,
      sourceKind: 'speech',
      mode: retelling.mode,
      people: decide(next),
      emotions: next.emotions.map((e) => ({
        tag: e.tag,
        phase: e.phase,
        source: 'suggested' as const,
        evidence: e.quote,
      })),
      mediaIds: [],
    });
    run(
      'UPDATE memory_versions SET recorded_at = ?, created_at = ? WHERE id = ?',
      daysAgo(retelling.recordedDaysAgo),
      daysAgo(retelling.recordedDaysAgo),
      versionId,
    );
  }
}

run('UPDATE characters SET provisional = 0 WHERE name <> ?', 'Biscuit');

const reflection = createReflection({
  originalText: SAMPLE_REFLECTION.text,
  readingCopy: SAMPLE_REFLECTION.text,
  memoryIds: [memoryIds.get(SAMPLE_REFLECTION.memoryKey)!],
});
run('UPDATE reflections SET recorded_at = ? WHERE id = ?', daysAgo(5), reflection.id);

for (const capsule of SAMPLE_CAPSULES) {
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

const pinned = [
  ['full_circle', 'The lunch table', 'Lunch with Priya'],
  ['wish_fulfilled', 'Drawing the ocean', 'Finally, the ocean'],
  ['breaking_pattern', 'When Dad picked my major', 'Asking for the raise'],
  ['relationship_change', "Mom's promise", 'Moving day with Mom'],
];
const suggested = suggestAndStore();
for (const connection of suggested) {
  const titles = connection.endpoints.map((e) => e.title);
  if (
    pinned.some(
      ([type, a, b]) => type === connection.type && titles.includes(a!) && titles.includes(b!),
    )
  ) {
    updateConnection(connection.id, { status: 'confirmed' });
  }
}

const counts = all<{ kind: string; n: number }>(
  `SELECT 'memories' AS kind, COUNT(*) AS n FROM memories UNION ALL SELECT 'people', COUNT(*) FROM characters
   UNION ALL SELECT 'connections', COUNT(*) FROM connections UNION ALL SELECT 'files', COUNT(*) FROM media_assets`,
);
console.log(
  `Sample archive ready for ${SAMPLE_PROFILE.preferredName} (fictional). Passphrase: ${SAMPLE_PASSPHRASE}`,
);
for (const { kind, n } of counts) console.log(`  ${n} ${kind}`);
console.log(`  ${days().length} dated days, ${lifePath().unplacedCount} unplaced`);
for (const connection of suggested)
  console.log(
    `  link: ${connection.label} - ${connection.endpoints.map((e) => e.title).join(' / ')}`,
  );

if (!skipArt) {
  const keys = [
    ...days().map((d) => d.artKey),
    ...[...memoryIds.values()].map((id) => `memory:${id}`),
  ];
  console.log(
    `Generating scene art for ${keys.length} days and memories (free tier allows one every ~45s). Ctrl+C to stop; \`npm run art\` picks up the rest later.`,
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
