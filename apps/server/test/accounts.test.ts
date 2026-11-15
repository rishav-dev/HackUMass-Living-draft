import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthStatusDto } from '@living-draft/contracts';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-draft-accounts-'));
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
    redirect: 'manual',
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

function lastMail(): string {
  const dir = path.join(dataDir, 'outbox');
  const files = fs.readdirSync(dir).sort();
  return fs.readFileSync(path.join(dir, files[files.length - 1]!), 'utf8');
}

const codeIn = (mail: string) => /\b(\d{6})\b/.exec(mail)?.[1] ?? '';

beforeAll(async () => {
  const { createApp } = await import('../src/app');
  const { openDatabase } = await import('../src/db/database');
  const { config } = await import('../src/config');
  openDatabase(config.databaseFile);
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server?.close();
});

describe('accounts', () => {
  it('creates an account and verifies the email with a code', async () => {
    const fresh = await call<AuthStatusDto>('GET', '/auth/status');
    expect(fresh.body.configured).toBe(false);

    const mismatch = await call<{ error: string }>('POST', '/auth/signup', {
      name: 'Asha',
      email: 'asha@example.com',
      password: 'tea-and-toast-9',
      confirm: 'tea-and-toast-8',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error).toMatch(/don’t match/);

    const weak = await call<{ error: string }>('POST', '/auth/signup', {
      name: 'Asha',
      email: 'asha@example.com',
      password: 'short',
      confirm: 'short',
    });
    expect(weak.status).toBe(400);

    const made = await call<AuthStatusDto>('POST', '/auth/signup', {
      name: 'Asha',
      email: 'Asha@Example.com',
      password: 'tea-and-toast-9',
      confirm: 'tea-and-toast-9',
      remember: true,
    });
    expect(made.status).toBe(201);
    expect(made.body.authenticated).toBe(true);
    expect(made.body.verified).toBe(false);
    expect(made.body.email).toBe('as••@example.com');

    const wrong = await call('POST', '/auth/verify-email', { code: '000000' });
    expect(wrong.status).toBe(400);
    const right = await call('POST', '/auth/verify-email', { code: codeIn(lastMail()) });
    expect(right.status).toBe(200);
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.verified).toBe(true);
  });

  it('asks for a second step on a new device, then trusts it', async () => {
    await call('POST', '/auth/logout');
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.authenticated).toBe(false);

    const bad = await call('POST', '/auth/sign-in', {
      email: 'asha@example.com',
      password: 'nope-nope-1',
      remember: true,
    });
    expect(bad.status).toBe(401);

    const first = await call<{ next: string; sentTo: string }>('POST', '/auth/sign-in', {
      email: 'asha@example.com',
      password: 'tea-and-toast-9',
      remember: true,
    });
    expect(first.body.next).toBe('code');
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.authenticated).toBe(false);

    const done = await call('POST', '/auth/sign-in/code', {
      code: codeIn(lastMail()),
      trust: true,
    });
    expect(done.status).toBe(200);
    expect((await call<AuthStatusDto>('GET', '/auth/status')).body.authenticated).toBe(true);
    expect(jar.has('ld_trusted')).toBe(true);

    await call('POST', '/auth/logout');
    const again = await call<{ next: string }>('POST', '/auth/sign-in', {
      email: 'asha@example.com',
      password: 'tea-and-toast-9',
      remember: false,
    });
    expect(again.body.next).toBe('done');
  });

  it('resets a forgotten password with an emailed link', async () => {
    await call('POST', '/auth/logout');
    expect((await call('POST', '/auth/forgot', { email: 'asha@example.com' })).status).toBe(200);
    const token = /token=([\w-]+)/.exec(lastMail())?.[1] ?? '';
    expect(token.length).toBeGreaterThan(20);
    const reset = await call('POST', '/auth/reset', { token, password: 'new-kettle-42' });
    expect(reset.status).toBe(200);
    const reused = await call('POST', '/auth/reset', { token, password: 'another-one-42' });
    expect(reused.status).toBe(400);

    jar.clear();
    const old = await call('POST', '/auth/sign-in', {
      email: 'asha@example.com',
      password: 'tea-and-toast-9',
      remember: false,
    });
    expect(old.status).toBe(401);
    const fresh = await call<{ next: string }>('POST', '/auth/sign-in', {
      email: 'asha@example.com',
      password: 'new-kettle-42',
      remember: false,
    });
    expect(fresh.body.next).toBe('code');
  });

  it('keeps the demo door shut when there is no sample notebook', async () => {
    expect((await call('POST', '/auth/demo')).status).toBe(403);
  });
});
