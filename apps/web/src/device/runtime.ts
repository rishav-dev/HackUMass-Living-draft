import './globals';
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  dispatch,
  DeviceResponse,
  type DeviceRequest,
  type DeviceUpload,
  type RouterFn,
} from './shims/express';
import { saveAllDatabases, useSqlEngine } from './shims/sqlite';
import { loadFiles, readFile, settle } from './vfs';

interface Runtime {
  router: RouterFn;
  mediaDir: string;
  isHttpError: (error: unknown) => error is { status: number; message: string; details?: unknown };
}

const COOKIE_KEY = 'living-draft:device-cookies';
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

let booting: Promise<Runtime> | null = null;
const objectUrls = new Map<string, string>();

function cookies(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(COOKIE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCookies(changes: Record<string, string | null>) {
  if (!Object.keys(changes).length) return;
  const jar = cookies();
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) delete jar[name];
    else jar[name] = value;
  }
  try {
    sessionStorage.setItem(COOKIE_KEY, JSON.stringify(jar));
  } catch {
    return;
  }
}

export function bootDevice(): Promise<Runtime> {
  booting ??= (async () => {
    const [SQL] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), loadFiles()]);
    useSqlEngine(SQL);
    const [
      { config },
      { openDatabase },
      { apiRouter },
      { deleteStalePending },
      { HttpError },
      { withHosted },
      { noRunner, useAiRunner },
    ] = await Promise.all([
      import('../../../server/src/config'),
      import('../../../server/src/db/database'),
      import('../../../server/src/modules/routes'),
      import('../../../server/src/modules/media/media.repository'),
      import('../../../server/src/lib/http'),
      import('../../../server/src/modules/ai/hosted'),
      import('../../../server/src/modules/ai/runner'),
    ]);
    openDatabase(config.databaseFile);
    useAiRunner(withHosted(noRunner));
    deleteStalePending();
    window.addEventListener('pagehide', () => {
      saveAllDatabases();
      void settle();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveAllDatabases();
        void settle();
      }
    });
    return {
      router: apiRouter() as unknown as RouterFn,
      mediaDir: config.mediaDir,
      isHttpError: (
        error: unknown,
      ): error is { status: number; message: string; details?: unknown } =>
        error instanceof HttpError,
    };
  })();
  return booting;
}

function mediaUrl(mediaDir: string, name: string): string | null {
  const cached = objectUrls.get(name);
  if (cached) return cached;
  const data = readFile(`${mediaDir}/${name}`);
  if (!data) return null;
  const type = MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([data.slice()], { type }));
  objectUrls.set(name, url);
  return url;
}

function resolveMedia(value: unknown, mediaDir: string): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith('/media/')) return value;
    return mediaUrl(mediaDir, decodeURIComponent(value.slice(7))) ?? value;
  }
  if (Array.isArray(value)) return value.map((item) => resolveMedia(item, mediaDir));
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveMedia(item, mediaDir)]),
    );
  }
  return value;
}

export interface DeviceReply {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export async function deviceRequest(
  method: string,
  url: string,
  body?: unknown,
  upload?: DeviceUpload,
): Promise<DeviceReply> {
  const runtime = await bootDevice();
  const [path = '/', search = ''] = url.split('?');
  const jar = cookies();
  const req: DeviceRequest = {
    method,
    path,
    url,
    query: Object.fromEntries(new URLSearchParams(search)),
    params: {},
    body: (body as Record<string, unknown>) ?? {},
    headers: {
      cookie: Object.entries(jar)
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join('; '),
    },
    upload,
  };
  const res = new DeviceResponse();
  try {
    const handled = await dispatch(runtime.router.stack, req, res, path);
    if (!handled) res.status(404).json({ error: 'No such endpoint' });
  } catch (error) {
    if (runtime.isHttpError(error))
      res.status(error.status).json({ error: error.message, details: error.details });
    else if (error instanceof Error && error.name === 'MulterError')
      res.status(/large/i.test(error.message) ? 413 : 400).json({ error: error.message });
    else {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong on this device' });
    }
  }
  saveCookies(res.cookies);
  return {
    status: res.statusCode,
    headers: res.headers,
    body: resolveMedia(res.body, runtime.mediaDir),
  };
}

export async function importArchiveBytes(bytes: Uint8Array): Promise<number> {
  await bootDevice();
  const { importArchive } = await import('../../../server/src/modules/archive/archive.service');
  const result = importArchive(bytes);
  saveAllDatabases();
  await settle();
  return result.memories;
}
