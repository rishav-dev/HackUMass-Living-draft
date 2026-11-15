import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiRunner, AskOptions, JsonSchema } from './runner';
import type { AiStatusDto } from '@living-draft/contracts';
import { config } from '../../config';
import { WORK_THREADS } from '../../lib/background';
import { HttpError } from '../../lib/http';
import { readJson } from './json';

const MODEL = {
  name: 'Qwen3 4B Instruct',
  file: 'Qwen3-4B-Instruct-2507-Q4_0.gguf',
  url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_0.gguf',
  bytes: 2_375_773_280,
};

interface Loaded {
  child: ChildProcess;
}

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onText?: (soFar: string) => void;
}

const waiting = new Map<number, Waiting>();
let counter = 0;

interface Job {
  urgent: boolean;
  run: () => Promise<void>;
}

let status: AiStatusDto['status'] = 'idle';
let progress = 0;
let reason: string | null = null;
let loading: Promise<Loaded> | null = null;
let gpuName: string | null = null;
const queue: Job[] = [];
let busy = false;

const modelPath = () => path.join(config.modelDir, 'llm', MODEL.file);

function aiStatus(): AiStatusDto {
  return {
    status,
    progress,
    downloaded: fs.existsSync(modelPath()),
    reason,
    model: MODEL.name,
    where: 'local',
    sizeLabel: '2.4 GB',
    gpu: gpuName,
  };
}

async function download(): Promise<string> {
  const target = modelPath();
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partial = `${target}.part`;
  const already = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  const response = await fetch(MODEL.url, {
    headers: already ? { Range: `bytes=${already}-` } : {},
  });
  if (!response.ok || !response.body) throw new Error(`download failed (${response.status})`);
  const resumed = response.status === 206;
  const total = resumed
    ? already + Number(response.headers.get('content-length') ?? 0)
    : Number(response.headers.get('content-length') ?? MODEL.bytes);
  const out = fs.createWriteStream(partial, { flags: resumed ? 'a' : 'w' });
  let received = resumed ? already : 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    progress = Math.min(0.99, received / total);
    if (!out.write(value)) await new Promise<void>((resolve) => out.once('drain', () => resolve()));
  }
  await new Promise<void>((resolve, reject) =>
    out.end((error?: Error | null) => (error ? reject(error) : resolve())),
  );
  fs.renameSync(partial, target);
  return target;
}

function spawnChild(): ChildProcess {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const script = path.join(here, 'llm-process.ts');
  const child = fork(script, [], {
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  child.on(
    'message',
    (message: { type: string; id?: number; text?: string; error?: string; soFar?: string }) => {
      if (message.type === 'chunk' && message.id !== undefined)
        waiting.get(message.id)?.onText?.(message.soFar ?? '');
      if (message.type === 'result' && message.id !== undefined) {
        const entry = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.error) entry?.reject(new Error(message.error));
        else entry?.resolve(message.text ?? '');
      }
    },
  );
  child.on('exit', () => {
    for (const entry of waiting.values()) entry.reject(new Error('The writing helper stopped.'));
    waiting.clear();
    loading = null;
    if (status !== 'failed') status = 'idle';
  });
  return child;
}

function load(): Promise<Loaded> {
  if (loading) return loading;
  status = 'loading';
  reason = null;
  progress = fs.existsSync(modelPath()) ? 1 : 0;
  const attempt = (async () => {
    const file = await download();
    const child = spawnChild();
    const gpu = await new Promise<string | null>((resolve, reject) => {
      const onMessage = (message: { type: string; gpu?: string | null; message?: string }) => {
        if (message.type === 'loaded') {
          child.off('message', onMessage);
          resolve(message.gpu ?? null);
        } else if (message.type === 'failed') {
          child.off('message', onMessage);
          reject(new Error(message.message));
        }
      };
      child.on('message', onMessage);
      child.once('exit', () => reject(new Error('The writing helper stopped while starting.')));
      child.send({ type: 'load', modelPath: file, threads: WORK_THREADS });
    });
    gpuName = gpu;
    return { child };
  })();
  loading = attempt;
  attempt.then(
    () => {
      status = 'ready';
      progress = 1;
    },
    (error: unknown) => {
      status = 'failed';
      reason =
        error instanceof Error &&
        /fetch|network|ENOTFOUND|ECONN|ETIMEDOUT|download/i.test(error.message)
          ? "Couldn't download the model. Check the connection and try again."
          : "The model couldn't start on this computer.";
      console.error('AI model failed to load:', error);
      loading = null;
    },
  );
  return attempt;
}

function ask(
  kind: 'json' | 'text',
  options: AskOptions,
  schema?: JsonSchema,
  onText?: (soFar: string) => void,
): Promise<string> {
  return enqueue(Boolean(options.urgent), async () => {
    const { child } = await load();
    const id = ++counter;
    return new Promise<string>((resolve, reject) => {
      waiting.set(id, { resolve, reject, onText });
      child.send({
        type: kind,
        id,
        system: options.system,
        prompt: options.prompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature ?? (kind === 'json' ? 0.4 : 0.5),
        schema,
      });
    });
  });
}

function prepareAi(): AiStatusDto {
  load().catch(() => undefined);
  return aiStatus();
}

function aiAvailable(): boolean {
  return fs.existsSync(modelPath());
}

function pump() {
  if (busy) return;
  const next = queue.findIndex((job) => job.urgent);
  const job = queue.splice(next >= 0 ? next : 0, 1)[0];
  if (!job) return;
  busy = true;
  job.run().finally(() => {
    busy = false;
    pump();
  });
}

function enqueue<T>(urgent: boolean, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      urgent,
      run: () => work().then(resolve, reject),
    });
    pump();
  });
}

async function askJson<T>(options: AskOptions, schema: JsonSchema): Promise<T> {
  if (!aiAvailable()) throw new HttpError(409, 'The AI model is not downloaded yet.');
  const reply = await ask('json', options, schema);
  return readJson<T>(reply.trim().startsWith('{') ? reply : `{${reply}`);
}

async function askText(options: AskOptions, onText?: (soFar: string) => void): Promise<string> {
  if (!aiAvailable()) throw new HttpError(409, 'The AI model is not downloaded yet.');
  return ask('text', options, undefined, onText);
}

export const localRunner: AiRunner = {
  status: aiStatus,
  prepare: prepareAi,
  available: aiAvailable,
  askJson,
  askText,
};
