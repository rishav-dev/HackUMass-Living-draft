import { narratorState, publish, type Backend, type VoiceClip } from './neural';

async function cached(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const stored = await (await caches.open('transformers-cache')).keys();
    return stored.some((request) => /Kokoro-82M.*\/onnx\/model\.onnx$/.test(request.url));
  } catch {
    return false;
  }
}

export function deviceBackend(): Backend {
  let worker: Worker | null = null;
  let downloading = false;
  const pending = new Map<
    number,
    { resolve: (value: VoiceClip) => void; reject: (error: Error) => void }
  >();

  const ensure = (): Worker => {
    if (worker) return worker;
    const w = new Worker(new URL('./narrator.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: 'progress'; loaded: number; total: number }
        | { type: 'ready' }
        | { type: 'audio'; id: number; samples: Float32Array; rate: number }
        | { type: 'error'; id?: number; message: string };
      if (data.type === 'progress') {
        if (narratorState().status !== 'ready')
          publish({
            status: 'loading',
            progress: data.total ? data.loaded / data.total : 0,
            downloading,
          });
      } else if (data.type === 'ready') publish({ status: 'ready' });
      else if (data.type === 'audio') {
        pending.get(data.id)?.resolve({ samples: data.samples, rate: data.rate });
        pending.delete(data.id);
      } else if (data.id !== undefined) {
        pending.get(data.id)?.reject(new Error(data.message));
        pending.delete(data.id);
      } else publish({ status: 'failed', reason: "The voice couldn't start on this device." });
    };
    w.onerror = () =>
      publish({ status: 'failed', reason: "The voice couldn't start on this device." });
    worker = w;
    return w;
  };

  return {
    start() {
      void (async () => {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
        const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
        if (!adapter) {
          publish({
            status: 'failed',
            reason: "This device doesn't have the graphics support the natural voice needs.",
          });
          return;
        }
        downloading = !(await cached());
        ensure().postMessage({ type: 'load' });
      })();
    },
    cached,
    synthesize(id, text, voice, speed) {
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ensure().postMessage({ type: 'speak', id, text, voice, speed });
      });
    },
    drop(ids) {
      if (worker && ids.length) worker.postMessage({ type: 'drop', ids });
    },
  };
}
