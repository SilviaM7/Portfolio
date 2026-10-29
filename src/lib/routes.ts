/**
 * Pure route parsing for the hash router (no React, so it is unit-tested directly).
 *
 *   #/                    home
 *   #/projects            gallery
 *   #/projects/<id>       project detail
 *   #/about  #/contact  #/live-data
 */

export type Route =
  | { name: 'home' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'about' }
  | { name: 'contact' }
  | { name: 'live-data' }
  | { name: 'not-found'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  const parts = path.split('/').filter((part) => part !== '');
  const [first, second, ...rest] = parts;
  if (first === undefined) return { name: 'home' };
  if (rest.length === 0) {
    if (first === 'projects' && second === undefined) return { name: 'projects' };
    if (first === 'projects' && second !== undefined) {
      try {
        return { name: 'project', id: decodeURIComponent(second) };
      } catch {
        return { name: 'not-found', path };
      }
    }
    if (second === undefined && (first === 'about' || first === 'contact' || first === 'live-data')) return { name: first };
  }
  return { name: 'not-found', path };
}

export const hrefs = {
  home: '#/',
  projects: '#/projects',
  project: (id: string) => `#/projects/${encodeURIComponent(id)}`,
  about: '#/about',
  contact: '#/contact',
  liveData: '#/live-data',
} as const;
