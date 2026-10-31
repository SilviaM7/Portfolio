import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { paginate, sortRows, type SortDirection, type SortState } from '@/lib/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Value used for sorting (and shown when `render` is omitted). Null = missing; sorts last. */
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
}

/**
 * Sortable, paginated table. Sorting happens on the full filtered row set (not just the visible page).
 * Changing the rows (for example when a filter changes) returns to page 1.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, pageSize = 10, initialSort }: { caption: string; columns: Column<T>[]; rows: readonly T[]; rowKey: (row: T) => string; pageSize?: number; initialSort?: SortState }) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [rows]);

  const sorted = useMemo(() => {
    const column = sort === null ? undefined : columns.find((c) => c.key === sort.key);
    return column === undefined || sort === null ? [...rows] : sortRows(rows, column.value, sort.direction);
  }, [rows, sort, columns]);

  const view = paginate(sorted, page, pageSize);

  const toggle = (key: string) =>
    setSort((current) => {
      const direction: SortDirection = current?.key === key && current.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction };
    });

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable (WCAG 2.1.1) */}
      <div role="region" aria-label={`${caption} (scrollable)`} tabIndex={0} className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th key={column.key} scope="col" aria-sort={ariaSort} className={cn('whitespace-nowrap px-3 py-1 font-medium', column.align === 'right' && 'text-right')}>
                    <button type="button" onClick={() => toggle(column.key)} className="inline-flex min-h-11 items-center gap-1 hover:text-accent">
                      {column.header}
                      <span aria-hidden="true" className="w-3 text-xs">
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                      </span>
                      <span className="sr-only">{active ? `, sorted ${ariaSort}. Activate to reverse.` : ', not sorted. Activate to sort ascending.'}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border">
                  {columns.map((column) => {
                    const raw = column.value(row);
                    return (
                      <td key={column.key} className={cn('px-3 py-2', column.align === 'right' && 'text-right tabular-nums')}>
                        {column.render !== undefined ? column.render(row) : raw === null ? '—' : raw}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite">
          {view.total === 0 ? 'No rows' : `Showing ${view.from}–${view.to} of ${view.total.toLocaleString('en-US')} rows`} · page {view.page} of {view.pageCount}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
            Previous<span className="sr-only"> page</span>
          </Button>
          <Button type="button" variant="outline" disabled={view.page >= view.pageCount} onClick={() => setPage(view.page + 1)}>
            Next<span className="sr-only"> page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
