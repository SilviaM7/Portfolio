import type { ProjectCategory, ProjectSummary } from './registry';

export interface GalleryFilters {
  query: string;
  /** null = all categories. */
  category: ProjectCategory | null;
}

export const EMPTY_GALLERY_FILTERS: GalleryFilters = { query: '', category: null };

/** Every word typed must appear somewhere in the title, summary, question, category, tags, or methods (case-insensitive). */
export function filterProjects(projects: readonly ProjectSummary[], filters: GalleryFilters): ProjectSummary[] {
  const words = filters.query.toLowerCase().split(/\s+/).filter((w) => w !== '');
  return projects.filter((project) => {
    if (filters.category !== null && project.category !== filters.category) return false;
    const haystack = [project.title, project.summary, project.businessQuestion, project.category, ...project.tags, ...project.methods].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function categoriesOf(projects: readonly ProjectSummary[]): ProjectCategory[] {
  return [...new Set(projects.map((p) => p.category))];
}
