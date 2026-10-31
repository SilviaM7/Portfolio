import type { ReactNode } from 'react';

/** KPI tiles. Each states its definition (formula and denominator) so a number is never unexplained. */
export function KpiGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <dl aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

export function KpiCard({ label, value, definition, note }: { label: string; value: string; definition: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</dd>
      {note !== undefined && <dd className="mt-1 text-sm">{note}</dd>}
      <dd className="mt-2 text-xs text-muted-foreground">{definition}</dd>
    </div>
  );
}
