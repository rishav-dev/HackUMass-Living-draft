import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { unzipSync, strFromU8 } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiStatusDto } from '@living-draft/contracts';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-draft-hosted-'));
process.env.LIVING_DRAFT_DATA_DIR = dataDir;
delete process.env.LIVING_DRAFT_AI_URL;

let app: Server;
let fake: Server;
let base = '';
let fakeUrl = '';
const seen: Array<{ auth?: string; body: Record<string, unknown> }> = [];
let refuseSchema = false;

async function call<T>(method: string, url: string, payload?: unknown) {
  const response = await fetch(`${base}/api${url}`, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : {},
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

beforeAll(async () => {
  fake = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as Record<string, unknown>;
      seen.push({ auth: req.headers.authorization, body });
      if (req.headers.authorization !== 'Bearer good-key') {
        res.writeHead(401).end('{}');
        return;
      }
      const format = body.response_format as { type?: string } | undefined;
      if (refuseSchema && format?.type === 'json_schema') {
        res
          .writeHead(400)
          .end('{"error":{"message":"response_format json_schema is not supported"}}');
        return;
      }
      const content = format
        ? '{"headline":"Both are about asking.","items":["one","two"]}'
        : 'Hello there';
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  }).listen(0);
  fakeUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1`;

  const { createApp } = await import('../src/app');
  const { openDatabase } = await import('../src/db/database');
  const { config } = await import('../src/config');
  openDatabase(config.databaseFile);
  app = createApp().listen(0);
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  await call('POST', '/profile', { preferredName: 'Lena', currentAge: 30 });
});

afterAll(() => {
  app?.close();
  fake?.close();
});

describe('a hosted model with your own key', () => {
  it('saves the service without ever handing the key back', async () => {
    const saved = await call<{ hasKey: boolean; endpoint: string }>('PUT', '/ai/connection', {
      enabled: true,
      endpoint: `${fakeUrl}/chat/completions`,
      model: 'tiny-model',
      apiKey: 'good-key',
    });
    expect(saved.body).toMatchObject({ hasKey: true, endpoint: fakeUrl });
    expect(JSON.stringify(saved.body)).not.toContain('good-key');

    const status = await call<AiStatusDto>('GET', '/ai');
    expect(status.body).toMatchObject({ where: 'remote', status: 'ready', model: 'tiny-model' });

    const kept = await call<{ hasKey: boolean }>('PUT', '/ai/connection', {
      enabled: true,
      endpoint: fakeUrl,
      model: 'tiny-model',
    });
    expect(kept.body.hasKey).toBe(true);
  });

  it('answers the test and runs JSON tasks through the service', async () => {
    const test = await call<{ reply: string }>('POST', '/ai/connection/test');
    expect(test.body.reply).toBe('Hello there');
    expect(seen.at(-1)?.auth).toBe('Bearer good-key');

    const { ai } = await import('../src/modules/ai/runner');
    const reply = await ai.askJson<{ headline: string }>(
      { system: 's', prompt: 'p', maxTokens: 50 },
      { type: 'object' },
    );
    expect(reply.headline).toBe('Both are about asking.');

    refuseSchema = true;
    const retried = await ai.askJson<{ items: string[] }>(
      { system: 's', prompt: 'p', maxTokens: 50 },
      { type: 'object' },
    );
    expect(retried.items).toEqual(['one', 'two']);
    expect((seen.at(-1)?.body.response_format as { type: string }).type).toBe('json_object');
    refuseSchema = false;
  });

  it('explains a refused key in plain words', async () => {
    await call('PUT', '/ai/connection', {
      enabled: true,
      endpoint: fakeUrl,
      model: 'tiny-model',
      apiKey: 'bad-key',
    });
    const test = await call<{ error: string }>('POST', '/ai/connection/test');
    expect(test.status).toBe(502);
    expect(test.body.error).toMatch(/turned the key down/);
  });

  it('keeps the key out of exports, and switching off falls back', async () => {
    const response = await fetch(`${base}/api/export`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(strFromU8(files['archive.json']!)).not.toContain('bad-key');

    await call('PUT', '/ai/connection', { enabled: false, endpoint: fakeUrl, model: 'tiny-model' });
    const status = await call<AiStatusDto>('GET', '/ai');
    expect(status.body.where).toBe('local');

    expect((await call('DELETE', '/ai/connection')).status).toBe(204);
    expect((await call('GET', '/ai/connection')).body).toBeNull();
  });

  it('only accepts secure addresses', async () => {
    const bad = await call<{ error: string }>('PUT', '/ai/connection', {
      enabled: true,
      endpoint: 'http://example.com/v1',
      model: 'x',
      apiKey: 'k',
    });
    expect(bad.status).toBe(400);
  });
});
