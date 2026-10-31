import { useEffect, useRef, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { assetUrl } from '@/lib/url';
import { hrefs } from '@/lib/routes';
import { scrollToId } from '@/lib/router';
import type { ProjectSummary } from '@/projects/registry';

export function ProjectHeader({ project }: { project: ProjectSummary }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The project view is lazy-loaded, so it mounts after App's navigation effect has already run. Move focus here.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header>
      <p className="text-sm">
        <a href={hrefs.projects} className="text-accent underline underline-offset-4">
          ← All projects
        </a>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{project.category}</Badge>
        <Badge tone="accent">Synthetic data</Badge>
      </div>
      <h1 ref={headingRef} data-route-heading tabIndex={-1} className="mt-3 text-3xl font-semibold sm:text-4xl">
        {project.title}
      </h1>
      <p className="mt-4 max-w-prose text-lg">
        <span className="font-medium">Business question: </span>
        {project.businessQuestion}
      </p>
      <p role="note" className="mt-4 max-w-prose rounded-md border border-accent bg-accent-soft px-4 py-3 text-sm">
        <strong>Synthetic demonstration.</strong> The data are fictional and generated with a fixed seed. Seeded patterns show analytical methods; they are not real company data or empirical discoveries.
      </p>
    </header>
  );
}

/** In-page jump links are buttons (not "#anchors"), because the URL hash carries the route. */
export function JumpNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item.id} type="button" variant="outline" onClick={() => scrollToId(item.id)}>
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

export function ProjectSection({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14">
      <h2 id={`${id}-title`} className="text-2xl font-semibold">
        {title}
      </h2>
      {intro !== undefined && <p className="mt-2 max-w-prose text-muted-foreground">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export interface DatasetFile {
  /** Path relative to the site base, e.g. "data/ai-spend/usage_events.csv". */
  path: string;
  description: string;
}

/** Download links for the source CSVs. Paths respect the deployment base path. */
export function DatasetDownloads({ files }: { files: readonly DatasetFile[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {files.map((file) => (
        <li key={file.path}>
          <a href={assetUrl(file.path)} download className="font-medium text-accent underline underline-offset-4">
            Download {file.path.split('/').pop()}
          </a>
          <span className="text-muted-foreground"> — {file.description}</span>
        </li>
      ))}
    </ul>
  );
}
