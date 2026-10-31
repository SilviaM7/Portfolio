import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
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
      <Alert tone="destructive" title="This analysis could not be loaded" className="p-6 text-base">
        <p>{state.error.message}</p>
        {details.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <Button type="button" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </Alert>
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
