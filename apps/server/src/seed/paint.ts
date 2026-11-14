import { config } from '../config';
import { closeDatabase, openDatabase } from '../db/database';
import { findArt, generateArt } from '../modules/art/art.service';
import { Archive } from '../modules/archive/snapshot';
import { days } from '../modules/lifepath/lifepath.service';

openDatabase(config.databaseFile);
const archive = Archive.load();
const wanted = [...days().map((d) => d.artKey), ...archive.memories.map((m) => `memory:${m.id}`)];
const have = findArt(wanted);
const keys = wanted.filter((key) => !have.has(key));

if (!keys.length) {
  console.log('Every day and memory already has a scene.');
} else {
  const minutes = Math.ceil((keys.length * 46) / 60);
  console.log(
    `Painting ${keys.length} missing scenes on the free tier (one every ~45s, about ${minutes} min). Ctrl+C any time; finished scenes are kept.`,
  );
  let made = 0;
  for (const key of keys) {
    const result = await generateArt(key, { ignoreQuota: true });
    if (result.url) made += 1;
    process.stdout.write(result.url ? '.' : 'x');
  }
  console.log(`\n  ${made} of ${keys.length} scenes painted`);
}
closeDatabase();
