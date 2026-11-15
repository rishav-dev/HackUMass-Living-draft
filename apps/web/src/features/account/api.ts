import { useQueryClient } from '@tanstack/react-query';
import type { AuthStatusDto } from '@living-draft/contracts';
import { authKey } from '../../api/auth';
import { api } from '../../api/client';

export function useRefreshAuth() {
  const client = useQueryClient();
  return async () => {
    const status = await api.get<AuthStatusDto>('/auth/status');
    client.setQueryData(authKey, status);
    await client.invalidateQueries({ predicate: (q) => q.queryKey[1] !== 'auth' });
    return status;
  };
}

export const account = {
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    confirm: string;
    remember: boolean;
    twoStep?: boolean;
    replaceSample?: boolean;
    about?: {
      fullName: string | null;
      birthDate: string | null;
      age: number | null;
      sex: string | null;
      gender: string | null;
      pronouns: string | null;
      birthPlace: string | null;
      currentPlace: string | null;
    };
    people?: Array<{ name: string; kind: string; relationship: string; note: string }>;
  }) => api.post<AuthStatusDto>('/auth/signup', input),
  twoStep: (on: boolean, password?: string) =>
    api.post<AuthStatusDto>('/auth/two-step', { on, password }),
  signIn: (input: { email: string; password: string; remember: boolean }) =>
    api.post<{ next: 'done' | 'code' | 'authenticator'; sentTo?: string | null }>(
      '/auth/sign-in',
      input,
    ),
  code: (input: { code: string; trust: boolean }) => api.post('/auth/sign-in/code', input),
  verify: (code: string) => api.post('/auth/verify-email', { code }),
  resend: () => api.post('/auth/verify-email/resend'),
  forgot: (email: string) => api.post('/auth/forgot', { email }),
  reset: (token: string, password: string) => api.post('/auth/reset', { token, password }),
  demo: () => api.post('/auth/demo'),
};
