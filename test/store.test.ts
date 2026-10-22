import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';

test('reserva atômica conta falhas e ações de todos destinos, sem repetir', () => {
  const store = new Store(':memory:');
  try {
    assert.equal(store.reserve('a', '1', 'add', '2026-10-22', 2), true);
    store.finish('a', '1', 'add', 'network_or_unknown');
    assert.equal(store.reserve('a', '1', 'add', '2026-10-23', 2), false);
    assert.equal(store.reserve('b', '2', 'invite', '2026-10-22', 2), true);
    assert.equal(store.reserve('b', '3', 'add', '2026-10-22', 2), false);
    assert.equal(store.reserve('b', '3', 'add', '2026-10-23', 2), true);
    assert.equal(store.used('2026-10-22'), 2);
  } finally { store.close(); }
});
