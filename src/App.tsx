import { useEffect } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SkipLink } from '@/components/layout/SkipLink';
import { site } from '@/config/site';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { findProject } from '@/projects/registry';
import { useRoute } from '@/lib/router';
import type { Route } from '@/lib/routes';

function pageTitle(route: Route): string {
  switch (route.name) {
    case 'home':
      return site.siteTitle;
    case 'projects':
      return `Projects — ${site.name}`;
    case 'project':
      return `${findProject(route.id)?.title ?? 'Project'} — ${site.name}`;
    case 'about':
      return `About — ${site.name}`;
    case 'contact':
      return `Contact — ${site.name}`;
    case 'live-data':
      return `Live data — ${site.name}`;
    case 'not-found':
      return `Page not found — ${site.name}`;
  }
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'projects':
      return <ProjectsPage />;
    case 'about':
      return <AboutPage />;
    case 'contact':
      return <ContactPage />;
    case 'project':
      return <ProjectDetailPage id={route.id} />;
    case 'live-data':
      return <NotFoundPage title="Live data" message="The live-data demonstration is not available yet." />;
    case 'not-found':
      return <NotFoundPage />;
  }
}

export default function App() {
  const route = useRoute();
  const routeKey = route.name === 'project' ? `project:${route.id}` : route.name;

  // On every navigation: set the document title, return to the top, and move focus to the page heading
  // so keyboard and screen-reader users land at the start of the new content.
  useEffect(() => {
    document.title = pageTitle(route);
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('[data-route-heading]')?.focus({ preventScroll: true });
    // routeKey captures every change that matters; `route` itself is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return (
    <>
      <SkipLink />
      <SiteHeader route={route} />
      <main id="main" tabIndex={-1}>
        {renderRoute(route)}
      </main>
      <SiteFooter />
    </>
  );
}
