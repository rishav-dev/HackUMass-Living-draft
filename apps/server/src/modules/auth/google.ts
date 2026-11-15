import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { get, run } from '../../db/database';
import { HttpError } from '../../lib/http';
import {
  createSession,
  isConfigured,
  readCookie,
  sessionValid,
  setPassphrase,
} from './auth.service';

const CLIENT_ID = () => (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_ID : undefined);
const CLIENT_SECRET = () =>
  typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_SECRET : undefined;
const STATE_COOKIE = 'ld_google';

export function googleConfigured(): boolean {
  return Boolean(CLIENT_ID() && CLIENT_SECRET());
}

const base64url = (buffer: Buffer) => buffer.toString('base64url');

function origin(req: Request): string {
  const configured =
    typeof process !== 'undefined' ? process.env.LIVING_DRAFT_PUBLIC_URL : undefined;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

export function startGoogle(req: Request, res: Response) {
  if (!googleConfigured()) throw new HttpError(404, 'Google sign-in is not set up here.');
  const mode = req.query.mode === 'link' ? 'link' : 'login';
  const verifier = base64url(randomBytes(32));
  const state = base64url(randomBytes(16));
  res.cookie(
    STATE_COOKIE,
    JSON.stringify({ state, verifier, mode, remember: req.query.remember === '1' }),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60_000,
    },
  );
  const params = new URLSearchParams({
    client_id: CLIENT_ID()!,
    redirect_uri: `${origin(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function finishGoogle(req: Request, res: Response) {
  const saved = JSON.parse(readCookie(req, STATE_COOKIE) ?? '{}') as {
    state?: string;
    verifier?: string;
    mode?: string;
    remember?: boolean;
  };
  res.clearCookie(STATE_COOKIE, { path: '/' });
  const fail = (message: string) => res.redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  if (!saved.state || saved.state !== req.query.state || typeof req.query.code !== 'string')
    return fail('Google sign-in was interrupted. Try again.');

  const tokens = (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: req.query.code,
      client_id: CLIENT_ID()!,
      client_secret: CLIENT_SECRET()!,
      redirect_uri: `${origin(req)}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: saved.verifier ?? '',
    }),
  }).then((r) => r.json())) as { id_token?: string };
  if (!tokens.id_token) return fail("Google didn't confirm who you are. Try again.");
  const claims = JSON.parse(
    Buffer.from(tokens.id_token.split('.')[1] ?? '', 'base64url').toString(),
  ) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    aud?: string;
  };
  if (!claims.sub || claims.aud !== CLIENT_ID()) return fail("Google didn't confirm who you are.");

  const owner = get<{ email: string | null; google_sub: string | null }>(
    'SELECT email, google_sub FROM auth WHERE id = 1',
  );
  if (saved.mode === 'link') {
    if (!sessionValid(req)) return fail('Sign in first, then connect Google from Settings.');
    run('UPDATE auth SET google_sub = ? WHERE id = 1', claims.sub);
    return res.redirect('/settings?google=linked#account');
  }
  if (!isConfigured()) {
    setPassphrase(base64url(randomBytes(32)));
    run(
      'UPDATE auth SET email = ?, display_name = ?, verified_at = ?, google_sub = ? WHERE id = 1',
      claims.email?.toLowerCase() ?? null,
      claims.name ?? null,
      claims.email_verified ? new Date().toISOString() : null,
      claims.sub,
    );
    createSession(res, Boolean(saved.remember));
    return res.redirect('/welcome');
  }
  const matches =
    owner?.google_sub === claims.sub ||
    (claims.email_verified && owner?.email && owner.email === claims.email?.toLowerCase());
  if (!matches) return fail("That Google account isn't connected to this notebook.");
  if (!owner?.google_sub) run('UPDATE auth SET google_sub = ? WHERE id = 1', claims.sub);
  createSession(res, Boolean(saved.remember));
  return res.redirect('/');
}
