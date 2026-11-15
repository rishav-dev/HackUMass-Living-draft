type Next = (error?: unknown) => void;
type Handler = (req: DeviceRequest, res: DeviceResponse, next: Next) => unknown;

interface Layer {
  kind: 'route' | 'use';
  method: string | null;
  pattern: RegExp;
  keys: string[];
  handlers: Array<Handler | RouterFn>;
}

export interface RouterFn {
  (req: DeviceRequest, res: DeviceResponse, next: Next): void;
  stack: Layer[];
  isRouter: true;
  get: (path: string, ...handlers: Handler[]) => RouterFn;
  post: (path: string, ...handlers: Handler[]) => RouterFn;
  patch: (path: string, ...handlers: Handler[]) => RouterFn;
  put: (path: string, ...handlers: Handler[]) => RouterFn;
  delete: (path: string, ...handlers: Handler[]) => RouterFn;
  use: (...args: Array<string | Handler | RouterFn>) => RouterFn;
}

export interface DeviceUpload {
  bytes: Uint8Array;
  name: string;
  type: string;
  size: number;
}

export interface DeviceRequest {
  method: string;
  path: string;
  url: string;
  query: Record<string, string>;
  params: Record<string, string>;
  body: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  upload?: DeviceUpload;
  file?: unknown;
}

export class DeviceResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body: unknown = undefined;
  finished = false;
  cookies: Record<string, string | null> = {};

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(value: unknown) {
    this.body = value;
    this.headers['content-type'] = 'application/json';
    this.finished = true;
    return this;
  }
  send(value: unknown) {
    this.body = value;
    this.finished = true;
    return this;
  }
  end() {
    this.finished = true;
    return this;
  }
  setHeader(name: string, value: string | number) {
    this.headers[name.toLowerCase()] = String(value);
    return this;
  }
  type(value: string) {
    this.headers['content-type'] = value === 'html' ? 'text/html; charset=utf-8' : value;
    return this;
  }
  cookie(name: string, value: string) {
    this.cookies[name] = value;
    return this;
  }
  clearCookie(name: string) {
    this.cookies[name] = null;
    return this;
  }
}

function compile(path: string, prefix: boolean): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .replace(/\/$/, '')
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${source}${prefix ? '(?=/|$)' : '/?$'}`), keys };
}

function call(handler: Handler, req: DeviceRequest, res: DeviceResponse): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let moved = false;
    const next: Next = (error) => {
      if (error) reject(error);
      else {
        moved = true;
        resolve(true);
      }
    };
    try {
      Promise.resolve(handler(req, res, next)).then(() => {
        if (!moved) resolve(false);
      }, reject);
    } catch (error) {
      reject(error);
    }
  });
}

export async function dispatch(
  stack: Layer[],
  req: DeviceRequest,
  res: DeviceResponse,
  path: string,
): Promise<boolean> {
  for (const layer of stack) {
    if (res.finished) return true;
    if (layer.method && layer.method !== req.method) continue;
    const match = layer.pattern.exec(path);
    if (!match) continue;
    if (layer.kind === 'route') {
      req.params = Object.fromEntries(
        layer.keys.map((key, i) => [key, decodeURIComponent(match[i + 1]!)]),
      );
      for (const handler of layer.handlers) {
        if (!(await call(handler as Handler, req, res))) return true;
      }
      continue;
    }
    const rest = path.slice(match[0].length) || '/';
    for (const handler of layer.handlers) {
      if ((handler as RouterFn).isRouter) {
        const saved = req.path;
        req.path = rest;
        const handled = await dispatch((handler as RouterFn).stack, req, res, rest);
        req.path = saved;
        if (handled) return true;
      } else if (!(await call(handler as Handler, req, res))) return true;
    }
  }
  return res.finished;
}

export function Router(): RouterFn {
  const stack: Layer[] = [];
  const router = ((req: DeviceRequest, res: DeviceResponse, next: Next) => {
    void dispatch(stack, req, res, req.path).then(
      (handled) => (handled ? undefined : next()),
      next,
    );
  }) as RouterFn;
  router.stack = stack;
  router.isRouter = true;
  const route =
    (method: string) =>
    (path: string, ...handlers: Handler[]) => {
      stack.push({ kind: 'route', method, ...compile(path, false), handlers });
      return router;
    };
  router.get = route('GET');
  router.post = route('POST');
  router.patch = route('PATCH');
  router.put = route('PUT');
  router.delete = route('DELETE');
  router.use = (...args: Array<string | Handler | RouterFn>) => {
    const path = typeof args[0] === 'string' ? (args.shift() as string) : '/';
    stack.push({
      kind: 'use',
      method: null,
      ...compile(path === '/' ? '' : path, true),
      handlers: args as Array<Handler | RouterFn>,
    });
    return router;
  };
  return router;
}

function express() {
  throw new Error('The full Express app is not available on this device');
}
express.Router = Router;
express.json = () => (_req: unknown, _res: unknown, next: Next) => next();
express.static = () => (_req: unknown, _res: unknown, next: Next) => next();

export default express;
export type Request = DeviceRequest;
export type Response = DeviceResponse;
export type RequestHandler = Handler;
export type ErrorRequestHandler = (
  error: unknown,
  req: DeviceRequest,
  res: DeviceResponse,
  next: Next,
) => void;
