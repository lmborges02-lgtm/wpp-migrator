import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Migration } from '../src/service.js';
import { Store } from '../src/store.js';
import { config } from '../src/config.js';
import type { WhatsApp } from '../src/whatsapp.js';
import { ordinaryMembers } from '../src/whatsapp.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'wa-migration-'));
  const cfg = { ...config(), authorized: join(dir,'authorized.csv'), blocked: join(dir,'blocklist.csv'), manual: join(dir,'manual.csv') };
  writeFileSync(cfg.authorized, '5521999999999\n5521888888888\n');
  writeFileSync(cfg.blocked, '5521888888888\n');
  const calls: string[] = [];
  const wa = {
    metadata: async (id: string) => ({ id, participants: id === 'source' ? ['5521999999999','5521888888888','5521777777777'].map(p => ({ id: p + '@s.whatsapp.net' })) : [] }),
    isAdmin: () => true,
    exists: async () => true,
    add: async (_dest: string, phone: string) => { calls.push(phone); return '200'; },
    invite: async () => { throw new Error('unexpected'); }
  } as unknown as WhatsApp;
  const store = new Store(':memory:');
  const migration = new Migration(wa, store, cfg, () => {});
  return { dir, cfg, calls, wa, store, migration, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('exportação seleciona somente membros comuns, excluindo admin e superadmin', () => {
  const people = [{ admin: null, id: 'member' }, { admin: 'admin', id: 'admin' }, { admin: 'superadmin', id: 'owner' }, { admin: 'unknown', id: 'unknown' }];
  assert.deepEqual(ordinaryMembers(people).map(p => p.id), ['member']);
});

test('administradores autorizados não entram no plano, consultas de número ou convites manuais', async () => {
  for (const role of ['admin', 'superadmin']) {
    const f = fixture();
    try {
      const metadata = f.wa.metadata;
      f.wa.metadata = async id => {
        const group = await metadata(id);
        if (id === 'source') group.participants[0].admin = role as 'admin' | 'superadmin';
        return group;
      };
      f.wa.exists = async () => { throw new Error('Não deve consultar número de admin'); };
      f.store.reserve('dest', '5521999999999', 'add', '2026-10-21', 30);
      f.store.finish('dest', '5521999999999', 'add', 'privacy');
      assert.deepEqual((await f.migration.plan('source', 'dest')).candidates, []);
      await f.migration.execute('source', 'dest', 'add', true, async () => 'MIGRAR', '');
      await f.migration.execute('source', 'dest', 'invite', true, async () => 'MIGRAR', '{link}');
      assert.deepEqual(f.calls, []);
      assert.equal(readFileSync(f.cfg.manual, 'utf8').includes('5521999999999'), false);
    } finally { f.close(); }
  }
});

test('promoção durante confirmação, consulta ou obtenção de convite impede ação', async () => {
  for (const stage of ['confirmation', 'lookup', 'invite']) {
    const f = fixture();
    try {
      let promoted = false;
      let invites = 0;
      const metadata = f.wa.metadata;
      f.wa.metadata = async id => {
        const group = await metadata(id);
        if (id === 'source' && promoted) group.participants[0].admin = 'admin';
        return group;
      };
      if (stage === 'lookup') f.wa.exists = async () => { promoted = true; return true; };
      if (stage === 'invite') {
        f.store.reserve('dest', '5521999999999', 'add', '2026-10-21', 30);
        f.store.finish('dest', '5521999999999', 'add', 'privacy');
        f.wa.invite = async (_dest, _phone, _message, guard) => {
          promoted = true;
          if (!await guard()) return false;
          invites++; return true;
        };
      }
      await f.migration.execute('source', 'dest', stage === 'invite' ? 'invite' : 'add', true,
        async () => { if (stage === 'confirmation') promoted = true; return 'MIGRAR'; }, '{link}');
      assert.deepEqual(f.calls, []);
      assert.equal(invites, 0);
      assert.equal(readFileSync(f.cfg.manual, 'utf8').includes('5521999999999'), false);
    } finally { f.close(); }
  }
});
test('plan não escreve arquivos nem banco, nem chama adição', async () => {
  const f = fixture();
  try {
    assert.deepEqual((await f.migration.plan('source','dest')).candidates, ['5521999999999']);
    assert.deepEqual(readdirSync(f.dir).sort(), ['authorized.csv','blocklist.csv']);
    assert.equal(f.store.used('2026-10-22'), 0);
    assert.deepEqual(f.calls, []);
  } finally { f.close(); }
});
test('sem --confirm ou sem admin aborta', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.migration.execute('source','dest','add', false, async () => 'MIGRAR', ''), /--confirm/);
    f.wa.isAdmin = () => false;
    await assert.rejects(f.migration.execute('source','dest','add', true, async () => 'MIGRAR', ''), /administrador/);
    assert.deepEqual(f.calls, []);
  } finally { f.close(); }
});
test('adiciona só autorizado e não bloqueado, uma única vez', async () => {
  const f = fixture();
  try {
    await f.migration.execute('source','dest','add', true, async () => 'MIGRAR', '');
    await f.migration.execute('source','dest','add', true, async () => 'MIGRAR', '');
    assert.deepEqual(f.calls, ['5521999999999']);
  } finally { f.close(); }
});
test('revogação durante confirmação ou consulta onWhatsApp impede adição', async () => {
  for (const stage of ['confirmation','lookup']) {
    const f = fixture();
    try {
      const revoke = () => writeFileSync(f.cfg.blocked, '5521888888888\n5521999999999\n');
      if (stage === 'lookup') f.wa.exists = async () => { revoke(); return true; };
      await f.migration.execute('source','dest','add', true, async () => { if (stage === 'confirmation') revoke(); return 'MIGRAR'; }, '');
      assert.deepEqual(f.calls, []);
    } finally { f.close(); }
  }
});
test('falha de rede não é repetida e gera convite manual', async () => {
  const f = fixture();
  try {
    let attempts = 0;
    f.wa.add = async () => { attempts++; throw new Error('secret'); };
    await f.migration.execute('source','dest','add', true, async () => 'MIGRAR', '');
    await f.migration.execute('source','dest','add', true, async () => 'MIGRAR', '');
    assert.equal(attempts, 1);
    assert.equal(f.store.manual('dest')[0].status, 'network_or_unknown');
  } finally { f.close(); }
});

test('send-invite exige falha anterior, consentimento vigente e não repete mensagem', async () => {
  const f = fixture();
  try {
    const invitations: string[] = [];
    f.wa.invite = async (_dest, phone, _message, guard) => { if (!await guard()) return false; invitations.push(phone); return true; };
    await f.migration.execute('source','dest','invite', true, async () => 'MIGRAR', '{link}');
    assert.deepEqual(invitations, []);
    f.store.reserve('dest','5521999999999','add','2026-10-21',30);
    f.store.finish('dest','5521999999999','add','privacy');
    await f.migration.execute('source','dest','invite', true, async () => 'MIGRAR', '{link}');
    await f.migration.execute('source','dest','invite', true, async () => 'MIGRAR', '{link}');
    assert.deepEqual(invitations, ['5521999999999']);
  } finally { f.close(); }
});

test('plan com SQLite real somente leitura preserva bytes; banco ausente não é criado', async () => {
  const f = fixture();
  const path = join(f.dir,'state.sqlite');
  try {
    const missing = new Store(path, true);
    assert.equal(existsSync(path), false);
    missing.close();
    const writable = new Store(path);
    writable.reserve('dest','5521999999999','add','2026-10-21',30);
    writable.close();
    const before = readFileSync(path);
    const readonly = new Store(path, true);
    try {
      const migration = new Migration(f.wa, readonly, f.cfg, () => { throw new Error('Não deve logar'); });
      await migration.plan('source','dest');
    } finally { readonly.close(); }
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(f.calls, []);
  } finally { f.close(); }
});
