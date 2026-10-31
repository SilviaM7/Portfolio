import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface FilterOption {
  value: string;
  label: string;
}

/** Native <select> with a visible label: the most reliable accessible control, and it works well on touch devices. */
export function SelectField({ label, value, onChange, options, allLabel = 'All' }: { label: string; value: string | null; onChange: (value: string | null) => void; options: readonly FilterOption[]; allLabel?: string }) {
  const id = useId();
  return (
    <div className="flex min-w-40 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className="min-h-11 rounded-md border border-border bg-card px-3 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Filter container: controls, a reset button, the list of active filters, and a live result count.
 * `activeFilters` is shown as text so the current state is never conveyed by control position or colour alone.
 */
export function FilterBar({ children, activeFilters, resultText, onReset }: { children: ReactNode; activeFilters: { label: string; value: string }[]; resultText: string; onReset: () => void }) {
  return (
    <section aria-label="Filters" className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        {children}
        <Button type="button" variant="outline" onClick={onReset} disabled={activeFilters.length === 0}>
          Reset filters
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Active filters:{' '}
        {activeFilters.length === 0 ? 'none (showing the full dataset)' : activeFilters.map((f) => `${f.label}: ${f.value}`).join(' · ')}
      </p>
      <p className="mt-1 text-sm font-medium" aria-live="polite">
        {resultText}
      </p>
    </section>
  );
}
