import { formatAccessDate } from '@prepio/shared';

// Dates on the student page, in Bucharest time and with Romanian month abbreviations without dots ("4 nov 2026").

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sept', 'oct', 'nov', 'dec'];

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function parts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), time: `${p.hour}:${p.minute}` };
}

const dayKey = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** "4 nov 2026" */
export function formatDay(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "6 nov, 18:40" */
export function formatDayTime(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.d} ${MONTHS[p.m - 1]}, ${p.time}`;
}

/** "azi 10:12", "ieri 10:12", otherwise "4 nov 2026". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const p = parts(new Date(iso));
  const n = parts(now);
  const days = (dayKey(n.y, n.m, n.d) - dayKey(p.y, p.m, p.d)) / 86_400_000;
  if (days === 0) return `azi ${p.time}`;
  if (days === 1) return `ieri ${p.time}`;
  return formatDay(iso);
}

const firstAlnum = (s: string) => s.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '';

/** Up to two initials from the name's words (letters/digits only), else the first letter of the email. */
export function initials(name: string | null, email: string | null): string {
  const letters = (name ?? '').split(/\s+/).map(firstAlnum).filter(Boolean);
  if (letters.length) return letters.slice(0, 2).join('');
  return firstAlnum(email ?? '') || '?';
}

/** The student's plan for the header and the list: "Trial", or "Acces până la 8 februarie 2027" while access lasts. */
export function planLabel(accessUntil: string | null, now: Date): string {
  if (accessUntil === null) return 'Trial';
  const until = new Date(accessUntil);
  return until.getTime() > now.getTime() ? `Acces până la ${formatAccessDate(until)}` : 'Trial';
}
