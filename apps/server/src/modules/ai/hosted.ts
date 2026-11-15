import type { AiStatusDto } from '@living-draft/contracts';
import { get, run } from '../../db/database';
import { HttpError, now } from '../../lib/http';
import { readJson } from './json';
import type { AiRunner, AskOptions, JsonSchema } from './runner';

interface ConnectionRow {
  enabled: number;
  endpoint: string | null;
  model: string | null;
  api_key: string | null;
}

export interface Connection {
  enabled: boolean;
  endpoint: string;
  model: string;
  key: string;
  fromEnvironment: boolean;
}

export interface ConnectionView {
  enabled: boolean;
  endpoint: string;
  model: string;
  hasKey: boolean;
  fromEnvironment: boolean;
}

function fromEnvironment(): Connection | null {
  const endpoint = process.env.LIVING_DRAFT_AI_URL?.replace(/\/$/, '');
  if (!endpoint) return null;
  return {
    enabled: true,
    endpoint,
    model: process.env.LIVING_DRAFT_AI_MODEL ?? 'local-model',
    key: process.env.LIVING_DRAFT_AI_KEY ?? '',
    fromEnvironment: true,
  };
}

export function connection(): Connection | null {
  const row = get<ConnectionRow>(
    'SELECT enabled, endpoint, model, api_key FROM ai_connection WHERE id = 1',
  );
  if (row?.endpoint && row.model)
    return {
      enabled: Boolean(row.enabled),
      endpoint: row.endpoint,
      model: row.model,
      key: row.api_key ?? '',
      fromEnvironment: false,
    };
  return fromEnvironment();
}

export function connectionView(): ConnectionView | null {
  const found = connection();
  if (!found) return null;
  return {
    enabled: found.enabled,
    endpoint: found.endpoint,
    model: found.model,
    hasKey: Boolean(found.key),
    fromEnvironment: found.fromEnvironment,
  };
}

export function saveConnection(input: {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey?: string | null;
}) {
  const endpoint = input.endpoint
    .trim()
    .replace(/\/$/, '')
    .replace(/\/chat\/completions$/, '');
  if (!/^https:\/\//.test(endpoint) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(endpoint))
    throw new HttpError(400, 'Use the https:// address the service gives you.');
  const current = get<{ api_key: string | null }>('SELECT api_key FROM ai_connection WHERE id = 1');
  const key =
    input.apiKey === undefined ? (current?.api_key ?? null) : input.apiKey?.trim() || null;
  run(
    `INSERT INTO ai_connection (id, enabled, endpoint, model, api_key, updated_at) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, endpoint = excluded.endpoint,
       model = excluded.model, api_key = excluded.api_key, updated_at = excluded.updated_at`,
    input.enabled ? 1 : 0,
    endpoint,
    input.model.trim(),
    key,
    now(),
  );
}

export function forgetConnection() {
  run('DELETE FROM ai_connection');
}

const active = () => {
  const found = connection();
  return found?.enabled ? found : null;
};

async function chat(
  link: Connection,
  options: AskOptions,
  extra: Record<string, unknown> = {},
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${link.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(link.key ? { Authorization: `Bearer ${link.key}` } : {}),
      },
      body: JSON.stringify({
        model: link.model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.prompt },
        ],
        ...extra,
      }),
    });
  } catch {
    throw new HttpError(
      502,
      "Couldn't reach the writing service. Check the address and your connection.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new HttpError(502, 'The writing service turned the key down. Check it in Settings.');
  if (response.status === 404)
    throw new HttpError(502, "The service doesn't recognise that address or model name.");
  if (response.status === 429)
    throw new HttpError(
      502,
      'The writing service says it’s busy or the key is out of credit. Try again in a minute.',
    );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(
      new HttpError(502, `The writing service answered with ${response.status}.`),
      {
        detail,
      },
    );
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

const roomFor = (link: Connection, options: AskOptions): AskOptions => ({
  ...options,
  maxTokens: /gpt-oss|o\d|reason|r1|qwen3/i.test(link.model)
    ? Math.max(options.maxTokens * 4, 4096)
    : Math.max(options.maxTokens * 2, 2048),
});

const thinkLightly = (link: Connection): Record<string, unknown> =>
  /gpt-oss/i.test(link.model) ? { reasoning_effort: 'low' } : {};

const retryable = (error: unknown) =>
  !(error instanceof HttpError) || (error as { detail?: string }).detail !== undefined;

async function hostedJson<T>(
  link: Connection,
  options: AskOptions,
  schema: JsonSchema,
): Promise<T> {
  const roomy = roomFor(link, options);
  const spelled = {
    ...roomy,
    system: `${options.system}\n\nReply with one JSON object that fits this JSON schema, and nothing else:\n${JSON.stringify(schema)}`,
  };
  const tries: Array<[AskOptions, Record<string, unknown>]> = [
    [
      roomy,
      {
        ...thinkLightly(link),
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'reply', schema, strict: false },
        },
      },
    ],
    [spelled, { ...thinkLightly(link), response_format: { type: 'json_object' } }],
    [spelled, thinkLightly(link)],
    [spelled, {}],
  ];
  let failure: unknown;
  for (const [ask, extra] of tries) {
    try {
      return readJson<T>(await chat(link, ask, extra));
    } catch (error) {
      if (!retryable(error)) throw error;
      failure = error;
    }
  }
  throw failure;
}

export async function testConnection(): Promise<string> {
  const link = connection();
  if (!link) throw new HttpError(400, 'Add the service first.');
  const reply = await chat(link, {
    system: 'You are being checked. Answer in a few words.',
    prompt: 'Say hello.',
    maxTokens: 20,
    temperature: 0,
  });
  return reply.trim().slice(0, 80) || 'It answered.';
}

export function withHosted(fallback: AiRunner): AiRunner {
  const status = (): AiStatusDto => {
    const link = active();
    if (!link) return fallback.status();
    return {
      status: 'ready',
      progress: 1,
      downloaded: true,
      reason: null,
      model: link.model,
      where: 'remote',
      sizeLabel: null,
      gpu: null,
    };
  };
  return {
    status,
    prepare: () => (active() ? status() : fallback.prepare()),
    available: () => Boolean(active()) || fallback.available(),
    askJson<T>(options: AskOptions, schema: JsonSchema) {
      const link = active();
      return link ? hostedJson<T>(link, options, schema) : fallback.askJson<T>(options, schema);
    },
    async askText(options: AskOptions, onText?: (soFar: string) => void) {
      const link = active();
      if (!link) return fallback.askText(options, onText);
      const text = await chat(link, { ...options, temperature: options.temperature ?? 0.5 });
      onText?.(text);
      return text;
    },
  };
}
