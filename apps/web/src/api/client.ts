export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const ON_DEVICE = import.meta.env.VITE_RUNTIME === 'device';

let lockedHandler: (() => void) | null = null;

export function onLocked(handler: () => void) {
  lockedHandler = handler;
}

function noticeLock(status: number, path: string) {
  if (status === 401 && !path.startsWith('/auth/')) lockedHandler?.();
}

async function onDevice(
  method: string,
  path: string,
  body?: unknown,
  upload?: Blob & { name?: string },
) {
  const { deviceRequest } = await import('../device/runtime');
  const file = upload
    ? {
        bytes: new Uint8Array(await upload.arrayBuffer()),
        name: upload.name ?? 'upload',
        type: upload.type || 'application/octet-stream',
        size: upload.size,
      }
    : undefined;
  return deviceRequest(method, path, body, file);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (ON_DEVICE) {
    const reply = await onDevice(method, path, body);
    if (reply.status === 204) return undefined as T;
    if (reply.status >= 400) {
      noticeLock(reply.status, path);
      const error = reply.body as { error?: string; details?: unknown } | null;
      throw new ApiError(reply.status, error?.error ?? 'Something went wrong', error?.details);
    }
    return reply.body as T;
  }
  const response = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    noticeLock(response.status, path);
    throw new ApiError(response.status, data?.error ?? response.statusText, data?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export function query(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function uploadMedia(
  file: Blob,
  options: { name?: string; caption?: string; durationMs?: number; kind?: string } = {},
): Promise<import('@living-draft/contracts').MediaDto> {
  if (ON_DEVICE) {
    const named = Object.assign(file, {
      name: options.name ?? (file instanceof File ? file.name : 'recording'),
    });
    const fields: Record<string, string> = {};
    if (options.caption) fields.caption = options.caption;
    if (options.durationMs) fields.durationMs = String(Math.round(options.durationMs));
    if (options.kind) fields.kind = options.kind;
    const reply = await onDevice('POST', '/media', fields, named);
    if (reply.status >= 400) {
      noticeLock(reply.status, '/media');
      throw new ApiError(
        reply.status,
        (reply.body as { error?: string })?.error ?? 'Upload failed',
      );
    }
    return reply.body as import('@living-draft/contracts').MediaDto;
  }
  const form = new FormData();
  form.append('file', file, options.name ?? (file instanceof File ? file.name : 'recording'));
  if (options.caption) form.append('caption', options.caption);
  if (options.durationMs) form.append('durationMs', String(Math.round(options.durationMs)));
  if (options.kind) form.append('kind', options.kind);
  const response = await fetch('/api/media', { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) {
    noticeLock(response.status, '/media');
    throw new ApiError(response.status, data?.error ?? 'Upload failed');
  }
  return data;
}

export async function downloadFromApi(path: string, fallbackName: string) {
  let blob: Blob;
  let name: string;
  if (ON_DEVICE) {
    const reply = await onDevice('GET', path);
    if (reply.status >= 400) throw new ApiError(reply.status, 'Download failed');
    const disposition = reply.headers['content-disposition'] ?? '';
    name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const data = reply.body as Uint8Array | string;
    blob = new Blob([typeof data === 'string' ? data : data.slice()], {
      type: reply.headers['content-type'] ?? 'application/octet-stream',
    });
  } else {
    const response = await fetch(`/api${path}`);
    if (!response.ok) throw new ApiError(response.status, 'Download failed');
    name =
      /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
      fallbackName;
    blob = await response.blob();
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
