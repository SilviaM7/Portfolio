import { ProjectCard } from '@/components/ProjectCard';
import { Page } from '@/components/layout/PageShell';
import { projects } from '@/projects/registry';

/** M1 preview of the gallery. Search and category filters arrive with the project framework (module M2). */
export function ProjectsPage() {
  return (
    <Page title="Projects" intro="Business analytics for AI investment, adoption, and value. Every dataset here is synthetic and labeled as such.">
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </Page>
  );
}
