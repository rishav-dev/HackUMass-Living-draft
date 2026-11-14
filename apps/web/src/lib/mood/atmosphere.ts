import { useEffect, useSyncExternalStore } from 'react';
import { sound, type Presence } from '../sound/engine';
import { blendEmotions, moodBlend, type MoodBlend, type MoodKey } from './moods';

export interface Atmosphere {
  mood: MoodBlend;
  texture: string | null;
  music: boolean;
  dim: number;
  focus: { x: number; y: number } | null;
  seed: number;
  presence: Presence;
  musicMood: MoodKey | null;
}

interface Entry {
  id: number;
  value: Atmosphere;
}

const BASE: Atmosphere = {
  mood: moodBlend('cosmos', 0.6),
  texture: null,
  music: true,
  dim: 0.55,
  focus: null,
  seed: 0,
  presence: 'ambient',
  musicMood: null,
};

let stack: Entry[] = [];
let active: Atmosphere = BASE;
let counter = 0;
const listeners = new Set<() => void>();

function publish() {
  const next = stack[stack.length - 1]?.value ?? BASE;
  active = next;
  sound.setMood(
    next.music ? (next.musicMood ?? next.mood.key) : null,
    next.mood.intensity,
    next.texture,
    next.seed,
    next.presence,
  );
  document.documentElement.style.setProperty('--mood-a', next.mood.palette[1]);
  document.documentElement.style.setProperty('--mood-b', next.mood.palette[2]);
  document.documentElement.style.setProperty('--mood-c', next.mood.palette[2]);
  for (const listener of listeners) listener();
}

export function pushAtmosphere(value: Atmosphere): number {
  counter += 1;
  stack = [...stack, { id: counter, value }];
  publish();
  return counter;
}

export function updateAtmosphere(id: number, value: Atmosphere) {
  stack = stack.map((entry) => (entry.id === id ? { id, value } : entry));
  publish();
}

export function popAtmosphere(id: number) {
  stack = stack.filter((entry) => entry.id !== id);
  publish();
}

export function useActiveAtmosphere(): Atmosphere {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => active,
  );
}

export interface AtmosphereRequest {
  mood?: MoodKey;
  emotions?: Array<{ tag: string; phase?: 'then' | 'now' }>;
  fallback?: MoodKey;
  intensity?: number;
  texture?: string | null;
  music?: boolean;
  dim?: number;
  quiet?: boolean;
  seed?: string | number;
  presence?: Presence;
  musicMood?: MoodKey;
  sky?: MoodBlend['weather'] | null;
}

export function seedFrom(value: string): number {
  let hash = 7;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return (hash % 9973) + 1;
}

export function resolve(request: AtmosphereRequest): Atmosphere {
  const base = request.emotions?.length
    ? blendEmotions(request.emotions, request.fallback)
    : moodBlend(request.mood ?? request.fallback ?? 'cosmos', request.intensity ?? 0.6);
  const mood = request.quiet
    ? {
        ...base,
        energy: Math.min(base.energy, 0.2),
        flicker: 0,
        intensity: Math.min(base.intensity, 0.35),
      }
    : base;
  if (request.intensity !== undefined)
    mood.intensity = request.quiet ? Math.min(request.intensity, 0.35) : request.intensity;
  if (request.sky) mood.weather = request.sky;
  return {
    mood,
    texture: request.texture ?? null,
    music: request.quiet ? false : (request.music ?? true),
    dim: request.dim ?? 0.55,
    focus: null,
    seed: typeof request.seed === 'string' ? seedFrom(request.seed) : (request.seed ?? 0),
    presence: request.presence ?? 'ambient',
    musicMood: request.musicMood ?? null,
  };
}

export function useAtmosphere(request: AtmosphereRequest | null) {
  const key = request ? JSON.stringify(request) : '';
  useEffect(() => {
    if (!request) return;
    const id = pushAtmosphere(resolve(request));
    return () => popAtmosphere(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
