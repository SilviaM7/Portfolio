import { Page } from '@/components/layout/PageShell';
import { hrefs } from '@/lib/routes';

export function NotFoundPage({ title = 'Page not found', message }: { title?: string; message?: string }) {
  return (
    <Page title={title} narrow>
      <p className="text-muted-foreground">{message ?? 'That address does not match a page on this site.'}</p>
      <p className="mt-6 flex gap-4">
        <a href={hrefs.home} className="font-medium text-accent underline underline-offset-4">
          Home
        </a>
        <a href={hrefs.projects} className="font-medium text-accent underline underline-offset-4">
          Projects
        </a>
      </p>
    </Page>
  );
}
