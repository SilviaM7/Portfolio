import { Page, PlaceholderNote, Section } from '@/components/layout/PageShell';
import { demonstratedSkills, resume } from '@/config/resume';
import { isPlaceholder, site } from '@/config/site';

const KIND_LABEL = { professional: 'Professional experience', project: 'Project', coursework: 'Coursework' } as const;

export function AboutPage() {
  const educationFilled = resume.education.some((e) => !isPlaceholder(e.school));
  return (
    <Page title="About" narrow intro={<p>{site.intro}</p>}>
      <Section title="Education">
        {!educationFilled && <PlaceholderNote>Add your education in src/config/resume.ts, copying the wording from your résumé.</PlaceholderNote>}
        <ul className="mt-4 space-y-4">
          {resume.education.map((entry) => (
            <li key={`${entry.school}-${entry.program}`}>
              <p className="font-medium">{entry.school}</p>
              <p className="text-muted-foreground">
                {entry.program} · {entry.dates}
              </p>
              {entry.details !== undefined && entry.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Experience">
        {resume.experience.length === 0 ? (
          <PlaceholderNote>Add your experience, coursework, and personal projects in src/config/resume.ts. Nothing is shown here until you do, so no experience is implied.</PlaceholderNote>
        ) : (
          <ul className="space-y-6">
            {resume.experience.map((entry) => (
              <li key={`${entry.organization}-${entry.title}`}>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{KIND_LABEL[entry.kind]}</p>
                <p className="font-medium">
                  {entry.title}, {entry.organization}
                </p>
                <p className="text-sm text-muted-foreground">{entry.dates}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Skills">
        {resume.skills.length === 0 ? (
          <PlaceholderNote>Add the skills listed on your résumé in src/config/resume.ts.</PlaceholderNote>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <li key={skill} className="rounded-full border border-border bg-muted px-3 py-1 text-sm">
                {skill}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-8 text-lg font-semibold">Methods shown in the portfolio projects</h3>
        <p className="mt-1 text-sm text-muted-foreground">These describe the work on this site, not job titles or certifications.</p>
        <dl className="mt-4 space-y-4">
          {demonstratedSkills.map((group) => (
            <div key={group.group}>
              <dt className="font-medium">{group.group}</dt>
              <dd className="text-sm text-muted-foreground">{group.items.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="How I approach the projects">
        <p className="max-w-prose">
          Each project starts with a business question, states the dataset and assumptions, defines every metric with its denominator, and keeps observed results, scenario estimates, and recommendations separate. Datasets are
          synthetic and seeded with known patterns, so the projects demonstrate methods; they are not independent empirical discoveries.
        </p>
      </Section>
    </Page>
  );
}
