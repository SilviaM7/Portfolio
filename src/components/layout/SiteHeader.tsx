import { site } from '@/config/site';
import { hrefs, type Route } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

const NAV: { label: string; href: string; matches: (route: Route) => boolean }[] = [
  { label: 'Projects', href: hrefs.projects, matches: (r) => r.name === 'projects' || r.name === 'project' },
  { label: 'About', href: hrefs.about, matches: (r) => r.name === 'about' },
  { label: 'Contact', href: hrefs.contact, matches: (r) => r.name === 'contact' },
];

export function SiteHeader({ route }: { route: Route }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <a href={hrefs.home} className="font-serif text-lg font-semibold">
          {site.name}
        </a>
        <div className="flex items-center gap-1">
          <nav aria-label="Main">
            <ul className="flex flex-wrap items-center gap-1">
              {NAV.map((item) => {
                const current = item.matches(route);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn('inline-flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted', current ? 'font-semibold text-accent' : 'text-foreground')}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
