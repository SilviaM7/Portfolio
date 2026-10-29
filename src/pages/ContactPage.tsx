import { Page, PlaceholderNote } from '@/components/layout/PageShell';
import { buttonVariants } from '@/components/ui/button';
import { resume } from '@/config/resume';
import { isPlaceholder, site } from '@/config/site';
import { assetUrl, safeHttpsUrl } from '@/lib/url';
import { cn } from '@/lib/utils';

export function ContactPage() {
  const emailReady = !isPlaceholder(site.contact.email);
  const linkedin = safeHttpsUrl(site.contact.linkedin);
  const github = safeHttpsUrl(site.contact.github);
  const resumeHref = resume.file.trim() === '' ? null : assetUrl(`documents/${encodeURIComponent(resume.file.trim())}`);

  return (
    <Page title="Contact" narrow intro={site.availability !== '' ? <p>{site.availability}</p> : <p>The best way to reach me is by email.</p>}>
      {!emailReady && <PlaceholderNote>Set your email address in src/config/site.ts. Until then no email link is shown.</PlaceholderNote>}
      <ul className="mt-6 flex flex-wrap gap-3">
        {emailReady && (
          <li>
            <a href={`mailto:${site.contact.email}`} className={buttonVariants()}>
              Email me
            </a>
          </li>
        )}
        {linkedin !== null && (
          <li>
            <a href={linkedin} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }))}>
              LinkedIn<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        )}
        {github !== null && (
          <li>
            <a href={github} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }))}>
              GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        )}
        {resumeHref !== null && (
          <>
            <li>
              <a href={resumeHref} download className={cn(buttonVariants({ variant: 'outline' }))}>
                Download résumé
              </a>
            </li>
            <li>
              <a href={resumeHref} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'ghost' }))}>
                View résumé<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </>
        )}
      </ul>
      {emailReady && <p className="mt-6 text-sm text-muted-foreground">{site.contact.email}</p>}
      {site.location !== '' && <p className="mt-2 text-sm text-muted-foreground">{site.location}</p>}
    </Page>
  );
}
