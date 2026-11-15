import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function totpSupported(): boolean {
  try {
    createHmac('sha1', 'x').update('y').digest();
    return true;
  } catch {
    return false;
  }
}

export function newSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value >= 0) bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export function checkTotp(secret: string, code: string, at = Date.now()): boolean {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const step = Math.floor(at / 30_000);
  return [-1, 0, 1].some((offset) => codeAt(secret, step + offset) === clean);
}

export function totpUri(secret: string, account: string): string {
  return `otpauth://totp/${encodeURIComponent(`Living Draft:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('Living Draft')}`;
}
