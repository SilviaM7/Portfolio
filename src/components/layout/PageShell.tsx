import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

/** Standard page width and heading. `narrow` keeps long-form text at a readable measure. */
export function Page({ title, intro, children, narrow = false }: { title: string; intro?: ReactNode; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={cn('fade-in mx-auto w-full px-4 py-10 sm:px-6 sm:py-14', narrow ? 'max-w-3xl' : 'max-w-6xl')}>
      <h1 data-route-heading tabIndex={-1} className="text-3xl font-semibold sm:text-4xl">
        {title}
      </h1>
      {intro !== undefined && <div className="mt-4 max-w-prose text-lg text-muted-foreground">{intro}</div>}
      <div className="mt-10">{children}</div>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="mt-12 first:mt-0">
      <h2 id={id ? `${id}-title` : undefined} className="text-2xl font-semibold">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Visible marker for content the site owner still has to fill in (see src/config). */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <Alert tone="warning" title="Placeholder">
      <p>{children}</p>
    </Alert>
  );
}
