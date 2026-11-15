import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-draft-devices-'));
process.env.LIVING_DRAFT_DATA_DIR = dataDir;
delete process.env.LIVING_DRAFT_SMTP;
delete process.env.LIVING_DRAFT_AI_URL;

let server: Server;
let base = '';

function client() {
  const jar = new Map<string, string>();
  return async <T>(method: string, url: string, payload?: unknown) => {
    const headers: Record<string, string> = {};
    if (payload) headers['Content-Type'] = 'application/json';
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(`${base}/api${url}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [name, ...value] = pair!.split('=');
      if (value.join('=')) jar.set(name!.trim(), value.join('='));
    }
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  };
}

const phone = client();
const watch = client();

beforeAll(async () => {
  const { createApp } = await import('../src/app');
  const { openDatabase } = await import('../src/db/database');
  const { config } = await import('../src/config');
  openDatabase(config.databaseFile);
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await phone('POST', '/auth/signup', {
    name: 'Noor',
    email: 'noor@example.com',
    password: 'lantern-walk-5',
    confirm: 'lantern-walk-5',
    twoStep: false,
    about: { birthDate: '1999-06-01' },
  });
});

afterAll(() => {
  server?.close();
});

describe('a paired watch', () => {
  let code = '';

  it('is turned away until it pairs', async () => {
    expect((await watch('GET', '/devices/today')).status).toBe(401);
    const { body } = await phone<{ code: string; expiresAt: string }>('POST', '/devices/pair');
    expect(body.code).toMatch(/^\d{6}$/);
    code = body.code;
  });

  it('pairs with the code once, and only once', async () => {
    const wrong = await watch('POST', '/auth/pair', {
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.status).toBe(400);
    const paired = await watch('POST', '/auth/pair', { code });
    expect(paired.status).toBe(200);
    const again = await client()('POST', '/auth/pair', { code });
    expect(again.status).toBe(400);
  });

  it('says there is nothing yet on an empty notebook', async () => {
    const today = await watch<{ memory: unknown; name: string }>('GET', '/devices/today');
    expect(today.body).toEqual({ memory: null, name: 'Noor' });
  });

  it('saves a spoken memory and reads it back', async () => {
    const saved = await watch<{ id: string; title: string; tidying: boolean }>(
      'POST',
      '/devices/memories',
      {
        text: 'when I was eight my grandmother taught me to make rotis and mine came out shaped like countries',
      },
    );
    expect(saved.status).toBe(201);
    expect(saved.body.tidying).toBe(false);

    const recent = await watch<Array<{ id: string; title: string; when: string }>>(
      'GET',
      '/devices/recent',
    );
    expect(recent.body[0]?.id).toBe(saved.body.id);

    const today = await watch<{ memory: { id: string; speech: string } }>('GET', '/devices/today');
    expect(today.body.memory.id).toBe(saved.body.id);
    expect(today.body.memory.speech).toMatch(/rotis/);

    const one = await watch<{ speech: string; when: string }>(
      'GET',
      `/devices/memories/${saved.body.id}`,
    );
    expect(one.body.when).toMatch(/8/);
  });

  it('answers a question straight away when no model is connected', async () => {
    const answer = await watch<{ lines: string[]; sources: string[] }>('POST', '/devices/ask', {
      question: 'What did my grandmother teach me?',
    });
    expect(answer.status).toBe(200);
    expect(answer.body.lines.length).toBeGreaterThan(0);
  });

  it('refuses a too-short memory with a readable reason', async () => {
    const short = await watch<{ error: string }>('POST', '/devices/memories', { text: 'hi' });
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/too short/);
  });
});
