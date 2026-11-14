import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

let current: DatabaseSync | null = null;

export type Param = string | number | boolean | null | undefined;

function bind(params: Param[]): SQLInputValue[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  current = db;
  return db;
}

export function closeDatabase() {
  current?.close();
  current = null;
}

export function db(): DatabaseSync {
  if (!current) throw new Error('Database has not been opened');
  return current;
}

function migrate(database: DatabaseSync) {
  database.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const applied = new Set(
    (
      database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>
    ).map((r) => r.version),
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    database.exec('BEGIN');
    try {
      database.exec(sql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return db()
    .prepare(sql)
    .all(...bind(params)) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  return db()
    .prepare(sql)
    .get(...bind(params)) as T | undefined;
}

export function run(sql: string, ...params: Param[]) {
  return db()
    .prepare(sql)
    .run(...bind(params));
}

let depth = 0;

export function transaction<T>(work: () => T): T {
  if (depth > 0) return work();
  depth += 1;
  db().exec('BEGIN');
  try {
    const result = work();
    db().exec('COMMIT');
    return result;
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  } finally {
    depth -= 1;
  }
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
