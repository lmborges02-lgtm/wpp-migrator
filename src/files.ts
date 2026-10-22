import { UserError } from './errors.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizePhone } from './policy.js';

// Authorization files deliberately have one column. Ambiguous or malformed input fails closed.
export function readNumbers(path: string): Set<string> {
  const rows = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const result = new Set<string>();
  rows.forEach((row, i) => {
    const value = row.trim();
    if (!value || (i === 0 && /^(numero|número|phone)$/i.test(value))) return;
    try { result.add(normalizePhone(value)); }
    catch { throw new UserError(`CSV inválido em ${path}, linha ${i + 1}. Use uma coluna E.164.`); }
  });
  return result;
}

export function writeCsv(path: string, rows: string[][]): void {
  const cell = (s: string) => '"' + (/^[=+@-]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
  writeFileSync(path, '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n', { mode: 0o600 });
}

