import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SceneSaveResultDto,
  StoryBookDto,
  StoryBookSummaryDto,
} from '@living-draft/contracts';
import type { StoryLinkTypeInfo } from '@living-draft/engine';
import { api } from './client';

export const storyKeys = {
  books: ['stories'] as const,
  book: (id: string) => ['stories', id] as const,
  linkTypes: ['static', 'story-link-types'] as const,
};

export function useStoryBooks() {
  return useQuery({
    queryKey: storyKeys.books,
    queryFn: () => api.get<StoryBookSummaryDto[]>('/stories'),
  });
}

export function useStoryBook(id: string | undefined) {
  return useQuery({
    queryKey: storyKeys.book(id ?? ''),
    queryFn: () => api.get<StoryBookDto>(`/stories/${id}`),
    enabled: !!id,
  });
}

export function useStoryLinkTypes() {
  return useQuery({
    queryKey: storyKeys.linkTypes,
    queryFn: () => api.get<StoryLinkTypeInfo[]>('/stories/link-types'),
    staleTime: Infinity,
  });
}

export function useStoryActions(bookId: string) {
  const client = useQueryClient();
  const base = `/stories/${bookId}`;
  const settle = (book: StoryBookDto) => {
    client.setQueryData(storyKeys.book(bookId), book);
    void client.invalidateQueries({ queryKey: storyKeys.books, exact: true });
    return book;
  };
  const refresh = () => client.invalidateQueries({ queryKey: storyKeys.book(bookId) });

  return {
    updateBook: (patch: Partial<Pick<StoryBookDto, 'title' | 'premise' | 'mood'>>) =>
      api.patch<StoryBookDto>(base, patch).then(settle),
    addChapter: (title: string) =>
      api.post<StoryBookDto>(`${base}/chapters`, { title }).then(settle),
    renameChapter: (id: string, title: string) =>
      api.patch<StoryBookDto>(`${base}/chapters/${id}`, { title }).then(settle),
    deleteChapter: (id: string) => api.delete<StoryBookDto>(`${base}/chapters/${id}`).then(settle),
    saveScene: async (sceneId: string | null, input: Record<string, unknown>) => {
      const result = sceneId
        ? await api.patch<SceneSaveResultDto>(`${base}/scenes/${sceneId}`, input)
        : await api.post<SceneSaveResultDto>(`${base}/scenes`, input);
      await refresh();
      return result;
    },
    tidyScene: async (sceneId: string) => {
      await api.post(`${base}/scenes/${sceneId}/tidy`);
      await refresh();
    },
    restoreScene: async (sceneId: string) => {
      await api.post(`${base}/scenes/${sceneId}/restore`);
      await refresh();
    },
    deleteScene: async (sceneId: string) => {
      await api.delete(`${base}/scenes/${sceneId}`);
      await refresh();
    },
    reorder: (order: { chapters: Array<{ id: string; sceneIds: string[] }>; floating: string[] }) =>
      api.put<StoryBookDto>(`${base}/order`, order).then(settle),
    addCharacter: (input: { name: string; role?: string | null; notes?: string | null }) =>
      api.post<StoryBookDto>(`${base}/characters`, input).then(settle),
    updateCharacter: (
      id: string,
      input: { name?: string; role?: string | null; notes?: string | null },
    ) => api.patch<StoryBookDto>(`${base}/characters/${id}`, input).then(settle),
    deleteCharacter: (id: string) =>
      api.delete<StoryBookDto>(`${base}/characters/${id}`).then(settle),
    addLink: (input: {
      fromSceneId: string;
      toSceneId: string;
      type: string;
      note?: string | null;
    }) => api.post<StoryBookDto>(`${base}/links`, input).then(settle),
    deleteLink: (id: string) => api.delete<StoryBookDto>(`${base}/links/${id}`).then(settle),
    addNote: (input: { title: string; body: string }) =>
      api.post<StoryBookDto>(`${base}/notes`, input).then(settle),
    updateNote: (id: string, input: { title?: string; body?: string }) =>
      api.patch<StoryBookDto>(`${base}/notes/${id}`, input).then(settle),
    deleteNote: (id: string) => api.delete<StoryBookDto>(`${base}/notes/${id}`).then(settle),
  };
}

export type StoryActions = ReturnType<typeof useStoryActions>;
