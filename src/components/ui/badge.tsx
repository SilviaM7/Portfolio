import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Small label. `tone="accent"` is used for the "synthetic data" tag so it is never missed. */
export function Badge({ className, tone = 'neutral', ...props }: ComponentProps<'span'> & { tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone === 'accent' ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
