import { useSyncExternalStore } from 'react';

export type PlaybackRequest = {
  age?: number;
  memoryId?: string;
  characterId?: string;
  date?: string;
};

let current: PlaybackRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openPlayback(request: PlaybackRequest) {
  current = request;
  emit();
}

export function closePlayback() {
  current = null;
  emit();
}

export function usePlaybackRequest(): PlaybackRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
