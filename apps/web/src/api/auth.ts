import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthStatusDto } from '@living-draft/contracts';
import { api } from './client';

export const authKey = ['static', 'auth'] as const;

export function useAuthStatus() {
  return useQuery({
    queryKey: authKey,
    queryFn: () => api.get<AuthStatusDto>('/auth/status'),
    staleTime: Infinity,
    retry: 1,
  });
}

function useAuthMutation<I>(path: string, options: { wipe?: boolean } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => api.post<AuthStatusDto>(path, input),
    onSuccess: (status) => {
      if (options.wipe) client.removeQueries({ predicate: (q) => q.queryKey[1] !== 'auth' });
      client.setQueryData(authKey, status);
      if (!options.wipe)
        void client.invalidateQueries({ predicate: (q) => q.queryKey[1] !== 'auth' });
    },
  });
}

export const useUnlock = () => useAuthMutation<{ passphrase: string }>('/auth/login');
export const useSetPassphrase = () => useAuthMutation<{ passphrase: string }>('/auth/setup');
export const useChangePassphrase = () =>
  useAuthMutation<{ current: string; next: string }>('/auth/change');
export const useEndOtherSessions = () => useAuthMutation<void>('/auth/sessions/end-others');
export const useLock = () => useAuthMutation<void>('/auth/logout', { wipe: true });
