import { useId, useState } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState } from '@/components/project/AsyncState';
import { Page } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { categoriesOf, EMPTY_GALLERY_FILTERS, filterProjects, type GalleryFilters } from '@/projects/gallery';
import { projects } from '@/projects/registry';
import { cn } from '@/lib/utils';

export function ProjectsPage() {
  const searchId = useId();
  const [filters, setFilters] = useState<GalleryFilters>(EMPTY_GALLERY_FILTERS);
  const results = filterProjects(projects, filters);
  const filtered = filters.query.trim() !== '' || filters.category !== null;
  const reset = () => setFilters(EMPTY_GALLERY_FILTERS);

  return (
    <Page title="Projects" intro="Business analytics for AI investment, adoption, and value. Every dataset here is synthetic and labeled as such.">
      <div role="search" aria-label="Search and filter projects">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <label htmlFor={searchId} className="text-sm font-medium">
              Search projects
            </label>
            <input
              id={searchId}
              type="search"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="Try “budget”, “licenses”, or “payback”"
              className="min-h-11 rounded-md border border-border bg-card px-3 text-sm"
            />
          </div>
          <Button type="button" variant="outline" onClick={reset} disabled={!filtered}>
            Clear search and filters
          </Button>
        </div>
        <div role="group" aria-label="Filter by category" className="mt-4 flex flex-wrap gap-2">
          {[null, ...categoriesOf(projects)].map((category) => {
            const pressed = filters.category === category;
            return (
              <button
                key={category ?? 'all'}
                type="button"
                aria-pressed={pressed}
                onClick={() => setFilters({ ...filters, category })}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-medium',
                  pressed ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-muted',
                )}
              >
                {category ?? 'All categories'}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        Showing {results.length} of {projects.length} projects
      </p>
      {results.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No projects match" message="Try a different word, or clear the search and category filter." onReset={reset} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
