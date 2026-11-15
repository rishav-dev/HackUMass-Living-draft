import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { KokoroTTS } from 'kokoro-js';
import type { VoiceStatusDto } from '@living-draft/contracts';
import { config } from '../../config';
import { stepAside, WORK_THREADS } from '../../lib/background';
import { HttpError } from '../../lib/http';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KEEP_BYTES = 250 * 1024 * 1024;
const KEEP_DAYS = 45;

interface Job {
  key: string;
  text: string;
  voice: string;
  speed: number;
  listeners: number;
  clip: Promise<Buffer>;
  resolve: (wav: Buffer) => void;
  reject: (error: unknown) => void;
}

let status: VoiceStatusDto['status'] = 'idle';
let progress = 0;
let reason: string | null = null;
let model: Promise<KokoroTTS> | null = null;
const files = new Map<string, { loaded: number; total: number }>();
const queue: Job[] = [];
const waiting = new Map<string, Job>();
let busy = false;
let written = 0;

const modelFile = () => path.join(config.modelDir, MODEL, 'onnx', 'model.onnx');

export function voiceStatus(): VoiceStatusDto {
  return { status, progress, downloaded: fs.existsSync(modelFile()), reason };
}

function load(): Promise<KokoroTTS> {
  if (model) return model;
  status = 'loading';
  progress = fs.existsSync(modelFile()) ? 1 : 0;
  reason = null;
  const loading = (async () => {
    const [{ KokoroTTS }, transformers] = await Promise.all([
      import('kokoro-js'),
      import('@huggingface/transformers'),
    ]);
    transformers.env.cacheDir = config.modelDir;
    stepAside();
    const progress_callback = (event: {
      status: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (event.status !== 'progress' || !event.file) return;
      files.set(event.file, { loaded: event.loaded ?? 0, total: event.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const file of files.values()) {
        loaded += file.loaded;
        total += file.total;
      }
      progress = total ? Math.min(0.99, loaded / total) : 0;
    };
    const [voiceModel, tokenizer] = await Promise.all([
      transformers.StyleTextToSpeech2Model.from_pretrained(MODEL, {
        dtype: 'fp32',
        device: 'cpu',
        session_options: { intraOpNumThreads: WORK_THREADS, interOpNumThreads: 1 },
        progress_callback,
      }),
      transformers.AutoTokenizer.from_pretrained(MODEL, { progress_callback }),
    ]);
    const tts = new KokoroTTS(voiceModel, tokenizer);
    await tts.generate('Hello there.', { voice: 'af_heart' });
    return tts;
  })();
  model = loading;
  loading.then(
    () => {
      status = 'ready';
      progress = 1;
    },
    (error: unknown) => {
      status = 'failed';
      reason =
        error instanceof Error && /fetch|network|ENOTFOUND|ECONN|ETIMEDOUT/i.test(error.message)
          ? "Couldn't reach Hugging Face to download the voice. Check the connection and try again."
          : "The voice couldn't start on this computer.";
      console.error('Narrator failed to load:', error);
      model = null;
    },
  );
  return loading;
}

export function prepareVoice(): VoiceStatusDto {
  load().catch(() => undefined);
  return voiceStatus();
}

function trimmed(samples: Float32Array, rate: number): Float32Array {
  const floor = 0.008;
  let start = 0;
  let end = samples.length;
  while (start < end && Math.abs(samples[start]!) < floor) start += 1;
  while (end > start && Math.abs(samples[end - 1]!) < floor) end -= 1;
  const margin = Math.round(rate * 0.04);
  return samples.subarray(Math.max(0, start - margin), Math.min(samples.length, end + margin * 2));
}

function wav(samples: Float32Array, rate: number): Buffer {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? Math.min(2.5, 0.82 / peak) : 1;
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + samples.length * 2, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]! * gain));
    out.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return out;
}

function prune() {
  let entries: Array<{ file: string; size: number; time: number }>;
  try {
    entries = fs.readdirSync(config.voiceDir).map((name) => {
      const file = path.join(config.voiceDir, name);
      const stat = fs.statSync(file);
      return { file, size: stat.size, time: stat.mtimeMs };
    });
  } catch {
    return;
  }
  entries.sort((a, b) => b.time - a.time);
  const oldest = Date.now() - KEEP_DAYS * 86_400_000;
  let total = 0;
  for (const entry of entries) {
    total += entry.size;
    if (total > KEEP_BYTES || entry.time < oldest) fs.rmSync(entry.file, { force: true });
  }
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      if (job.listeners <= 0) {
        waiting.delete(job.key);
        job.reject(new HttpError(409, 'Cancelled'));
        continue;
      }
      try {
        const tts = await load();
        const audio = await tts.generate(job.text, {
          voice: job.voice as 'af_heart',
          speed: job.speed,
        });
        const clip = wav(
          trimmed(audio.audio as Float32Array, audio.sampling_rate),
          audio.sampling_rate,
        );
        fs.mkdirSync(config.voiceDir, { recursive: true });
        fs.writeFileSync(path.join(config.voiceDir, `${job.key}.wav`), clip);
        written += 1;
        job.resolve(clip);
      } catch (error) {
        job.reject(error);
      } finally {
        waiting.delete(job.key);
      }
    }
  } finally {
    busy = false;
  }
  if (written >= 40) {
    written = 0;
    prune();
  }
}

export interface VoiceTicket {
  cancel: () => void;
  clip: Promise<Buffer>;
}

export function speakClip(input: { text: string; voice: string; speed: number }): VoiceTicket {
  const speed = Math.round(input.speed * 100) / 100;
  const key = createHash('sha256')
    .update(`kokoro-fp32|${input.voice}|${speed}|${input.text}`)
    .digest('hex')
    .slice(0, 32);
  const file = path.join(config.voiceDir, `${key}.wav`);
  if (fs.existsSync(file)) {
    const now = new Date();
    fs.utimesSync(file, now, now);
    return { cancel: () => undefined, clip: Promise.resolve(fs.readFileSync(file)) };
  }

  let job = waiting.get(key);
  if (job) job.listeners += 1;
  else {
    let resolve: Job['resolve'] = () => undefined;
    let reject: Job['reject'] = () => undefined;
    const clip = new Promise<Buffer>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    clip.catch(() => undefined);
    job = { key, text: input.text, voice: input.voice, speed, listeners: 1, clip, resolve, reject };
    waiting.set(key, job);
    queue.push(job);
    void pump();
  }

  const mine = job;
  let done = false;
  return {
    cancel: () => {
      if (done) return;
      done = true;
      mine.listeners -= 1;
    },
    clip: mine.clip,
  };
}
