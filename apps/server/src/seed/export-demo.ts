import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { closeDatabase, openDatabase } from '../db/database';
import { exportArchive } from '../modules/archive/archive.service';
import { findProfile } from '../modules/profile/profile.repository';

const target = path.resolve(
  process.argv[2] ?? path.join('..', 'web', 'public', 'demo', 'kinjal.zip'),
);
openDatabase(config.databaseFile);
if (!findProfile()?.isSample) {
  console.log(
    'This archive is not the sample notebook, so nothing was exported. Run "npm run seed" first.',
  );
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
const bytes = exportArchive();
fs.writeFileSync(target, bytes);
closeDatabase();
console.log(`Demo notebook written to ${target} (${(bytes.byteLength / 1e6).toFixed(1)} MB)`);
