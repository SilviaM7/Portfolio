/** Sorting and pagination for the data tables. Pure functions, no React. */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });

/**
 * Stable sort. Missing values (null) always sort last, in both directions, so blanks never look like the smallest or largest value.
 * Numbers compare numerically; text compares with natural ordering ("REQ-2" before "REQ-10").
 */
export function sortRows<T>(rows: readonly T[], valueOf: (row: T) => string | number | null, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      const order = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : collator.compare(String(a.value), String(b.value));
      return order !== 0 ? sign * order : a.index - b.index;
    })
    .map((entry) => entry.row);
}

export interface Page<T> {
  rows: T[];
  /** 1-based page actually shown (clamped into range). */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last row shown; 0 when there are no rows. */
  from: number;
  to: number;
}

export function paginate<T>(rows: readonly T[], requestedPage: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * size;
  const slice = rows.slice(start, start + size);
  return { rows: slice, page, pageCount, total: rows.length, from: slice.length === 0 ? 0 : start + 1, to: start + slice.length };
}
