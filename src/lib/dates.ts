/**
 * Calendar-date helpers.
 *
 * Dates are kept as ISO strings ("2026-09-27") and months as "2026-09". All arithmetic goes through
 * Date.UTC so a visitor's time zone can never shift a date by a day. Never use `new Date("2026-09-27")`
 * followed by local-time getters in this project.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
export const DAY_MS = 86_400_000;
export const AVG_DAYS_PER_MONTH = 30.4375;

/** Returns the normalized ISO date if `raw` is a real calendar date, otherwise null. */
export function parseIsoDate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  const match = ISO_DATE.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return text;
}

/** Returns the normalized "YYYY-MM" if valid, otherwise null. */
export function parseMonth(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  const match = ISO_MONTH.exec(text);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? text : null;
}

export function utcMs(iso: string): number {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Not an ISO date: ${iso}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const monthKey = (iso: string): string => iso.slice(0, 7);

export function addDays(iso: string, days: number): string {
  return isoFromMs(utcMs(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function isWeekend(iso: string): boolean {
  const day = new Date(utcMs(iso)).getUTCDay();
  return day === 0 || day === 6;
}

export function addMonths(month: string, delta: number): string {
  const match = ISO_MONTH.exec(month);
  if (!match) throw new Error(`Not a month: ${month}`);
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** Same calendar day `delta` months later, clamped to the end of shorter months. */
export function addMonthsToDate(iso: string, delta: number): string {
  const month = addMonths(monthKey(iso), delta);
  const day = Number(iso.slice(8, 10));
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;
}

export function daysInMonth(month: string): number {
  const match = ISO_MONTH.exec(month);
  if (!match) throw new Error(`Not a month: ${month}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
}

/** Inclusive list of months between `from` and `to` (empty if `to` is before `from`). */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function quarterOf(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return `${iso.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(utcMs(iso)));
}

export function formatMonth(month: string): string {
  return monthFormatter.format(new Date(utcMs(`${month}-01`)));
}

/** Short month label for chart axes, e.g. "Sep". */
export function formatMonthShort(month: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(utcMs(`${month}-01`)));
}
