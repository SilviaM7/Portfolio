import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DataError } from '@/data/errors';
import type { DatasetState } from '@/hooks/useDataset';

/** Loading, error (with retry), and ready states for a dataset. Errors never crash the page. */
export function AsyncState<T>({ state, onRetry, children }: { state: DatasetState<T>; onRetry: () => void; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') {
    return (
      <p role="status" className="rounded-lg border border-border bg-card p-6 text-muted-foreground">
        Loading the dataset…
      </p>
    );
  }
  if (state.status === 'error') {
    const details = state.error instanceof DataError ? state.error.details : [];
    return (
      <div role="alert" className="rounded-lg border border-accent bg-accent-soft p-6">
        <h2 className="text-lg font-semibold">This analysis could not be loaded</h2>
        <p className="mt-2">{state.error.message}</p>
        {details.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <Button type="button" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

export function EmptyState({ title, message, onReset }: { title: string; message: string; onReset?: () => void }) {
  return (
    <div role="status" className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{message}</p>
      {onReset !== undefined && (
        <Button type="button" variant="outline" className="mt-4" onClick={onReset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}
