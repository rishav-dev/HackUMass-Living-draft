import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { readFile, writeFile } from '../vfs';

export type SQLInputValue = string | number | null | Uint8Array;

let engine: SqlJsStatic | null = null;
const open = new Set<DatabaseSync>();

export function useSqlEngine(sql: SqlJsStatic) {
  engine = sql;
}

export function saveAllDatabases() {
  for (const db of open) db.save();
}

class StatementSync {
  constructor(
    private readonly owner: DatabaseSync,
    private readonly sql: string,
  ) {}

  private withStatement<T>(
    params: SQLInputValue[],
    work: (statement: ReturnType<Database['prepare']>) => T,
  ): T {
    const statement = this.owner.raw.prepare(this.sql);
    try {
      if (params.length) statement.bind(params as SqlValue[]);
      return work(statement);
    } finally {
      statement.free();
    }
  }

  all(...params: SQLInputValue[]): Record<string, SqlValue>[] {
    return this.withStatement(params, (statement) => {
      const rows: Record<string, SqlValue>[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    });
  }

  get(...params: SQLInputValue[]): Record<string, SqlValue> | undefined {
    return this.withStatement(params, (statement) =>
      statement.step() ? statement.getAsObject() : undefined,
    );
  }

  run(...params: SQLInputValue[]) {
    this.withStatement(params, (statement) => {
      statement.step();
    });
    this.owner.touched();
    return { changes: this.owner.raw.getRowsModified(), lastInsertRowid: 0 };
  }
}

export class DatabaseSync {
  readonly raw: Database;
  private timer = 0;

  constructor(private readonly file: string) {
    if (!engine) throw new Error('SQLite is not ready yet');
    const existing = file === ':memory:' ? undefined : readFile(file);
    this.raw = existing ? new engine.Database(existing) : new engine.Database();
    open.add(this);
  }

  exec(sql: string) {
    this.raw.exec(sql);
    if (!/^\s*(SELECT|PRAGMA)/i.test(sql)) this.touched();
  }

  prepare(sql: string) {
    return new StatementSync(this, sql);
  }

  touched() {
    if (this.file === ':memory:') return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.save(), 350);
  }

  save() {
    if (this.file === ':memory:') return;
    window.clearTimeout(this.timer);
    writeFile(this.file, this.raw.export());
    this.raw.exec('PRAGMA foreign_keys = ON');
  }

  close() {
    this.save();
    this.raw.close();
    open.delete(this);
  }
}
