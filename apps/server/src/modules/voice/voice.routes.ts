import { Router } from 'express';
import { voiceRequestSchema } from '@living-draft/contracts';
import { body } from '../../lib/http';
import { requireSession } from '../auth/auth.routes';
import { prepareVoice, speakClip, voiceStatus } from './voice.service';

export function voiceRouter() {
  const router = Router();
  router.use(requireSession);
  router.get('/', (_req, res) => {
    res.json(voiceStatus());
  });
  router.post('/prepare', (_req, res) => {
    res.json(prepareVoice());
  });
  router.post('/speak', async (req, res) => {
    const ticket = speakClip(body(req, voiceRequestSchema));
    res.on('close', () => {
      if (!res.writableFinished) ticket.cancel();
    });
    const clip = await ticket.clip;
    if (res.destroyed) return;
    res.setHeader('Cache-Control', 'no-store');
    res.type('audio/wav').send(clip);
  });
  return router;
}
