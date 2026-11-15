import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { AuthStatusDto } from '@living-draft/contracts';
import { ageOnDate } from '@living-draft/engine';
import { config } from '../../config';
import { get, run } from '../../db/database';
import { HttpError, newId, now } from '../../lib/http';
import { deleteEverything, exportArchive } from '../archive/archive.service';
import { createCharacter } from '../characters/character.repository';
import { createProfile, findProfile } from '../profile/profile.repository';
import {
  clearAuth,
  createSession,
  endAllSessions,
  isConfigured,
  readCookie,
  sessionValid,
  setPassphrase,
  verifyPassphrase,
} from './auth.service';
import { googleConfigured } from './google';
import { mail } from './mailer';
import { checkTotp, newSecret, totpSupported, totpUri } from './totp';

const TRUSTED_COOKIE = 'ld_trusted';
const PENDING_COOKIE = 'ld_pending';
const TRUST_DAYS = 90;

interface AccountRow {
  email: string | null;
  display_name: string | null;
  verified_at: string | null;
  totp_secret: string | null;
  google_sub: string | null;
  two_step: number;
}

export interface Person {
  name: string;
  kind: 'family' | 'friend' | 'partner' | 'pet' | 'mentor' | 'other';
  relationship: string;
  note: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  remember: boolean;
  twoStep: boolean;
  replaceSample: boolean;
  about?: {
    fullName?: string | null;
    birthDate?: string | null;
    age?: number | null;
    sex?: string | null;
    gender?: string | null;
    pronouns?: string | null;
    birthPlace?: string | null;
    currentPlace?: string | null;
  };
  people: Person[];
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function account(): AccountRow | null {
  return (
    get<AccountRow>(
      'SELECT email, display_name, verified_at, totp_secret, google_sub, two_step FROM auth WHERE id = 1',
    ) ?? null
  );
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function sixDigits(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, '0');
}

export function authStatus(req: Request): AuthStatusDto {
  const configured = isConfigured();
  const row = configured ? account() : null;
  const profile = findProfile();
  return {
    configured,
    authenticated: configured ? sessionValid(req) : true,
    email: maskEmail(row?.email ?? null),
    name: row?.display_name ?? profile?.preferredName ?? null,
    verified: Boolean(row?.verified_at) || !row?.email,
    hasEmail: Boolean(row?.email),
    totpEnabled: Boolean(row?.totp_secret),
    googleLinked: Boolean(row?.google_sub),
    methods: { email: mail.kind !== 'none', google: googleConfigured(), totp: totpSupported() },
    mailer: mail.kind,
    demo: Boolean(profile?.isSample),
    twoStep: Boolean(row && row.two_step),
  };
}

async function sendCode(purpose: 'verify' | 'login', email: string, payload: string | null = null) {
  const code = sixDigits();
  const id = newId();
  run('UPDATE auth_codes SET used_at = ? WHERE purpose = ? AND used_at IS NULL', now(), purpose);
  run(
    `INSERT INTO auth_codes (id, purpose, code_hash, payload, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    purpose,
    hash(code),
    payload,
    new Date(Date.now() + 10 * 60_000).toISOString(),
    now(),
  );
  await mail.send(
    email,
    purpose === 'verify' ? 'Your Living Draft code' : 'Your Living Draft sign-in code',
    `Your code is ${code}. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore it.`,
  );
  return id;
}

function useCode(purpose: string, code: string, id?: string): { payload: string | null } {
  const row = get<{
    id: string;
    code_hash: string;
    payload: string | null;
    expires_at: string;
    attempts: number;
  }>(
    `SELECT id, code_hash, payload, expires_at, attempts FROM auth_codes
     WHERE purpose = ? AND used_at IS NULL ${id ? 'AND id = ?' : ''} ORDER BY created_at DESC LIMIT 1`,
    ...(id ? [purpose, id] : [purpose]),
  );
  if (!row || row.expires_at < now())
    throw new HttpError(400, 'That code has expired. Ask for a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many tries. Ask for a new code.');
  if (row.code_hash !== hash(code.trim())) {
    run('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
    throw new HttpError(400, "That code doesn't match.");
  }
  run('UPDATE auth_codes SET used_at = ? WHERE id = ?', now(), row.id);
  return { payload: row.payload };
}

function describe(person: Person): string | null {
  const detail = person.relationship.trim();
  if (person.kind === 'pet') return detail ? `pet ${detail}` : 'pet';
  if (person.kind === 'other') return detail || null;
  return detail || person.kind;
}

function backUpSample() {
  const folder = path.join(config.dataDir, 'backups');
  fs.mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  fs.writeFileSync(path.join(folder, `sample-notebook-${stamp}.zip`), exportArchive());
}

export async function signUp(input: SignUpInput, res: Response) {
  if (isConfigured()) {
    if (!findProfile()?.isSample)
      throw new HttpError(409, 'This notebook already has an owner. Sign in instead.');
    if (!input.replaceSample)
      throw new HttpError(
        409,
        'This computer has the sample notebook. Tick the box to replace it with yours.',
      );
    backUpSample();
    deleteEverything();
    clearAuth();
  }
  const twoStep = input.twoStep && mail.kind !== 'none';
  setPassphrase(input.password);
  run(
    'UPDATE auth SET email = ?, display_name = ?, verified_at = ?, two_step = ? WHERE id = 1',
    input.email.trim().toLowerCase(),
    input.name.trim(),
    twoStep ? null : now(),
    twoStep ? 1 : 0,
  );
  if (input.about && !findProfile()) {
    const about = input.about;
    createProfile({
      preferredName: input.name.trim(),
      currentAge: about.birthDate ? ageOnDate(about.birthDate, new Date()) : (about.age ?? 0),
      birthDate: about.birthDate ?? null,
      fullName: about.fullName ?? null,
      sex: about.sex ?? null,
      gender: about.gender ?? null,
      pronouns: about.pronouns ?? null,
      birthPlace: about.birthPlace ?? null,
      placeName: about.currentPlace ?? null,
    });
    for (const person of input.people)
      createCharacter({
        name: person.name.trim(),
        relationship: describe(person),
        notes: person.note.trim() || null,
      });
  }
  createSession(res, input.remember);
  if (twoStep) await sendCode('verify', input.email);
}

const PAIR_MINUTES = 10;

export function startPairing(): { code: string; expiresAt: string } {
  run("UPDATE auth_codes SET used_at = ? WHERE purpose = 'pair' AND used_at IS NULL", now());
  const code = sixDigits();
  const expiresAt = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  run(
    `INSERT INTO auth_codes (id, purpose, code_hash, payload, expires_at, created_at)
     VALUES (?, 'pair', ?, NULL, ?, ?)`,
    newId(),
    hash(code),
    expiresAt,
    now(),
  );
  return { code, expiresAt };
}

export function finishPairing(code: string, res: Response) {
  if (!isConfigured()) throw new HttpError(409, 'Create an account first.');
  useCode('pair', code);
  createSession(res, true);
}

export function setTwoStep(on: boolean, password: string | undefined) {
  if (!on && !verifyPassphrase(password ?? ''))
    throw new HttpError(401, "That password isn't right.");
  if (on && mail.kind === 'none' && !account()?.totp_secret)
    throw new HttpError(
      400,
      'This version has no email, so set up an authenticator app below for a second step.',
    );
  run('UPDATE auth SET two_step = ? WHERE id = 1', on ? 1 : 0);
}

export async function resendVerification() {
  const row = account();
  if (!row?.email) throw new HttpError(400, 'There is no email on this account.');
  await sendCode('verify', row.email);
}

export function verifyEmail(code: string) {
  useCode('verify', code);
  run('UPDATE auth SET verified_at = ? WHERE id = 1', now());
}

function trusted(req: Request): boolean {
  const token = readCookie(req, TRUSTED_COOKIE);
  if (!token) return false;
  const row = get<{ expires_at: string }>(
    'SELECT expires_at FROM trusted_devices WHERE token_hash = ?',
    hash(token),
  );
  if (!row || row.expires_at < now()) return false;
  run('UPDATE trusted_devices SET last_seen = ? WHERE token_hash = ?', now(), hash(token));
  return true;
}

function trustThisDevice(req: Request, res: Response) {
  const token = randomBytes(32).toString('base64url');
  run(
    'INSERT INTO trusted_devices (token_hash, label, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?)',
    hash(token),
    (req.headers['user-agent'] ?? 'This device').slice(0, 120),
    now(),
    now(),
    new Date(Date.now() + TRUST_DAYS * 864e5).toISOString(),
  );
  res.cookie(TRUSTED_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRUST_DAYS * 864e5,
  });
}

export async function signIn(
  input: { email?: string; password: string; remember: boolean },
  req: Request,
  res: Response,
): Promise<{ next: 'done' | 'code' | 'authenticator'; sentTo?: string | null }> {
  if (!isConfigured()) throw new HttpError(409, 'Create an account first.');
  const row = account();
  if (row?.email && input.email && input.email.trim().toLowerCase() !== row.email)
    throw new HttpError(401, "That email and password don't match.");
  if (!verifyPassphrase(input.password))
    throw new HttpError(401, "That email and password don't match.");

  const secondStep = !row?.two_step
    ? null
    : row.totp_secret
      ? 'authenticator'
      : row.email && mail.kind !== 'none'
        ? 'code'
        : null;
  if (!secondStep || trusted(req)) {
    createSession(res, input.remember);
    return { next: 'done' };
  }
  const pending = randomBytes(24).toString('base64url');
  const payload = JSON.stringify({ remember: input.remember, pending: hash(pending) });
  if (secondStep === 'code') await sendCode('login', row!.email!, payload);
  else
    run(
      `INSERT INTO auth_codes (id, purpose, code_hash, payload, expires_at, created_at)
       VALUES (?, 'totp-login', ?, ?, ?, ?)`,
      newId(),
      hash(pending),
      payload,
      new Date(Date.now() + 10 * 60_000).toISOString(),
      now(),
    );
  res.cookie(PENDING_COOKIE, pending, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 10 * 60_000,
  });
  return { next: secondStep, sentTo: secondStep === 'code' ? maskEmail(row!.email) : null };
}

export function finishSignIn(input: { code: string; trust: boolean }, req: Request, res: Response) {
  const pending = readCookie(req, PENDING_COOKIE);
  if (!pending) throw new HttpError(400, 'Sign in again to get a new code.');
  const row = account();
  let remember: boolean;
  if (row?.totp_secret) {
    const ticket = get<{ id: string; payload: string; expires_at: string }>(
      "SELECT id, payload, expires_at FROM auth_codes WHERE purpose = 'totp-login' AND code_hash = ? AND used_at IS NULL",
      hash(pending),
    );
    if (!ticket || ticket.expires_at < now())
      throw new HttpError(400, 'Sign in again to continue.');
    if (!checkTotp(row.totp_secret, input.code))
      throw new HttpError(400, "That code doesn't match.");
    run('UPDATE auth_codes SET used_at = ? WHERE id = ?', now(), ticket.id);
    remember = Boolean((JSON.parse(ticket.payload) as { remember: boolean }).remember);
  } else {
    const { payload } = useCode('login', input.code);
    const data = JSON.parse(payload ?? '{}') as { remember?: boolean; pending?: string };
    if (data.pending !== hash(pending))
      throw new HttpError(400, 'Sign in again to get a new code.');
    remember = Boolean(data.remember);
  }
  res.clearCookie(PENDING_COOKIE, { path: '/' });
  createSession(res, remember);
  if (input.trust) trustThisDevice(req, res);
}

export async function forgotPassword(email: string, origin: string) {
  const row = account();
  if (!row?.email || row.email !== email.trim().toLowerCase()) return;
  const token = randomBytes(32).toString('base64url');
  run(
    `INSERT INTO auth_codes (id, purpose, code_hash, expires_at, created_at) VALUES (?, 'reset', ?, ?, ?)`,
    newId(),
    hash(token),
    new Date(Date.now() + 30 * 60_000).toISOString(),
    now(),
  );
  await mail.send(
    row.email,
    'Reset your Living Draft password',
    `Someone asked to reset the password for your notebook. If it was you, open this link within 30 minutes:\n\n${origin}/reset-password?token=${token}\n\nIf it wasn't you, ignore this and nothing changes.`,
  );
}

export function resetPassword(token: string, password: string, res: Response) {
  const row = get<{ id: string; expires_at: string }>(
    "SELECT id, expires_at FROM auth_codes WHERE purpose = 'reset' AND code_hash = ? AND used_at IS NULL",
    hash(token),
  );
  if (!row || row.expires_at < now())
    throw new HttpError(400, 'That reset link has expired. Ask for a new one.');
  run('UPDATE auth_codes SET used_at = ? WHERE id = ?', now(), row.id);
  setPassphrase(password);
  endAllSessions();
  run('DELETE FROM trusted_devices');
  createSession(res, false);
}

const pendingSecrets = new Map<string, { secret: string; at: number }>();

export function startAuthenticator(req: Request) {
  if (!totpSupported())
    throw new HttpError(400, 'Authenticator codes are not available in this version.');
  const secret = newSecret();
  const key = readCookie(req, 'ld_session') ?? 'local';
  pendingSecrets.set(key, { secret, at: Date.now() });
  const label = account()?.email ?? findProfile()?.preferredName ?? 'notebook';
  return { secret, uri: totpUri(secret, label) };
}

export function confirmAuthenticator(req: Request, code: string) {
  const key = readCookie(req, 'ld_session') ?? 'local';
  const pending = pendingSecrets.get(key);
  if (!pending || Date.now() - pending.at > 15 * 60_000)
    throw new HttpError(400, 'Start the setup again.');
  if (!checkTotp(pending.secret, code))
    throw new HttpError(400, "That code doesn't match. Check the time on your phone.");
  run('UPDATE auth SET totp_secret = ? WHERE id = 1', pending.secret);
  pendingSecrets.delete(key);
}

export function removeAuthenticator(password: string) {
  if (!verifyPassphrase(password)) throw new HttpError(401, "That password doesn't match.");
  run('UPDATE auth SET totp_secret = NULL WHERE id = 1');
}

export function forgetTrustedDevices() {
  run('DELETE FROM trusted_devices');
}

export function demoSignIn(res: Response) {
  if (!findProfile()?.isSample) throw new HttpError(403, 'There is no demo notebook here.');
  createSession(res, false);
}
