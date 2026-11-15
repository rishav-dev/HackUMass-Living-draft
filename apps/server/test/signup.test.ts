import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthStatusDto, CharacterDto, ProfileDto } from '@living-draft/contracts';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-draft-signup-'));
process.env.LIVING_DRAFT_DATA_DIR = dataDir;
delete process.env.LIVING_DRAFT_SMTP;

let server: Server;
let base = '';
const jar = new Map<string, string>();

async function call<T>(method: string, url: string, payload?: unknown) {
  const headers: Record<string, string> = {};
  if (payload) headers['Content-Type'] = 'application/json';
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const response = await fetch(`${base}/api${url}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair, ...attributes] = cookie.split(';');
    const [name, ...value] = pair!.split('=');
    const cleared = attributes.some((a) => /expires=Thu, 01 Jan 1970/i.test(a));
    if (cleared || value.join('=') === '') jar.delete(name!.trim());
    else jar.set(name!.trim(), value.join('='));
  }
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

function lastCode(): string {
  const dir = path.join(dataDir, 'outbox');
  const files = fs.readdirSync(dir).sort();
  const mail = fs.readFileSync(path.join(dir, files[files.length - 1]!), 'utf8');
  return /\b(\d{6})\b/.exec(mail)?.[1] ?? '';
}

const signUp = {
  name: 'Ravi',
  email: 'ravi@example.com',
  password: 'monsoon-kite-42',
  confirm: 'monsoon-kite-42',
  remember: true,
  twoStep: false,
  about: {
    fullName: 'Ravi Menon',
    birthDate: '2001-03-09',
    sex: 'Male',
    gender: 'Man',
    pronouns: 'he/him',
    birthPlace: 'Kochi, India',
    currentPlace: 'Amherst, Massachusetts',
  },
  people: [
    { name: 'Amma', kind: 'family', relationship: 'Mom', note: 'Calls every Sunday' },
    { name: 'Biscuit', kind: 'pet', relationship: 'dog' },
    { name: 'Tara', kind: 'friend', relationship: 'best friend' },
  ],
};

beforeAll(async () => {
  const { createApp } = await import('../src/app');
  const { openDatabase } = await import('../src/db/database');
  const { config } = await import('../src/config');
  openDatabase(config.databaseFile);
  const { setPassphrase } = await import('../src/modules/auth/auth.service');
  const { createProfile } = await import('../src/modules/profile/profile.repository');
  setPassphrase('sample-notebook-1');
  createProfile({ preferredName: 'Kinjal', currentAge: 23 }, { isSample: true });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server?.close();
});

describe('signing up with a full profile', () => {
  it('only replaces the sample notebook when asked to, and keeps a copy', async () => {
    const refused = await call<{ error: string }>('POST', '/auth/signup', signUp);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/sample notebook/);

    const made = await call<AuthStatusDto>('POST', '/auth/signup', {
      ...signUp,
      replaceSample: true,
    });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ authenticated: true, verified: true, twoStep: false });
    expect(fs.readdirSync(path.join(dataDir, 'backups'))[0]).toMatch(/^sample-notebook-.+\.zip$/);
  });

  it('keeps the baseline profile and the people who matter', async () => {
    const { body } = await call<{ profile: ProfileDto }>('GET', '/profile');
    expect(body.profile).toMatchObject({
      preferredName: 'Ravi',
      fullName: 'Ravi Menon',
      sex: 'Male',
      gender: 'Man',
      pronouns: 'he/him',
      birthDate: '2001-03-09',
      birthPlace: 'Kochi, India',
      placeName: 'Amherst, Massachusetts',
      isSample: false,
    });
    expect(body.profile.currentAge).toBeGreaterThanOrEqual(25);

    const people = await call<CharacterDto[]>('GET', '/characters');
    const byName = Object.fromEntries(people.body.map((p) => [p.name, p]));
    expect(byName.Amma?.relationship).toBe('Mom');
    expect(byName.Biscuit?.relationship).toBe('pet dog');
    expect(byName.Tara?.relationship).toBe('best friend');
  });

  it('signs back in with just the email and password when two-step is off', async () => {
    await call('POST', '/auth/logout');
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.authenticated).toBe(false);
    const wrong = await call('POST', '/auth/sign-in', {
      email: 'ravi@example.com',
      password: 'monsoon-kite-41',
    });
    expect(wrong.status).toBe(401);
    const back = await call<{ next: string }>('POST', '/auth/sign-in', {
      email: 'RAVI@example.com',
      password: 'monsoon-kite-42',
    });
    expect(back.body.next).toBe('done');
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.authenticated).toBe(true);
  });

  it('asks for a code once two-step is turned on, and needs the password to turn it off', async () => {
    const on = await call<AuthStatusDto>('POST', '/auth/two-step', { on: true });
    expect(on.body.twoStep).toBe(true);

    await call('POST', '/auth/logout');
    const first = await call<{ next: string }>('POST', '/auth/sign-in', {
      email: 'ravi@example.com',
      password: 'monsoon-kite-42',
    });
    expect(first.body.next).toBe('code');
    const done = await call('POST', '/auth/sign-in/code', { code: lastCode() });
    expect(done.status).toBe(200);

    const refused = await call('POST', '/auth/two-step', { on: false, password: 'nope' });
    expect(refused.status).toBe(401);
    const off = await call<AuthStatusDto>('POST', '/auth/two-step', {
      on: false,
      password: 'monsoon-kite-42',
    });
    expect(off.body.twoStep).toBe(false);
  });

  it('turns away a second sign-up once the notebook has an owner', async () => {
    const again = await call('POST', '/auth/signup', { ...signUp, replaceSample: true });
    expect(again.status).toBe(409);
  });
});
