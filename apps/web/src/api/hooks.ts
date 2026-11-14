import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnswerDto,
  CapsuleDto,
  ChapterDto,
  CharacterDetailDto,
  CharacterDto,
  ComparisonDto,
  ConnectionDto,
  DayDto,
  LifePathDto,
  MapDto,
  MemoryCardDto,
  MemoryDetailDto,
  MilestoneDto,
  PlaybackDto,
  ProfileDto,
  PromptDto,
  ReflectionDto,
  SavedAnalysisDto,
  VersionComparisonDto,
} from '@living-draft/contracts';
import type { ConnectionTypeInfo, EvaluationReport } from '@living-draft/engine';
import { useAuthStatus } from './auth';
import { api, query } from './client';

export const keys = {
  profile: ['profile'] as const,
  lifePath: ['life-path'] as const,
  chapter: (age: number) => ['chapter', age] as const,
  memory: (id: string) => ['memory', id] as const,
  memories: (params: object) => ['memories', params] as const,
  characters: ['characters'] as const,
  character: (id: string) => ['character', id] as const,
  connections: (status?: string) => ['connections', status ?? 'active'] as const,
  map: (params: object) => ['map', params] as const,
  milestones: ['milestones'] as const,
  capsules: ['capsules'] as const,
  reflections: ['reflections'] as const,
  analyses: ['analyses'] as const,
  days: ['days'] as const,
  chapterNotes: ['chapter-notes'] as const,
};

export function useInvalidateArchive() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== 'profile' && q.queryKey[0] !== 'static',
    });
}

export function useProfile() {
  const { data: auth } = useAuthStatus();
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => api.get<{ profile: ProfileDto | null }>('/profile').then((r) => r.profile),
    staleTime: Infinity,
    enabled: Boolean(auth && (!auth.configured || auth.authenticated)),
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: Partial<ProfileDto>) => api.patch<ProfileDto>('/profile', update),
    onSuccess: (profile) => {
      client.setQueryData(keys.profile, profile);
      client.invalidateQueries({ queryKey: keys.lifePath });
    },
  });
}

export function useLifePath() {
  return useQuery({ queryKey: keys.lifePath, queryFn: () => api.get<LifePathDto>('/life-path') });
}

export function useChapter(age: number) {
  return useQuery({
    queryKey: keys.chapter(age),
    queryFn: () => api.get<ChapterDto>(`/chapters/${age}`),
  });
}

export function useMemory(id: string | undefined) {
  return useQuery({
    queryKey: keys.memory(id ?? ''),
    queryFn: () => api.get<MemoryDetailDto>(`/memories/${id}`),
    enabled: !!id,
  });
}

export interface MemorySearch {
  q?: string;
  emotions?: string;
  emotionMode?: 'any' | 'all';
  characterId?: string;
  role?: string;
  ageMin?: number;
  ageMax?: number;
  season?: string;
  media?: string;
  certainty?: string;
  connection?: string;
  milestoneId?: string;
  collection?: string;
}

export function useMemories(params: MemorySearch = {}) {
  return useQuery({
    queryKey: keys.memories(params),
    queryFn: () => api.get<MemoryCardDto[]>(`/memories${query({ ...params })}`),
    placeholderData: (previous) => previous,
  });
}

export function useCharacters() {
  return useQuery({
    queryKey: keys.characters,
    queryFn: () => api.get<CharacterDto[]>('/characters'),
  });
}

export function useCharacter(id: string | undefined) {
  return useQuery({
    queryKey: keys.character(id ?? ''),
    queryFn: () => api.get<CharacterDetailDto>(`/characters/${id}`),
    enabled: !!id,
  });
}

export function useConnections(status?: string) {
  return useQuery({
    queryKey: keys.connections(status),
    queryFn: () => api.get<ConnectionDto[]>(`/connections${query({ status })}`),
  });
}

export function useConnectionTypes() {
  return useQuery({
    queryKey: ['static', 'connection-types'],
    queryFn: () => api.get<ConnectionTypeInfo[]>('/connections/types'),
    staleTime: Infinity,
  });
}

export function useMap(params: {
  characterId?: string;
  ageMin?: number;
  ageMax?: number;
  emotion?: string;
  suggested?: boolean;
  characters?: boolean;
}) {
  return useQuery({
    queryKey: keys.map(params),
    queryFn: () => api.get<MapDto>(`/map${query(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useMilestones() {
  return useQuery({
    queryKey: keys.milestones,
    queryFn: () => api.get<MilestoneDto[]>('/milestones'),
  });
}

export function useCapsules() {
  return useQuery({ queryKey: keys.capsules, queryFn: () => api.get<CapsuleDto[]>('/capsules') });
}

export function useReflections() {
  return useQuery({
    queryKey: keys.reflections,
    queryFn: () => api.get<ReflectionDto[]>('/reflections'),
  });
}

export function useAnalyses() {
  return useQuery({
    queryKey: keys.analyses,
    queryFn: () => api.get<SavedAnalysisDto[]>('/analyses'),
  });
}

export function usePrompts(group?: string, count = 3) {
  return useQuery({
    queryKey: ['prompts', group, count],
    queryFn: () => api.get<PromptDto[]>(`/prompts${query({ group, count })}`),
    staleTime: Infinity,
  });
}

export function useCuratedQuestions() {
  return useQuery({
    queryKey: ['static', 'questions'],
    queryFn: () => api.get<string[]>('/ask/questions'),
    staleTime: Infinity,
  });
}

export function useCompareQuestions() {
  return useQuery({
    queryKey: ['static', 'compare-questions'],
    queryFn: () => api.get<string[]>('/compare/questions'),
    staleTime: Infinity,
  });
}

export function useEvaluation() {
  return useQuery({
    queryKey: ['static', 'evaluation'],
    queryFn: () => api.get<EvaluationReport>('/evaluation'),
    staleTime: Infinity,
  });
}

export function usePlayback(
  params: { age?: number; memoryId?: string; characterId?: string; date?: string } | null,
) {
  return useQuery({
    queryKey: ['playback', params],
    queryFn: () => api.get<PlaybackDto>(`/playback${query(params ?? {})}`),
    enabled: !!params,
  });
}

export function useVersionComparison(memoryId: string, a: string | null, b: string | null) {
  return useQuery({
    queryKey: ['compare-versions', memoryId, a, b],
    queryFn: () => api.get<VersionComparisonDto>(`/memories/${memoryId}/compare${query({ a, b })}`),
    enabled: !!a && !!b && a !== b,
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: (input: { question: string; scope: object }) => api.post<AnswerDto>('/ask', input),
  });
}

export function useCompare() {
  return useMutation({
    mutationFn: (input: { memoryIds: string[]; question?: string }) =>
      api.post<ComparisonDto>('/compare', input),
  });
}

export function useDays() {
  return useQuery({
    queryKey: keys.days,
    queryFn: () => api.get<DayDto[]>('/days'),
  });
}
