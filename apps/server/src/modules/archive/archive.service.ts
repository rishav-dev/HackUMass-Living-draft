import fs from 'node:fs';
import path from 'node:path';
import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { all, db } from '../../db/database';
import { config } from '../../config';

const TABLES = [
  'profile',
  'books',
  'memories',
  'memory_versions',
  'temporal_estimates',
  'characters',
  'character_aliases',
  'character_mentions',
  'emotion_tags',
  'media_assets',
  'milestones',
  'milestone_memories',
  'connections',
  'connection_endpoints',
  'review_items',
  'version_resolutions',
  'reflections',
  'reflection_memories',
  'capsules',
  'analyses',
  'scene_art',
  'art_declined',
  'character_links',
  'art_usage',
  'chapter_notes',
  'memory_weather',
  'place_cache',
  'story_books',
  'story_chapters',
  'story_characters',
  'story_scenes',
  'story_scene_characters',
  'story_links',
  'story_notes',
  'memory_questions',
  'memory_themes',
  'places',
  'memory_places',
  'memory_vectors',
];

export function exportArchive(): Uint8Array {
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) data[table] = all(`SELECT * FROM ${table}`);

  const files: Zippable = {
    'archive.json': strToU8(
      JSON.stringify({ exportedAt: new Date().toISOString(), schema: 1, data }, null, 2),
    ),
    'README.txt': strToU8(
      'Your Living Draft archive.\n\narchive.json holds every memory, every version, people, connections and settings.\nmedia/ holds the photos, videos and recordings exactly as you added them.\n',
    ),
  };
  const media: Zippable = {};
  for (const row of all<{ file_name: string }>(
    'SELECT file_name FROM media_assets UNION SELECT file_name FROM scene_art',
  )) {
    const file = path.join(config.mediaDir, row.file_name);
    if (fs.existsSync(file))
      media[row.file_name] = [new Uint8Array(fs.readFileSync(file)), { level: 0 }];
  }
  files.media = media;
  return zipSync(files);
}

export function deleteEverything() {
  const database = db();
  database.exec('BEGIN');
  try {
    for (const table of [...TABLES, 'map_positions', 'ai_connection'].reverse())
      database.exec(`DELETE FROM ${table}`);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  database.exec('VACUUM');
  fs.rmSync(config.mediaDir, { recursive: true, force: true });
  fs.mkdirSync(config.mediaDir, { recursive: true });
  fs.rmSync(config.voiceDir, { recursive: true, force: true });
}

export function importArchive(bytes: Uint8Array): { memories: number } {
  const files = unzipSync(bytes);
  const manifest = files['archive.json'];
  if (!manifest) throw new Error('That file is not a Living Draft archive.');
  const parsed = JSON.parse(strFromU8(manifest)) as {
    data: Record<string, Array<Record<string, unknown>>>;
  };
  deleteEverything();
  const database = db();
  database.exec('BEGIN');
  try {
    for (const table of TABLES) {
      for (const row of parsed.data[table] ?? []) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        database
          .prepare(
            `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          )
          .run(...(columns.map((c) => row[c] ?? null) as Array<string | number | null>));
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  fs.mkdirSync(config.mediaDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    if (!name.startsWith('media/') || name.endsWith('/')) continue;
    fs.writeFileSync(path.join(config.mediaDir, name.slice('media/'.length)), content);
  }
  return { memories: parsed.data.memories?.length ?? 0 };
}
