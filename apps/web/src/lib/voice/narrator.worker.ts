import { env } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';
import runtime from 'voice-runtime.wasm?url';

env.backends.onnx.wasm!.wasmPaths = { wasm: new URL(runtime, self.location.href).href };

interface Job {
  id: number;
  text: string;
  voice: string;
  speed: number;
}

type Incoming = { type: 'load' } | ({ type: 'speak' } & Job) | { type: 'drop'; ids: number[] };

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let model: Promise<KokoroTTS> | null = null;
const files = new Map<string, { loaded: number; total: number }>();
const queue: Job[] = [];
let busy = false;

function load(): Promise<KokoroTTS> {
  model ??= KokoroTTS.from_pretrained(MODEL, {
    dtype: 'fp32',
    device: 'webgpu',
    progress_callback: (event: {
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
      self.postMessage({ type: 'progress', loaded, total });
    },
  });
  model.catch(() => {
    model = null;
  });
  return model;
}

function fail(id: number | undefined, error: unknown) {
  self.postMessage({
    type: 'error',
    id,
    message: error instanceof Error ? error.message : String(error),
  });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const tts = await load();
      const audio = await tts.generate(job.text, {
        voice: job.voice as 'af_heart',
        speed: job.speed,
      });
      const samples = audio.audio as Float32Array;
      self.postMessage(
        { type: 'audio', id: job.id, samples, rate: audio.sampling_rate },
        { transfer: [samples.buffer] },
      );
    } catch (error) {
      fail(job.id, error);
    }
  }
  busy = false;
}

self.onmessage = (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'load') {
    load().then(
      () => self.postMessage({ type: 'ready' }),
      (error: unknown) => fail(undefined, error),
    );
  } else if (message.type === 'speak') {
    queue.push(message);
    void pump();
  } else {
    const ids = new Set(message.ids);
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (!ids.has(queue[i]!.id)) continue;
      self.postMessage({ type: 'error', id: queue[i]!.id, message: 'dropped' });
      queue.splice(i, 1);
    }
  }
};
