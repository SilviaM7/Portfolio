/**
 * PERSONALIZE HERE. Résumé-derived content and the downloadable résumé file.
 *
 * The résumé is the source of truth for personal facts. Fill these in from it, in your own concise words.
 * Keep entries factual: do not add employers, dates, metrics, or credentials that are not on your résumé.
 * Empty lists are fine: the About page shows a clearly marked placeholder instead of inventing content.
 *
 * ── Replacing the downloadable résumé (no code changes needed) ──
 *   1. Save your approved PDF in public/documents/ with a professional name, e.g. Firstname-Lastname-Resume.pdf
 *   2. Set `file` below to that file name (just the name, not a path).
 *   3. Rebuild/redeploy. The "Download résumé" and "View résumé" links appear automatically and respect the
 *      GitHub Pages base path. While `file` is empty, both links stay hidden.
 *   Before publishing, check the PDF for sensitive details (home address, personal phone, references' contact details).
 */

export interface EducationEntry {
  school: string;
  /** Degree and major exactly as on your résumé. */
  program: string;
  /** e.g. "Expected May 2027" — copy the wording from your résumé. */
  dates: string;
  /** Optional: relevant coursework, honors, or GPA only if on your résumé. */
  details?: string[];
}

export interface ExperienceEntry {
  organization: string;
  title: string;
  dates: string;
  /** Concise outcome-focused bullets adapted from your résumé. No invented metrics. */
  highlights: string[];
  /** "professional" = paid/employment, "project" = personal or academic project, "coursework" = class work. */
  kind: 'professional' | 'project' | 'coursework';
}

export interface ResumeConfig {
  /** File name inside public/documents (for example "Firstname-Lastname-Resume.pdf"). Empty hides the résumé links. */
  file: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  /** Skills taken from your résumé. Leave empty until you fill them in. */
  skills: string[];
}

export const resume: ResumeConfig = {
  file: '',
  education: [
    {
      school: '[University name]',
      program: '[Degree, major — copy from résumé]',
      dates: '[Dates — copy from résumé]',
    },
  ],
  experience: [],
  skills: [],
};

/**
 * Methods demonstrated BY THE PROJECTS ON THIS SITE. These describe the work shown here, not job titles,
 * certifications, or years of experience, so they are safe to publish before the résumé is filled in.
 */
export const demonstratedSkills: { group: string; items: string[] }[] = [
  {
    group: 'Framing the question',
    items: ['Business question definition', 'Metric definitions with denominators', 'Assumption and limitation documentation'],
  },
  {
    group: 'Data quality',
    items: ['CSV validation and normalization', 'Handling missing values without defaulting to zero', 'Reconciling metrics to source data'],
  },
  {
    group: 'Analysis',
    items: ['Cost and utilization analysis', 'Budget variance and anomaly review', 'Break-even, payback, and sensitivity scenarios'],
  },
  {
    group: 'Communication',
    items: ['Interactive charts with accessible data tables', 'Findings kept separate from recommendations', 'Estimates labeled as estimates'],
  },
];
