import { UserError } from './errors.js';
import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import pino from 'pino';
import { config } from './config.js';
import { connect, participantPhone, ordinaryMembers } from './whatsapp.js';
import { Store } from './store.js';
import { Migration } from './service.js';
import { mask, dayKey } from './policy.js';
import { writeCsv } from './files.js';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string' }, dest: { type: 'string' }, confirm: { type: 'boolean' }, message: { type: 'string' }
  } });
  const command = positionals[0] ?? 'plan';
  if (positionals.length > 1 || !['login', 'list-groups', 'export-members', 'plan', 'run', 'send-invite'].includes(command)) {
    throw new UserError('Comandos: login | list-groups | export-members | plan | run | send-invite');
  }
  const writing = command === 'run' || command === 'send-invite';
  if (writing && !values.confirm) throw new UserError('Falta --confirm. Nenhuma ação executada. Use plan.');
  if (writing && !process.stdin.isTTY) throw new UserError('Execução exige confirmação em terminal interativo.');
  const group = (key: 'source' | 'dest') => {
    const id = values[key];
    if (!id || !/^\d+(?:-\d+)?@g\.us$/.test(id)) throw new UserError(`Informe --${key} com ID válido terminado em @g.us.`);
    return id;
  };
  if (['plan', 'run', 'send-invite', 'export-members'].includes(command)) group('source');
  if (['plan', 'run', 'send-invite'].includes(command)) group('dest');
  const message = values.message ?? 'Você autorizou sua participação no grupo. Entre pelo link: {link}';
  if (command === 'send-invite' && (!message.includes('{link}') || message.length > 4000)) throw new UserError('Mensagem deve conter {link} e ter até 4000 caracteres.');
  const cfg = config();
  if (command !== 'login' && !existsSync(cfg.session)) throw new UserError('Execute login primeiro.');
  const wa = await connect(cfg.session, command === 'login', command !== 'plan');
  let store: Store | undefined;
  let destination: ReturnType<typeof pino.destination> | undefined;
  try {
    if (command === 'login') { console.log('Sessão autenticada e salva.'); return; }
    if (command === 'list-groups') {
      console.table(Object.values(await wa.groups()).map(g => ({ id: g.id, nome: g.subject, participantes: g.participants.length, admin: wa.isAdmin(g) })));
      return;
    }
    if (command === 'export-members') {
      const g = await wa.metadata(group('source'));
      writeCsv(cfg.members, [['numero', 'nome'], ...ordinaryMembers(g.participants).flatMap(p => {
        const phone = participantPhone(p);
        return phone ? [[phone, (p as { name?: string; notify?: string }).name ?? (p as { notify?: string }).notify ?? '']] : [];
      })]);
      console.log(`Exportado: ${cfg.members}. Administradores excluídos. Sem número resolvido: ${ordinaryMembers(g.participants).filter(p => !participantPhone(p)).length}.`);
      return;
    }
    store = new Store(cfg.db, !writing);
    let log: ReturnType<typeof pino> | undefined;
    if (writing) {
      mkdirSync(dirname(cfg.log), { recursive: true, mode: 0o700 });
      destination = pino.destination({ dest: cfg.log, sync: true, mode: 0o600 });
      log = pino({ base: undefined, timestamp: pino.stdTimeFunctions.isoTime }, destination);
    }
    const migration = new Migration(wa, store, cfg, event => log?.info(event));
    if (command === 'plan') {
      const plan = await migration.plan(group('source'), group('dest'));
      const eligible = plan.candidates.filter(number => !store!.seen(group('dest'), number, 'add'));
      const remaining = Math.max(0, cfg.daily - store.used(dayKey(new Date(), cfg.zone)));
      console.table(eligible.map((number, i) => ({ numero: mask(number), acao: i < remaining ? 'adicionar' : 'aguardar limite diário' })));
      console.log(`Dry-run: ${eligible.length} elegível(is), até ${Math.min(eligible.length, remaining)} tentativa(s) hoje. LIDs sem número: ${plan.unresolved}.`);
      console.log('Tentativas anteriores foram excluídas. Nenhuma adição, mensagem ou arquivo de plano foi gravado.');
    } else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try { await migration.execute(group('source'), group('dest'), command === 'run' ? 'add' : 'invite', !!values.confirm, text => rl.question(text), message); }
      finally { rl.close(); }
    }
  } finally { store?.close(); destination?.end(); await wa.close(); }
}

main().catch((error: unknown) => {
  // Errors from transport must never leak credentials, identifiers or message text.
  console.error(error instanceof UserError ? error.message : 'Operação interrompida por falha de rede, sessão ou acesso a arquivos. Nenhuma tentativa será repetida automaticamente.');
  process.exitCode = 1;
});

