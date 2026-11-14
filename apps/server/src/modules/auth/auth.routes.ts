import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { changePassphraseSchema, passphraseSchema } from '@living-draft/contracts';
import { body, HttpError } from '../../lib/http';
import {
  createSession,
  endAllSessions,
  endSession,
  isConfigured,
  sessionValid,
  setPassphrase,
  verifyPassphrase,
} from './auth.service';

const loginSchema = z.object({ passphrase: z.string().min(1).max(200) });

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  const configured = isConfigured();
  res.json({ configured, authenticated: configured ? sessionValid(req) : true });
});

authRouter.post('/setup', (req, res) => {
  if (isConfigured()) throw new HttpError(409, 'A passphrase is already set');
  setPassphrase(body(req, passphraseSchema).passphrase);
  createSession(res);
  res.status(201).json({ configured: true, authenticated: true });
});

authRouter.post('/login', (req, res) => {
  if (!isConfigured()) throw new HttpError(409, 'No passphrase has been set yet');
  if (!verifyPassphrase(body(req, loginSchema).passphrase)) {
    throw new HttpError(401, "That passphrase doesn't match");
  }
  createSession(res);
  res.json({ configured: true, authenticated: true });
});

authRouter.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ configured: isConfigured(), authenticated: false });
});

authRouter.post('/change', (req, res) => {
  const input = body(req, changePassphraseSchema);
  if (!verifyPassphrase(input.current))
    throw new HttpError(401, "Your current passphrase doesn't match");
  setPassphrase(input.next);
  endAllSessions();
  createSession(res);
  res.json({ configured: true, authenticated: true });
});

authRouter.post('/sessions/end-others', (req, res) => {
  if (!isConfigured() || !sessionValid(req)) throw new HttpError(401, 'Locked');
  endAllSessions();
  createSession(res);
  res.json({ configured: true, authenticated: true });
});

const OPEN = [/^\/health$/, /^\/auth\//];

export const requireSession: RequestHandler = (req, res, next) => {
  if (OPEN.some((pattern) => pattern.test(req.path))) return next();
  if (!isConfigured() || sessionValid(req)) return next();
  res.status(401).json({ error: 'Locked' });
};
