import { Buffer } from 'buffer';

const toString = Buffer.prototype.toString;
Buffer.prototype.toString = function patched(
  this: Buffer,
  encoding?: string,
  start?: number,
  end?: number,
) {
  if (encoding === 'base64url')
    return toString
      .call(this, 'base64', start, end)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return toString.call(this, encoding as BufferEncoding, start, end);
} as typeof Buffer.prototype.toString;

const scope = globalThis as unknown as {
  Buffer?: typeof Buffer;
  process?: { env: Record<string, string> };
};
scope.Buffer ??= Buffer;
scope.process ??= { env: {} };
scope.process.env.LIVING_DRAFT_DATA_DIR = '/data';
