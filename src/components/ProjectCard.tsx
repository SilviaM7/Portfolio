import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { hrefs } from '@/lib/routes';
import type { ProjectSummary } from '@/projects/registry';

/** Gallery/Home card. Links to the detail view only when the project is available. */
export function ProjectCard({ project }: { project: ProjectSummary }) {
  const available = project.status === 'available';
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{project.category}</Badge>
        <Badge tone="accent">Synthetic data</Badge>
        {!available && <Badge>In development</Badge>}
      </div>
      <h3 className="mt-4 text-xl font-semibold">
        {available ? (
          <a href={hrefs.project(project.id)} className="hover:text-accent hover:underline">
            {project.title}
          </a>
        ) : (
          project.title
        )}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{project.summary}</p>
      <p className="mt-4 text-sm">
        <span className="font-medium">Business question: </span>
        {project.businessQuestion}
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Methods demonstrated">
        {project.methods.map((method) => (
          <li key={method}>{method}</li>
        ))}
      </ul>
    </Card>
  );
}
