/** Consistent number formatting. All functions return an em dash for missing values. */

const MISSING = '—';

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd4 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function present(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/** Whole dollars, e.g. $1,234. */
export function formatUsd(value: number | null | undefined): string {
  return present(value) ? usd0.format(value) : MISSING;
}

/** Dollars and cents, e.g. $1,234.56. */
export function formatUsdCents(value: number | null | undefined): string {
  return present(value) ? usd2.format(value) : MISSING;
}

/** Four decimals for very small unit costs, e.g. $0.0123. */
export function formatUsdPrecise(value: number | null | undefined): string {
  return present(value) ? usd4.format(value) : MISSING;
}

/** Ratio (0.256) to percent text ("25.6%"). */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  return present(ratio) ? `${(ratio * 100).toFixed(digits)}%` : MISSING;
}

export function formatInteger(value: number | null | undefined): string {
  return present(value) ? integer.format(value) : MISSING;
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return present(value) ? value.toFixed(digits) : MISSING;
}

export function formatCompact(value: number | null | undefined): string {
  return present(value) ? compact.format(value) : MISSING;
}

/** Compact currency for chart axes, e.g. $1.2K. */
export function formatUsdCompact(value: number | null | undefined): string {
  return present(value) ? `$${compact.format(value)}` : MISSING;
}

export function formatSignedPercent(ratio: number | null | undefined, digits = 1): string {
  if (!present(ratio)) return MISSING;
  const text = `${Math.abs(ratio * 100).toFixed(digits)}%`;
  return ratio > 0 ? `+${text}` : ratio < 0 ? `−${text}` : text;
}

export function formatMinutes(value: number | null | undefined): string {
  return present(value) ? `${value.toFixed(1)} min` : MISSING;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${integer.format(count)} ${count === 1 ? singular : plural}`;
}
