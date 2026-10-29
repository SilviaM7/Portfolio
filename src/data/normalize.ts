import { parseIsoDate, parseMonth } from '@/lib/dates';
import { DataError } from './errors';

/** One CSV record as parsed: header name -> raw cell text. */
export type RawRow = Record<string, string | undefined>;

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Strict number parsing. Blank, whitespace, "NaN", "1,234", "12abc" and similar all return null,
 * so a bad value is never silently turned into 0.
 */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  if (!NUMBER.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Non-negative whole number, or null. */
export function parseCount(raw: string | null | undefined): number | null {
  const value = parseNumber(raw);
  return value !== null && value >= 0 && Number.isInteger(value) ? value : null;
}

/** Trimmed text, or null when blank. */
export function parseText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  return text === '' ? null : text;
}

/** Case-insensitive match against an allowed list; returns the canonical spelling or null. */
export function parseEnum<T extends string>(raw: string | null | undefined, allowed: readonly T[]): T | null {
  const text = parseText(raw);
  if (text === null) return null;
  const lower = text.toLowerCase();
  return allowed.find((candidate) => candidate.toLowerCase() === lower) ?? null;
}

export { parseIsoDate, parseMonth };

/** Throws a helpful DataError when required columns are missing from the CSV header. */
export function requireColumns(fileName: string, headers: readonly string[], required: readonly string[]): void {
  const present = new Set(headers.map((h) => h.trim()));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new DataError(`${fileName} is missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`, [
      `Found columns: ${headers.join(', ') || '(none)'}`,
      'Check the file header against the data dictionary in docs/data-dictionary.md.',
    ]);
  }
}

/** Throws when a file parsed to zero usable rows. */
export function requireRows(fileName: string, rows: readonly unknown[]): void {
  if (rows.length === 0) {
    throw new DataError(`${fileName} contains no usable rows after validation.`, [
      'The file may be empty, or every row failed validation. See the data-quality notes.',
    ]);
  }
}
