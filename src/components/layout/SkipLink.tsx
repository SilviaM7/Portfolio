import { scrollToId } from '@/lib/router';

/**
 * First focusable element. It is a button, not a "#main" anchor, because the URL hash carries the route
 * on this site and an anchor would navigate to a route that does not exist.
 */
export function SkipLink() {
  return (
    <button
      type="button"
      onClick={() => scrollToId('main')}
      className="sr-only z-50 rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to main content
    </button>
  );
}
