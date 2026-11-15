import { Router, type Request, type RequestHandler } from 'express';
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
import {
  authStatus,
  confirmAuthenticator,
  demoSignIn,
  finishSignIn,
  forgetTrustedDevices,
  forgotPassword,
  removeAuthenticator,
  resendVerification,
  finishPairing,
  resetPassword,
  setTwoStep,
  signIn,
  signUp,
  startAuthenticator,
  verifyEmail,
} from './account.service';
import { finishGoogle, startGoogle } from './google';

const loginSchema = z.object({ passphrase: z.string().min(1).max(200) });

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  res.json(authStatus(req));
});

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200)
  .refine((value) => /[a-z]/i.test(value) && /[^a-z]/i.test(value), {
    message: 'Mix in at least one number or symbol.',
  });
const text = (limit: number) => z.string().trim().max(limit).nullable().optional();
const personSchema = z.object({
  name: z.string().trim().min(1, 'Each person needs a name.').max(80),
  kind: z.enum(['family', 'friend', 'partner', 'pet', 'mentor', 'other']),
  relationship: z.string().trim().max(60).default(''),
  note: z.string().trim().max(300).default(''),
});
const signUpSchema = z
  .object({
    name: z.string().trim().min(1, 'Add the name you go by.').max(60),
    email: z.string().trim().email('That email doesn’t look right.').max(200),
    password,
    confirm: z.string(),
    remember: z.boolean().default(false),
    twoStep: z.boolean().default(true),
    replaceSample: z.boolean().default(false),
    about: z
      .object({
        fullName: text(120),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick your birthday from the calendar.')
          .nullable()
          .optional(),
        age: z.number().int().min(1, 'Add your age.').max(120).nullable().optional(),
        sex: text(40),
        gender: text(60),
        pronouns: text(40),
        birthPlace: text(160),
        currentPlace: text(160),
      })
      .refine((v) => v.birthDate || v.age, { message: 'Add your birthday or your age.' })
      .optional(),
    people: z
      .array(personSchema)
      .max(40, 'That’s a lot of people. Add the rest later.')
      .default([]),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'The passwords don’t match.',
    path: ['confirm'],
  });
const signInSchema = z.object({
  email: z.string().trim().max(200).optional(),
  password: z.string().min(1).max(200),
  remember: z.boolean().default(false),
});
const codeSchema = z.object({
  code: z.string().trim().min(6).max(10),
  trust: z.boolean().default(false),
});

function origin(req: Request): string {
  return (
    process.env.LIVING_DRAFT_PUBLIC_URL?.replace(/\/$/, '') ??
    `${req.protocol}://${req.get('host')}`
  );
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form and try again.';
}

authRouter.post('/signup', async (req, res) => {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
  await signUp(parsed.data, res);
  res.status(201).json({ ...authStatus(req), authenticated: true });
});

authRouter.post('/pair', (req, res) => {
  const { code } = body(req, z.object({ code: z.string().trim().min(6).max(10) }));
  finishPairing(code, res);
  res.json({ ok: true });
});

authRouter.post('/two-step', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  const input = body(req, z.object({ on: z.boolean(), password: z.string().max(200).optional() }));
  setTwoStep(input.on, input.password);
  res.json(authStatus(req));
});

authRouter.post('/verify-email', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  verifyEmail(body(req, z.object({ code: z.string().trim().min(6).max(10) })).code);
  res.json({ ok: true });
});

authRouter.post('/verify-email/resend', async (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  await resendVerification();
  res.json({ ok: true });
});

authRouter.post('/sign-in', async (req, res) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
  res.json(await signIn(parsed.data, req, res));
});

authRouter.post('/sign-in/code', (req, res) => {
  finishSignIn(body(req, codeSchema), req, res);
  res.json({ ok: true });
});

authRouter.post('/forgot', async (req, res) => {
  const { email } = body(req, z.object({ email: z.string().trim().max(200) }));
  await forgotPassword(email, origin(req));
  res.json({ ok: true });
});

authRouter.post('/reset', (req, res) => {
  const parsed = z.object({ token: z.string().min(10).max(200), password }).safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
  resetPassword(parsed.data.token, parsed.data.password, res);
  res.json({ ok: true });
});

authRouter.post('/demo', (_req, res) => {
  demoSignIn(res);
  res.json({ ok: true });
});

authRouter.get('/google', (req, res) => startGoogle(req, res));
authRouter.get('/google/callback', async (req, res) => {
  await finishGoogle(req, res);
});

authRouter.post('/authenticator/start', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  res.json(startAuthenticator(req));
});
authRouter.post('/authenticator/confirm', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  confirmAuthenticator(req, body(req, z.object({ code: z.string().trim().min(6).max(8) })).code);
  res.json({ ok: true });
});
authRouter.post('/authenticator/remove', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  removeAuthenticator(body(req, z.object({ password: z.string().min(1).max(200) })).password);
  res.json({ ok: true });
});
authRouter.post('/trusted/forget', (req, res) => {
  if (!sessionValid(req)) throw new HttpError(401, 'Sign in first.');
  forgetTrustedDevices();
  res.json({ ok: true });
});

authRouter.post('/setup', (req, res) => {
  if (isConfigured()) throw new HttpError(409, 'A passphrase is already set');
  setPassphrase(body(req, passphraseSchema).passphrase);
  createSession(res);
  res.status(201).json({ configured: true, authenticated: true });
});

authRouter.post('/login', (req, res) => {
  if (!isConfigured()) throw new HttpError(409, 'No passphrase has been set yet');
  if (authStatus(req).hasEmail)
    throw new HttpError(400, 'Sign in with your email and password instead.');
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
