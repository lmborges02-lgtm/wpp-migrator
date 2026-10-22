import { UserError } from './errors.js';
import 'dotenv/config';
import { resolve } from 'node:path';

function integer(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new UserError(`${name} deve estar entre ${min} e ${max}.`);
  return n;
}
export function config() {
  const minDelay = integer('MIN_DELAY_SECONDS', 30, 30, 86400);
  const maxDelay = integer('MAX_DELAY_SECONDS', 90, minDelay, 86400);
  const zone = process.env.TIME_ZONE ?? 'America/Sao_Paulo';
  new Intl.DateTimeFormat('en', { timeZone: zone }).format();
  const path = (key: string, fallback: string) => resolve(process.env[key] ?? fallback);
  return {
    minDelay, maxDelay, zone, batch: integer('BATCH_SIZE', 1, 1, 3), daily: integer('DAILY_LIMIT', 30, 1, 10000),
    session: path('SESSION_PATH', 'data/session'), db: path('DB_PATH', 'data/state.sqlite'),
    log: path('LOG_PATH', 'data/actions.log'), authorized: path('AUTHORIZED_PATH', 'authorized.csv'),
    blocked: path('BLOCKLIST_PATH', 'blocklist.csv'), members: path('MEMBERS_PATH', 'members.csv'),
    manual: path('MANUAL_INVITES_PATH', 'convite-manual.csv')
  };
}
export type Config = ReturnType<typeof config>;

