import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { config } from './config';
import { HttpError } from './lib/http';
import { apiRouter } from './modules/routes';
import { voiceRouter } from './modules/voice/voice.routes';
import { withHosted } from './modules/ai/hosted';
import { localRunner } from './modules/ai/llm';
import { useAiRunner } from './modules/ai/runner';
import { useMailer } from './modules/auth/mailer';
import { nodeMailer } from './modules/auth/node-mailer';
import { isConfigured, sessionValid } from './modules/auth/auth.service';

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on our side' });
};

export function createApp() {
  useAiRunner(withHosted(localRunner));
  useMailer(nodeMailer());
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(express.json({ limit: '2mb' }));

  app.use('/media', (req, res, next) =>
    isConfigured() && !sessionValid(req) ? res.status(401).end() : next(),
  );
  app.use(
    '/media',
    express.static(config.mediaDir, {
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  app.use('/api/voice', voiceRouter());
  app.use('/api', apiRouter());
  app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint' }));

  if (fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist));
    app.get(/^(?!\/api|\/media).*/, (_req, res) =>
      res.sendFile(path.join(config.webDist, 'index.html')),
    );
  }

  app.use(errorHandler);
  return app;
}
