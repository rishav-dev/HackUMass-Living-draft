import { useQuery } from '@tanstack/react-query';
import type { AiJobDto, AiStatusDto } from '@living-draft/contracts';
import { api } from './client';

export const AI_KEY = ['ai'] as const;

export function useAiStatus() {
  return useQuery({
    queryKey: AI_KEY,
    queryFn: () => api.get<AiStatusDto>('/ai'),
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.status === 'loading' ? 900 : false),
  });
}

export function aiUsable(status: AiStatusDto | undefined): boolean {
  return Boolean(
    status && (status.where === 'remote' || status.downloaded) && status.status !== 'failed',
  );
}

export function understand(body: {
  text: string;
  memoryId?: string;
  answers?: Array<{ question: string; answer: string }>;
  notes?: boolean;
}) {
  return api.post<AiJobDto>('/ai/understand', body);
}

export function useAiJob(id: string | null) {
  return useQuery({
    queryKey: ['ai-job', id],
    queryFn: () => api.get<AiJobDto>(`/ai/jobs/${id}`),
    enabled: Boolean(id),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== 'working' ? false : 1200,
  });
}

export async function runAiTask<T>(path: string, body: unknown): Promise<T> {
  let job = await api.post<AiJobDto>(path, body);
  while (job.status === 'working') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    job = await api.get<AiJobDto>(`/ai/jobs/${job.id}`);
  }
  if (job.status === 'failed') throw new Error(job.error ?? 'That did not work this time.');
  return job.result as T;
}

export async function aiReady(): Promise<boolean> {
  try {
    return aiUsable(await api.get<AiStatusDto>('/ai'));
  } catch {
    return false;
  }
}
