import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

const dataDir = process.env.LIVING_DRAFT_DATA_DIR ?? path.join(serverRoot, 'data');

export const config = {
  port: Number(process.env.LIVING_DRAFT_PORT ?? 4317),
  host: process.env.LIVING_DRAFT_HOST ?? '127.0.0.1',
  dataDir,
  databaseFile: path.join(dataDir, 'living-draft.db'),
  mediaDir: path.join(dataDir, 'media'),
  voiceDir: path.join(dataDir, 'voice'),
  modelDir: path.join(dataDir, 'models'),
  webDist: path.resolve(serverRoot, '..', 'web', 'dist'),
  maxUploadBytes: 250 * 1024 * 1024,
};
