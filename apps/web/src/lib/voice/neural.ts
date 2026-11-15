import { useSyncExternalStore } from 'react';
import type { VoiceStatusDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { readLocal } from '../storage';

export type NarratorState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number; downloading: boolean }
  | { status: 'ready' }
  | { status: 'failed'; reason: string };

export const NARRATOR_VOICES = [
  { id: 'af_heart', name: 'Heart', note: 'warm and close, the most natural' },
  { id: 'af_bella', name: 'Bella', note: 'bright and lively' },
  { id: 'af_nicole', name: 'Nicole', note: 'soft, almost a whisper' },
  { id: 'bf_emma', name: 'Emma', note: 'gentle British' },
  { id: 'bm_fable', name: 'Fable', note: 'British, a storyteller' },
  { id: 'am_michael', name: 'Michael', note: 'calm and low' },
  { id: 'bm_george', name: 'George', note: 'older British' },
] as const;

export const NARRATOR_DOWNLOAD = '330 MB';

export interface VoiceClip {
  samples: Float32Array;
  rate: number;
}

export interface Backend {
  start(): void;
  cached(): Promise<boolean>;
  synthesize(id: number, text: string, voice: string, speed: number): Promise<VoiceClip>;
  drop(ids: number[]): void;
}

let state: NarratorState = { status: 'idle' };
let counter = 0;
const listeners = new Set<() => void>();

export function publish(next: NarratorState) {
  state = next;
  for (const listener of listeners) listener();
}

export function neuralWanted(): boolean {
  return readLocal('narrator-engine') !== 'device';
}

export function neuralVoice(): string {
  return readLocal('narrator-neural-voice') ?? 'af_heart';
}

export function narratorState(): NarratorState {
  return state;
}

export function useNarratorState(): NarratorState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

function fromWav(buffer: ArrayBuffer): VoiceClip {
  const view = new DataView(buffer);
  const rate = view.getUint32(24, true);
  const pcm = new Int16Array(buffer, 44, Math.floor((buffer.byteLength - 44) / 2));
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) samples[i] = pcm[i]! / 32768;
  return { samples, rate };
}

function serverBackend(): Backend {
  const requests = new Map<number, AbortController>();
  let polling = 0;

  const follow = (status: VoiceStatusDto) => {
    window.clearTimeout(polling);
    if (status.status === 'ready') publish({ status: 'ready' });
    else if (status.status === 'failed')
      publish({ status: 'failed', reason: status.reason ?? "The voice couldn't start." });
    else {
      publish({ status: 'loading', progress: status.progress, downloading: !status.downloaded });
      polling = window.setTimeout(() => {
        api
          .get<VoiceStatusDto>('/voice')
          .then(follow, () =>
            publish({ status: 'failed', reason: "The app's server isn't answering." }),
          );
      }, 600);
    }
  };

  return {
    start() {
      api
        .post<VoiceStatusDto>('/voice/prepare')
        .then(follow, () =>
          publish({ status: 'failed', reason: "The app's server isn't answering." }),
        );
    },
    async cached() {
      try {
        return (await api.get<VoiceStatusDto>('/voice')).downloaded;
      } catch {
        return false;
      }
    },
    async synthesize(id, text, voice, speed) {
      const controller = new AbortController();
      requests.set(id, controller);
      try {
        const response = await fetch('/api/voice/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, speed }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Voice request failed (${response.status})`);
        return fromWav(await response.arrayBuffer());
      } finally {
        requests.delete(id);
      }
    },
    drop(ids) {
      for (const id of ids) requests.get(id)?.abort();
    },
  };
}

let chosen: Promise<Backend> | null = null;
const backend = (): Promise<Backend> =>
  (chosen ??=
    import.meta.env.VITE_RUNTIME === 'device'
      ? import('./device-voice').then((m) => m.deviceBackend())
      : Promise.resolve(serverBackend()));
let ready: Promise<void> | null = null;

export function prepareNarrator(): Promise<void> {
  if (state.status === 'ready') return Promise.resolve();
  ready ??= new Promise<void>((resolve, reject) => {
    const check = () => {
      if (state.status === 'ready') {
        listeners.delete(check);
        resolve();
      } else if (state.status === 'failed') {
        listeners.delete(check);
        ready = null;
        reject(new Error(state.reason));
      }
    };
    listeners.add(check);
    publish({
      status: 'loading',
      progress: state.status === 'loading' ? state.progress : 0,
      downloading: state.status === 'loading' && state.downloading,
    });
    backend().then(
      (b) => b.start(),
      () => publish({ status: 'failed', reason: "The voice couldn't start on this device." }),
    );
  });
  return ready;
}

export function synthesize(
  text: string,
  voice: string,
  speed: number,
): { id: number; audio: Promise<VoiceClip> } {
  const id = ++counter;
  return { id, audio: backend().then((b) => b.synthesize(id, text, voice, speed)) };
}

export function dropSynthesis(ids: number[]) {
  if (ids.length) void backend().then((b) => b.drop(ids));
}

export function narratorCached(): Promise<boolean> {
  return backend().then(
    (b) => b.cached(),
    () => false,
  );
}

export function warmNarrator() {
  if (!neuralWanted() || state.status === 'ready' || state.status === 'loading') return;
  void narratorCached().then((cached) => {
    if (cached) prepareNarrator().catch(() => undefined);
  });
}
