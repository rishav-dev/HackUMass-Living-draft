import { Buffer } from 'buffer';
import { hasFile, listFiles, readFile, removeFile, writeFile } from '../vfs';

const migrations = import.meta.glob('../../../../server/src/db/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MIGRATIONS = new Map(
  Object.entries(migrations).map(([key, sql]) => [key.split('/').pop()!, sql]),
);

function migration(path: string): string | undefined {
  const match = /\/migrations\/([^/]+\.sql)$/.exec(path);
  return match ? MIGRATIONS.get(match[1]!) : undefined;
}

const fs = {
  existsSync(path: string): boolean {
    return (
      hasFile(path) ||
      listFiles(`${path.replace(/\/$/, '')}/`).length > 0 ||
      /\/migrations\/?$/.test(path)
    );
  },
  mkdirSync(): void {},
  readdirSync(path: string): string[] {
    if (/\/migrations\/?$/.test(path)) return [...MIGRATIONS.keys()];
    const prefix = `${path.replace(/\/$/, '')}/`;
    return listFiles(prefix).map((key) => key.slice(prefix.length).split('/')[0]!);
  },
  readFileSync(path: string, encoding?: string | { encoding?: string }) {
    const sql = migration(path);
    const enc = typeof encoding === 'string' ? encoding : encoding?.encoding;
    if (sql !== undefined) return enc ? sql : Buffer.from(sql, 'utf8');
    const data = readFile(path);
    if (!data) {
      const error = new Error(`ENOENT: no such file, open '${path}'`) as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    }
    return enc ? new TextDecoder().decode(data) : Buffer.from(data);
  },
  writeFileSync(path: string, data: string | Uint8Array) {
    writeFile(
      path,
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data),
    );
  },
  rmSync(path: string, options: { recursive?: boolean; force?: boolean } = {}) {
    if (hasFile(path)) removeFile(path);
    if (options.recursive)
      for (const key of listFiles(`${path.replace(/\/$/, '')}/`)) removeFile(key);
  },
  statSync(path: string) {
    const data = readFile(path);
    if (!data) throw new Error(`ENOENT: no such file, stat '${path}'`);
    return { size: data.byteLength, isFile: () => true, isDirectory: () => false };
  },
};

export default fs;
export const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } =
  fs;
