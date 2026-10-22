import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { withinDailyLimit } from './policy.js';

export type Action = 'add' | 'invite';
export class Store {
  private db: Database.Database | undefined;
  constructor(path: string, readonly = false) {
    if (readonly && !existsSync(path)) return;
    if (!readonly) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path, { readonly });
    this.db.pragma('busy_timeout = 5000');
    if (!readonly) this.db.exec(`CREATE TABLE IF NOT EXISTS attempts (
      dest TEXT NOT NULL, phone TEXT NOT NULL, action TEXT NOT NULL,
      day TEXT NOT NULL, status TEXT NOT NULL, at TEXT NOT NULL,
      PRIMARY KEY(dest, phone, action));`);
  }
  seen(dest: string, phone: string, action: Action): boolean {
    return !!this.db?.prepare('SELECT 1 FROM attempts WHERE dest=? AND phone=? AND action=?').get(dest, phone, action);
  }
  used(day: string): number {
    return (this.db?.prepare('SELECT count(*) AS n FROM attempts WHERE day=?').get(day) as { n: number } | undefined)?.n ?? 0;
  }
  reserve(dest: string, phone: string, action: Action, day: string, limit: number): boolean {
    if (!this.db) throw new Error('Banco somente leitura.');
    return this.db.transaction(() => {
      if (this.seen(dest, phone, action) || !withinDailyLimit(this.used(day), limit)) return false;
      this.db!.prepare('INSERT INTO attempts VALUES (?,?,?,?,?,?)').run(dest, phone, action, day, 'pending', new Date().toISOString());
      return true;
    }).immediate();
  }
  finish(dest: string, phone: string, action: Action, status: string) {
    this.db!.prepare('UPDATE attempts SET status=? WHERE dest=? AND phone=? AND action=?').run(status, dest, phone, action);
  }
  manual(dest: string): { phone: string; status: string }[] {
    return (this.db?.prepare("SELECT phone,status FROM attempts WHERE dest=? AND action='add' AND status <> 'added'").all(dest) ?? []) as { phone: string; status: string }[];
  }
  close() { this.db?.close(); }
}
