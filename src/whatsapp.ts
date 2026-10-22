import { UserError } from './errors.js';
import makeWASocket, { useMultiFileAuthState, jidNormalizedUser, type GroupMetadata } from '@whiskeysockets/baileys';
import pino from 'pino';
import qr from 'qrcode-terminal';
import { normalizePhone } from './policy.js';

export function participantPhone(p: { id: string; phoneNumber?: string }): string | undefined {
  const jid = p.phoneNumber ?? p.id;
  if (!jid.endsWith('@s.whatsapp.net')) return undefined;
  try { return normalizePhone(jidNormalizedUser(jid).split('@')[0]); } catch { return undefined; }
}

// Filter roles before extracting any phone/name. Unknown non-empty roles fail closed too.
export function ordinaryMembers<T extends { admin?: string | null }>(participants: T[]): T[] {
  return participants.filter(p => p.admin == null || p.admin === '');
}

export async function connect(session: string, allowLogin: boolean, persist = true) {
  const { state, saveCreds } = await useMultiFileAuthState(session);
  if (!persist) state.keys.set = async () => {};
  if (!allowLogin && !state.creds.registered) throw new UserError('Sessão ausente. Execute login primeiro.');
  // Library logs are silenced: they can contain JIDs, credentials or message payloads.
  let sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), syncFullHistory: false, markOnlineOnConnect: false });
  const close = () => sock.end(undefined);
  let authWrite = Promise.resolve();
  let authFailed = false;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { close(); reject(new UserError('Tempo de conexão esgotado.')); }, allowLogin ? 180000 : 60000);
    sock.ev.on('creds.update', () => {
      if (!persist) return;
      authWrite = authWrite.then(() => saveCreds()).catch(() => {
        authFailed = true; close(); clearTimeout(timer); reject(new UserError('Falha ao salvar sessão.'));
      });
    });
    sock.ev.on('connection.update', update => {
      if (update.qr && allowLogin) qr.generate(update.qr, { small: true });
      if (update.connection === 'open') { clearTimeout(timer); resolve(); }
      if (update.connection === 'close') {
        clearTimeout(timer);
        reject(new UserError('Conexão encerrada. Se acabou de ler o QR, execute login novamente para concluir.'));
      }
    });
  });
  return {
    metadata: (id: string) => { if (authFailed) throw new UserError('Sessão não persistida.'); return sock.groupMetadata(id); },
    groups: () => sock.groupFetchAllParticipating(),
    isAdmin: (g: GroupMetadata) => g.participants.some(p => {
      const me = sock.user as { id: string; lid?: string } | undefined;
      const ids = me ? [me.id, me.lid].filter((v): v is string => !!v).map(jidNormalizedUser) : [];
      return !!p.admin && [p.id, (p as { phoneNumber?: string }).phoneNumber].some(id => id && ids.includes(jidNormalizedUser(id)));
    }),
    exists: async (phone: string) => (await sock.onWhatsApp(phone + '@s.whatsapp.net'))?.[0]?.exists === true,
    add: async (dest: string, phone: string) => {
      const result = await sock.groupParticipantsUpdate(dest, [phone + '@s.whatsapp.net'], 'add');
      return String(result[0]?.status ?? 'unknown');
    },
    invite: async (dest: string, phone: string, message: string, guard: () => Promise<boolean>) => {
      const code = await sock.groupInviteCode(dest);
      if (!code) throw new UserError('Convite indisponível.');
      const text = message.replaceAll('{link}', `https://chat.whatsapp.com/${code}`);
      if (!await guard()) return false;
      await sock.sendMessage(phone + '@s.whatsapp.net', { text });
      return true;
    },
    close: async () => { await authWrite; close(); }
  };
}
export type WhatsApp = Awaited<ReturnType<typeof connect>>;

