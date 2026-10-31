import { useCallback, useEffect, useState } from 'react';

export type DatasetState<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/**
 * Load a dataset once on mount (and again on `reload`). `load` must be a stable function (declare it at module level).
 * The request is aborted if the component unmounts, and an aborted request never updates state.
 */
export function useDataset<T>(load: (signal: AbortSignal) => Promise<T>): { state: DatasetState<T>; reload: () => void } {
  const [state, setState] = useState<DatasetState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: error instanceof Error ? error : new Error('Unknown error while loading the dataset.') });
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
