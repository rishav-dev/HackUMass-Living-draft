import { Buffer } from 'buffer';
import { scrypt } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';

type Input = string | Uint8Array;

const bytes = (value: Input) =>
  typeof value === 'string' ? new TextEncoder().encode(value) : value;

export function randomUUID(): string {
  return crypto.randomUUID();
}

export function randomBytes(size: number): Buffer {
  const out = new Uint8Array(size);
  crypto.getRandomValues(out);
  return Buffer.from(out);
}

export function scryptSync(
  password: Input,
  salt: Input,
  keylen: number,
  options: { N?: number; r?: number; p?: number } = {},
): Buffer {
  return Buffer.from(
    scrypt(bytes(password), bytes(salt), {
      N: options.N ?? 16384,
      r: options.r ?? 8,
      p: options.p ?? 1,
      dkLen: keylen,
    }),
  );
}

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Unsupported hash ${algorithm}`);
  const chunks: Uint8Array[] = [];
  const hash = {
    update(value: Input) {
      chunks.push(bytes(value));
      return hash;
    },
    digest(encoding?: 'hex' | 'base64') {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const joined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      const result = Buffer.from(sha256(joined));
      return encoding ? result.toString(encoding) : result;
    },
  };
  return hash;
}

export function createHmac(algorithm: string, key: Input) {
  const hash = algorithm === 'sha1' ? sha1 : algorithm === 'sha256' ? sha256 : null;
  if (!hash) throw new Error(`Unsupported hmac ${algorithm}`);
  const chunks: Uint8Array[] = [];
  const mac = {
    update(value: Input) {
      chunks.push(bytes(value));
      return mac;
    },
    digest(encoding?: 'hex' | 'base64') {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const joined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      const result = Buffer.from(hmac(hash, bytes(key), joined));
      return encoding ? result.toString(encoding) : result;
    },
  };
  return mac;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length');
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export default { randomUUID, randomBytes, scryptSync, createHash, createHmac, timingSafeEqual };
