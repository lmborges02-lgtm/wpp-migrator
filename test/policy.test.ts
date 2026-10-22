import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, intersection, dayKey, withinDailyLimit } from '../src/policy.js';

test('normaliza E.164 sem inferir país', () => {
  assert.equal(normalizePhone(' +55 (21) 99999-9999 '), '5521999999999');
  for (const invalid of ['0', '05521999999999', '55abc12345678', '1e12345678', '1234567890123456', '']) {
    assert.throws(() => normalizePhone(invalid));
  }
});
test('interseção exige origem e consentimento, exclui destino e duplicatas', () => {
  assert.deepEqual(intersection(['1','2','3','3','4'], ['2'], new Set(['2','3','5']), new Set()), ['3']);
});
test('blocklist sempre tem precedência', () => {
  assert.deepEqual(intersection(['1','2'], [], new Set(['1','2']), new Set(['1'])), ['2']);
});
test('limite diário bloqueia na fronteira; calendário usa fuso configurado', () => {
  assert.equal(withinDailyLimit(29, 30), true);
  assert.equal(withinDailyLimit(30, 30), false);
  assert.equal(withinDailyLimit(31, 30), false);
  assert.equal(dayKey(new Date('2026-10-22T01:00:00Z'), 'America/Sao_Paulo'), '2026-10-21');
});
