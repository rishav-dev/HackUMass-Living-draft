import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ArtStatusDto } from '@living-draft/contracts';
import { api } from './client';

export const artKeys = {
  status: ['art', 'status'] as const,
  urls: (keys: string[]) => ['art', 'urls', keys.join(',')] as const,
};

export type ArtReply =
  | { url: string }
  | { url: null; reason: 'disabled' | 'quota' | 'failed' | 'missing' | 'queued' | 'declined' };

const requested = new Set<string>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function resetArtRequests() {
  requested.clear();
}

export function useArtStatus() {
  return useQuery({
    queryKey: artKeys.status,
    queryFn: () => api.get<ArtStatusDto>('/art/status'),
    refetchInterval: (query) => ((query.state.data?.queued ?? 0) > 0 ? 8000 : false),
  });
}

export async function repaintArt(key: string, client: QueryClient): Promise<ArtReply> {
  const reply = await api.post<ArtReply>('/art/generate', { key, fresh: true });
  requested.add(key);
  if (reply.url === null && reply.reason === 'queued') waiting.add(key);
  notify();
  await client.invalidateQueries({ queryKey: ['art'] });
  return reply;
}

export async function declineArt(key: string, client: QueryClient) {
  await api.delete(`/art/${encodeURIComponent(key)}`);
  requested.add(key);
  waiting.delete(key);
  notify();
  await client.invalidateQueries({ queryKey: ['art'] });
}

export function useArt(keys: string[], options: { generate?: boolean } = {}) {
  const client = useQueryClient();
  const sorted = [...new Set(keys)].sort();
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const result = useQuery({
    queryKey: artKeys.urls(sorted),
    queryFn: () =>
      api.get<Record<string, string>>(`/art?keys=${encodeURIComponent(sorted.join(','))}`),
    enabled: sorted.length > 0,
    staleTime: 60_000,
    refetchInterval: (query) =>
      sorted.some((key) => waiting.has(key) && !query.state.data?.[key]) ? 12_000 : false,
  });

  const found = result.data;
  useEffect(() => {
    if (!found) return;
    for (const key of sorted) if (found[key]) waiting.delete(key);
    if (!options.generate) return;
    const missing = sorted.filter((key) => !found[key] && !requested.has(key));
    if (!missing.length) return;
    let cancelled = false;
    void (async () => {
      for (const key of missing) {
        if (cancelled) return;
        requested.add(key);
        const reply = await api.post<ArtReply>('/art/generate', { key }).catch(() => null);
        if (!reply) continue;
        if (reply.url !== null) {
          void client.invalidateQueries({ queryKey: ['art'] });
        } else if (reply.reason === 'queued') {
          waiting.add(key);
          notify();
          void client.invalidateQueries({ queryKey: artKeys.status });
        } else if (reply.reason !== 'declined') {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.generate, found, sorted.join(',')]);

  return found ?? {};
}

export function isWaitingForArt(key: string): boolean {
  return waiting.has(key);
}
