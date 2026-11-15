import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { get, run } from '../../db/database';
import { HttpError, now } from '../../lib/http';

export const SESSION_COOKIE = 'ld_session';
const SESSION_DAYS = 30;
const failures = { count: 0, until: 0 };

interface AuthRow {
  pass_hash: string;
  salt: string;
}

function derive(passphrase: string, salt: string): Buffer {
  return scryptSync(passphrase.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isConfigured(): boolean {
  return !!get('SELECT id FROM auth WHERE id = 1');
}

export function setPassphrase(passphrase: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = derive(passphrase, salt).toString('hex');
  const timestamp = now();
  run(
    `INSERT INTO auth (id, pass_hash, salt, created_at, updated_at) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET pass_hash = excluded.pass_hash, salt = excluded.salt, updated_at = excluded.updated_at`,
    hash,
    salt,
    timestamp,
    timestamp,
  );
}

export function verifyPassphrase(passphrase: string): boolean {
  if (Date.now() < failures.until) {
    throw new HttpError(
      429,
      `Too many tries. Wait ${Math.ceil((failures.until - Date.now()) / 1000)} seconds.`,
    );
  }
  const row = get<AuthRow>('SELECT pass_hash, salt FROM auth WHERE id = 1');
  if (!row) return false;
  const expected = Buffer.from(row.pass_hash, 'hex');
  const actual = derive(passphrase, row.salt);
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (ok) {
    failures.count = 0;
    failures.until = 0;
  } else {
    failures.count += 1;
    if (failures.count >= 5)
      failures.until = Date.now() + Math.min(300, 15 * 2 ** (failures.count - 5)) * 1000;
  }
  return ok;
}

export function createSession(res: Response, persistent = true): string {
  const token = randomBytes(32).toString('base64url');
  const timestamp = now();
  const lifetime = persistent ? SESSION_DAYS * 864e5 : 12 * 3600e3;
  run(
    'INSERT INTO sessions (token_hash, created_at, expires_at, last_seen, persistent) VALUES (?, ?, ?, ?, ?)',
    hashToken(token),
    timestamp,
    new Date(Date.now() + lifetime).toISOString(),
    timestamp,
    persistent ? 1 : 0,
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    ...(persistent ? { maxAge: lifetime } : {}),
  });
  return token;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionValid(req: Request): boolean {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return false;
  const row = get<{ expires_at: string }>(
    'SELECT expires_at FROM sessions WHERE token_hash = ?',
    hashToken(token),
  );
  if (!row || row.expires_at < now()) return false;
  run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', now(), hashToken(token));
  return true;
}

export function endSession(req: Request, res: Response) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', hashToken(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function endAllSessions() {
  run('DELETE FROM sessions');
}

export function clearAuth() {
  run('DELETE FROM sessions');
  run('DELETE FROM auth');
}
