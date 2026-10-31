import type { ReactNode } from 'react';
import { CHART_HEIGHT_CLASS } from '@/components/charts/theme';

export interface ChartTable {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Wrapper for every chart: heading, units/time range/filters line, a text summary, the chart itself with an explicit
 * height, and an optional data table. The summary and table are what assistive technology reads; the chart is decorative to it.
 */
export function ChartCard({ id, title, subtitle, summary, table, children }: { id: string; title: string; subtitle: string; summary: string; table?: ChartTable; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <p className="mt-3 text-sm">{summary}</p>
      <div role="img" aria-label={`${title}. ${summary}`} className={`mt-4 w-full ${CHART_HEIGHT_CLASS}`}>
        {children}
      </div>
      {table !== undefined && (
        <details className="mt-4 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-accent">View chart data as a table</summary>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable (WCAG 2.1.1) */}
          <div role="region" aria-label={table.caption} tabIndex={0} className="mt-2 max-h-80 overflow-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{table.caption}</caption>
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} scope="col" className="sticky top-0 border-b border-border bg-card px-3 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index} className="border-b border-border">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className={cellIndex === 0 ? 'px-3 py-2' : 'px-3 py-2 tabular-nums'}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
