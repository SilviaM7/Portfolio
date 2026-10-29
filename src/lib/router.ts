/**
 * Hash router hook. Hash routes work on GitHub Pages without server rewrites: the server only ever sees "/" or "/REPOSITORY/".
 * Because the hash carries the route, in-page jump links are buttons that scroll (see scrollToId),
 * not "#section" anchors, which would be read as routes. Route parsing lives in ./routes.ts.
 */
import { useSyncExternalStore } from 'react';
import { parseHash, type Route } from './routes';

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

const getHash = (): string => window.location.hash;
const getServerHash = (): string => '';

/** Current route; re-renders on hashchange (including back/forward and refreshed deep links). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return parseHash(hash);
}

/** Smooth-scroll (instant when the visitor prefers reduced motion) and move focus to the target. */
export function scrollToId(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
