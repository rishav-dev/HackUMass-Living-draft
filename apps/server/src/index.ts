import fs from 'node:fs';
import { createApp } from './app';
import { config } from './config';
import { openDatabase } from './db/database';
import { deleteStalePending } from './modules/media/media.repository';

fs.mkdirSync(config.mediaDir, { recursive: true });
openDatabase(config.databaseFile);
deleteStalePending();

const server = createApp().listen(config.port, config.host, () => {
  console.log(`Living Draft API on http://${config.host}:${config.port}`);
  if (fs.existsSync(config.webDist))
    console.log(`Open http://localhost:${config.port} to use the app`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use. The Living Draft may already be running in another window; close it, or set LIVING_DRAFT_PORT to another port.`,
    );
    process.exit(1);
  }
  throw error;
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
