import { Suspense } from 'react';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { findProject } from '@/projects/registry';
import { projectViews } from '@/projects/views';

/**
 * Detail route. Unknown ids and projects still in development get a clear page instead of an error.
 * The Suspense fallback shows while the view's code is downloading (the view then shows its own data-loading state).
 */
export function ProjectDetailPage({ id }: { id: string }) {
  const project = findProject(id);
  if (project === undefined) return <NotFoundPage title="Project not found" message="There is no project with that address." />;
  const View = projectViews[id];
  if (project.status !== 'available' || View === undefined) {
    return <NotFoundPage title={project.title} message="This project's interactive analysis is still in development." />;
  }
  return (
    <div className="fade-in mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense
        fallback={
          <p role="status" className="rounded-lg border border-border bg-card p-6 text-muted-foreground">
            Loading {project.title}…
          </p>
        }
      >
        <View />
      </Suspense>
    </div>
  );
}
