export function normalizePhone(value: string): string {
  const phone = value.trim().replace(/^\+/, '').replace(/[ ()-]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Número inválido: use E.164 com código de país (8–15 dígitos).');
  return phone;
}

export function permitted(phone: string, authorized: Set<string>, blocked: Set<string>): boolean {
  return authorized.has(phone) && !blocked.has(phone);
}

export function intersection(source: string[], dest: string[], authorized: Set<string>, blocked: Set<string>): string[] {
  const existing = new Set(dest);
  return [...new Set(source)].filter(p => permitted(p, authorized, blocked) && !existing.has(p)).sort();
}

export function dayKey(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}

export function withinDailyLimit(used: number, limit: number): boolean { return used < limit; }
export function mask(phone: string): string { return `${phone.slice(0, 2)}***${phone.slice(-4)}`; }
