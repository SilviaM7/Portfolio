/**
 * Status messages for validation and feedback (shadcn-style Alert on the "base" style; Base UI has no alert primitive).
 * Tone is always conveyed three ways: colour, an icon, and a visually hidden text label ("Error:", "Warning:", "Success:").
 *   destructive = a failure or invalid input (red) · warning = a caution the visitor should know about (yellow) · success = it worked (green)
 * Destructive alerts use role="alert" (announced immediately); warning and success use role="status" (announced politely).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AlertTone = 'destructive' | 'warning' | 'success';

const STYLES: Record<AlertTone, { box: string; text: string; label: string }> = {
  destructive: { box: 'border-destructive-border bg-destructive-soft', text: 'text-destructive', label: 'Error:' },
  warning: { box: 'border-warning-border bg-warning-soft', text: 'text-warning', label: 'Warning:' },
  success: { box: 'border-success-border bg-success-soft', text: 'text-success', label: 'Success:' },
};

function ToneIcon({ tone, className }: { tone: AlertTone; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className={cn('size-5 shrink-0', className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {tone === 'success' ? (
        <>
          <circle cx="10" cy="10" r="8" />
          <path d="m6.5 10.2 2.3 2.3 4.7-4.9" />
        </>
      ) : tone === 'warning' ? (
        <>
          <path d="M10 2.8 18 17H2z" />
          <path d="M10 8v4M10 14.5v.1" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="8" />
          <path d="m7 7 6 6M13 7l-6 6" />
        </>
      )}
    </svg>
  );
}

export function Alert({ tone, title, children, className }: { tone: AlertTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const style = STYLES[tone];
  return (
    <div role={tone === 'destructive' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm text-foreground', style.box, className)}>
      <ToneIcon tone={tone} className={cn('mt-0.5', style.text)} />
      <div className="min-w-0 space-y-1">
        {title !== undefined && (
          <p className={cn('font-semibold', style.text)}>
            <span className="sr-only">{style.label} </span>
            {title}
          </p>
        )}
        {title === undefined && <span className="sr-only">{style.label} </span>}
        {children}
      </div>
    </div>
  );
}

/** Inline message under a form field. Give it the id the field references with aria-describedby. */
export function FieldMessage({ id, tone = 'destructive', children, className }: { id?: string; tone?: AlertTone; children: ReactNode; className?: string }) {
  const style = STYLES[tone];
  return (
    <p id={id} role={tone === 'destructive' ? 'alert' : 'status'} className={cn('mt-1 flex items-start gap-1.5 text-sm font-medium', style.text, className)}>
      <ToneIcon tone={tone} className="mt-0.5 size-4" />
      <span>
        <span className="sr-only">{style.label} </span>
        {children}
      </span>
    </p>
  );
}
