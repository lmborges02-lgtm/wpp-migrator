import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readNumbers } from '../src/files.js';

test('CSV aceita BOM e cabeçalho; deduplica e rejeita conteúdo ambíguo', () => {
  const dir = mkdtempSync(join(tmpdir(),'wa-csv-'));
  const path = join(dir,'numbers.csv');
  try {
    writeFileSync(path, '\uFEFFnumero\r\n+55 (21) 99999-9999\r\n5521999999999\r\n');
    assert.deepEqual([...readNumbers(path)], ['5521999999999']);
    writeFileSync(path, 'numero\n5521999999999,nome');
    assert.throws(() => readNumbers(path), /linha 2/);
    rmSync(path);
    assert.throws(() => readNumbers(path));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
