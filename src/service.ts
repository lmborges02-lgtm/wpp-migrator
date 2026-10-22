import { UserError } from './errors.js';
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readNumbers, writeCsv } from './files.js';
import { dayKey, intersection, mask, permitted } from './policy.js';
import { participantPhone, ordinaryMembers, type WhatsApp } from './whatsapp.js';
import { Store, type Action } from './store.js';
import type { Config } from './config.js';

type Audit = (event: { number: string; action: string; result: string }) => void;
export class Migration {
  constructor(private wa: WhatsApp, private store: Store, private cfg: Config, private audit: Audit) {}
  lists() { return { authorized: readNumbers(this.cfg.authorized), blocked: readNumbers(this.cfg.blocked) }; }
  async plan(source: string, dest: string) {
    if (source === dest) throw new UserError('Origem e destino devem ser diferentes.');
    const lists = this.lists();
    const [src, dst] = await Promise.all([this.wa.metadata(source), this.wa.metadata(dest)]);
    const phones = (g: typeof src) => g.participants.map(participantPhone).filter((p): p is string => !!p);
    const sourcePhones = ordinaryMembers(src.participants).map(participantPhone).filter((p): p is string => !!p);
    return { candidates: intersection(sourcePhones, phones(dst), lists.authorized, lists.blocked), dst,
      unresolved: ordinaryMembers(src.participants).filter(p => !participantPhone(p)).length };
  }
  async execute(source: string, dest: string, action: Action, confirm: boolean,
    prompt: (text: string) => Promise<string>, message: string) {
    if (!confirm) throw new UserError('Execução recusada: falta --confirm. Use plan para simular.');
    const initialDest = await this.wa.metadata(dest);
    if (!this.wa.isAdmin(initialDest)) throw new UserError('Você não é administrador do grupo destino. Operação abortada.');
    const plan = await this.plan(source, dest);
    const manual = new Set(this.store.manual(dest).map(r => r.phone));
    const candidates = plan.candidates.filter(p => !this.store.seen(dest, p, action) && (action === 'add' || manual.has(p)));
    console.table(candidates.map(number => ({ numero: mask(number), acao: action })));
    if (!candidates.length) { await this.exportManual(source, dest); console.log('Nenhum contato elegível.'); return; }
    if ((await prompt(`Digite MIGRAR para confirmar ${candidates.length} tentativa(s) no destino ${dest}: `)).trim() !== 'MIGRAR') {
      throw new UserError('Confirmação cancelada.');
    }
    let attempted = 0;
    try {
      for (const phone of candidates) {
        if (attempted && attempted % this.cfg.batch === 0) {
          await sleep(randomInt(this.cfg.minDelay, this.cfg.maxDelay + 1) * 1000);
        }
        // Refresh group membership, privileges and consent after every wait.
        const fresh = await this.plan(source, dest);
        if (!this.wa.isAdmin(fresh.dst)) throw new UserError('Você perdeu a administração do destino. Operação abortada.');
        if (!fresh.candidates.includes(phone)) continue;
        const lists = this.lists();
        if (!permitted(phone, lists.authorized, lists.blocked)) continue;
        if (!this.store.reserve(dest, phone, action, dayKey(new Date(), this.cfg.zone), this.cfg.daily)) {
          if (this.store.seen(dest, phone, action)) continue;
          console.log('Limite diário atingido.'); break;
        }
        attempted++;
        let status = 'network_or_unknown';
        try {
          if (!await this.wa.exists(phone)) status = 'no_whatsapp';
          else {
            // Refresh source roles again after the WhatsApp lookup.
            if (!await this.stillEligible(source, dest, phone)) status = 'revoked';
            else if (action === 'add') {
              const code = await this.wa.add(dest, phone);
              status = code === '200' ? 'added' : code === '403' ? 'privacy' : code === '404' ? 'no_whatsapp' : 'server_' + (/^\d{3}$/.test(code) ? code : 'unknown');
            } else {
              const sent = await this.wa.invite(dest, phone, message, () => this.stillEligible(source, dest, phone));
              status = sent ? 'invited' : 'revoked';
            }
          }
        } catch { /* Never retry or log exception payloads from the library. */ }
        this.store.finish(dest, phone, action, status);
        this.audit({ number: mask(phone), action, result: status });
        console.log(`${mask(phone)}: ${status}`);
      }
    } finally { await this.exportManual(source, dest); }
  }
  private async stillEligible(source: string, dest: string, phone: string) {
    const fresh = await this.plan(source, dest);
    const lists = this.lists();
    return this.wa.isAdmin(fresh.dst) && fresh.candidates.includes(phone) && permitted(phone, lists.authorized, lists.blocked);
  }
  async exportManual(source: string, dest: string) {
    const src = await this.wa.metadata(source);
    const members = new Set(ordinaryMembers(src.participants).map(participantPhone));
    const lists = this.lists();
    writeCsv(this.cfg.manual, [['numero', 'motivo', 'destino'], ...this.store.manual(dest)
      .filter(r => members.has(r.phone) && permitted(r.phone, lists.authorized, lists.blocked))
      .map(r => [r.phone, r.status, dest])]);
  }
}

