import { ProjectCard } from '@/components/ProjectCard';
import { buttonVariants } from '@/components/ui/button';
import { demonstratedSkills } from '@/config/resume';
import { site } from '@/config/site';
import { hrefs } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { projects } from '@/projects/registry';

const STEPS = ['Business question', 'Dataset and assumptions', 'Analysis', 'Findings', 'Recommendation', 'Limitations'];

export function HomePage() {
  return (
    <div className="fade-in">
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">{site.role}</p>
        <h1 data-route-heading tabIndex={-1} className="mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
          {site.headline}
        </h1>
        <p className="mt-6 max-w-prose text-lg text-muted-foreground">{site.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={hrefs.projects} className={buttonVariants()}>
            Explore the projects
          </a>
          <a href={hrefs.contact} className={cn(buttonVariants({ variant: 'outline' }))}>
            Get in touch
          </a>
        </div>
      </section>

      <section aria-labelledby="featured-title" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="featured-title" className="text-2xl font-semibold">
          Featured projects
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Three interactive analyses on synthetic data. Each follows the same path, from the business question to the limits of what the data can say.
        </p>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="approach-title" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="approach-title" className="text-2xl font-semibold">
          How each analysis is structured
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {STEPS.map((step, index) => (
            <li key={step} className="rounded-lg border border-border bg-card p-4 text-sm">
              <span className="block text-xs text-muted-foreground">Step {index + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="skills-title" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="skills-title" className="text-2xl font-semibold">
          Methods demonstrated in these projects
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {demonstratedSkills.map((group) => (
            <div key={group.group}>
              <h3 className="text-base font-semibold">{group.group}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm">
          <a href={hrefs.about} className="font-medium text-accent underline underline-offset-4">
            More about me
          </a>
        </p>
      </section>
    </div>
  );
}
