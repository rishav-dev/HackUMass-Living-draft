import { Router } from 'express';
import { z } from 'zod';
import { askSchema, compareSchema, understandSchema } from '@living-draft/contracts';
import { body, notFound, param } from '../../lib/http';
import { askWithAi } from './ask';
import { compareWithAi } from './compare';
import { discoverThreads } from './threads';
import { connectionView, forgetConnection, saveConnection, testConnection } from './hosted';
import { findJob, startTask, startUnderstanding } from './jobs';
import { ai } from './runner';

export const aiRouter = Router();

aiRouter.get('/', (_req, res) => {
  res.json(ai.status());
});

aiRouter.get('/connection', (_req, res) => {
  res.json(connectionView());
});

aiRouter.put('/connection', (req, res) => {
  saveConnection(
    body(
      req,
      z.object({
        enabled: z.boolean(),
        endpoint: z.string().trim().min(8, 'Add the service address.').max(300),
        model: z.string().trim().min(1, 'Add the model name.').max(200),
        apiKey: z.string().max(500).nullable().optional(),
      }),
    ),
  );
  res.json(connectionView());
});

aiRouter.delete('/connection', (_req, res) => {
  forgetConnection();
  res.status(204).end();
});

aiRouter.post('/connection/test', async (_req, res) => {
  res.json({ reply: await testConnection() });
});

aiRouter.post('/prepare', (_req, res) => {
  res.json(ai.prepare());
});

aiRouter.post('/understand', (req, res) => {
  const input = body(req, understandSchema);
  res.status(202).json(startUnderstanding(input));
});

aiRouter.get('/jobs/:id', (req, res) => {
  const job = findJob(param(req, 'id'));
  if (!job) throw notFound('Job');
  res.json(job);
});

aiRouter.post('/ask', (req, res) => {
  const input = body(req, askSchema);
  res.status(202).json(
    startTask(() =>
      askWithAi(input.question, {
        includeQuiet: input.scope.includeDifficult,
        memoryIds: input.scope.memoryIds,
      }),
    ),
  );
});

aiRouter.post('/compare', (req, res) => {
  const input = body(req, compareSchema);
  res.status(202).json(startTask(() => compareWithAi(input.memoryIds, input.question)));
});

aiRouter.post('/threads', (req, res) => {
  const ids = Array.isArray((req.body as { memoryIds?: unknown }).memoryIds)
    ? ((req.body as { memoryIds: unknown[] }).memoryIds.filter(
        (id) => typeof id === 'string',
      ) as string[])
    : undefined;
  res.status(202).json(startTask(() => discoverThreads(ids)));
});
