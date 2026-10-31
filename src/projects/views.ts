/**
 * Detail views, loaded on demand (code splitting) so the home page does not download chart code.
 * To add a project view: create src/projects/<id>/<Name>View.tsx with a default export, then add one line here.
 * Kept separate from registry.ts so the registry stays plain data that tests can import without React.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const projectViews: Record<string, LazyExoticComponent<ComponentType>> = {
  'ai-spend': lazy(() => import('./ai-spend/SpendView')),
  'ai-adoption': lazy(() => import('./ai-adoption/AdoptionView')),
  'ai-workflow': lazy(() => import('./ai-workflow/WorkflowView')),
};
