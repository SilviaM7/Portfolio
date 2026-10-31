/** Accordion on Base UI. Used for methodology, definitions, and field lists so long reference text stays out of the way. */
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('border-b border-border', className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="m-0">
      <AccordionPrimitive.Trigger
        className={cn('flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left font-medium hover:text-accent', className)}
        {...props}
      >
        {children}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Panel>) {
  return <AccordionPrimitive.Panel className={cn('pb-4 text-sm', className)} {...props} />;
}
