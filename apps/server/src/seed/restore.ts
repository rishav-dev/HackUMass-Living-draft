import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { closeDatabase, openDatabase, run } from '../db/database';
import { importArchive } from '../modules/archive/archive.service';
import { clearAuth, isConfigured, setPassphrase } from '../modules/auth/auth.service';
import { findProfile } from '../modules/profile/profile.repository';
import { KINJAL_ACCOUNT } from './kinjal';
import { SAMPLE_PASSPHRASE } from './sample-archive';

const force = process.argv.includes('--force');
const named = process.argv.slice(2).find((a) => !a.startsWith('--'));
const folder = path.join(config.dataDir, 'backups');
const latest = fs.existsSync(folder)
  ? fs
      .readdirSync(folder)
      .filter((f) => f.startsWith('sample-notebook-') && f.endsWith('.zip'))
      .sort()
      .pop()
  : undefined;
const file = named ?? (latest ? path.join(folder, latest) : null);

if (!file || !fs.existsSync(file)) {
  console.log('There is no saved sample notebook to bring back. "npm run seed" makes a fresh one.');
  process.exit(1);
}

openDatabase(config.databaseFile);
const current = findProfile();
if (isConfigured() && current && !current.isSample && !force) {
  console.log(
    `${current.preferredName}'s notebook is here now, so I left it alone.\nTo replace it with the sample, run "npm run restore-sample -- --force" (that erases what's there now).`,
  );
  closeDatabase();
  process.exit(1);
}

const { memories } = importArchive(new Uint8Array(fs.readFileSync(file)));
clearAuth();
setPassphrase(SAMPLE_PASSPHRASE);
run(
  'UPDATE auth SET email = ?, display_name = ?, verified_at = ?, two_step = 0 WHERE id = 1',
  KINJAL_ACCOUNT.email,
  KINJAL_ACCOUNT.name,
  new Date().toISOString(),
);
closeDatabase();
console.log(
  `Brought back the sample notebook (${memories} memories) from ${path.basename(file)}.\nSign in as ${KINJAL_ACCOUNT.email} / ${SAMPLE_PASSPHRASE}, or use "Explore the demo notebook".`,
);
