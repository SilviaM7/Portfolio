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
  /** "professional" = paid/employment, "project" = personal or academic project, "coursework" = class work, "leadership" = leadership and community roles. */
  kind: 'professional' | 'project' | 'coursework' | 'leadership';
}

export interface ResumeConfig {
  /** File name inside public/documents (for example "Firstname-Lastname-Resume.pdf"). Empty hides the résumé links. */
  file: string;
  education: EducationEntry[];
  /** Certifications exactly as named on your résumé, with the date shown there. */
  certifications: string[];
  experience: ExperienceEntry[];
  /** Skills taken from your résumé. Leave empty until you fill them in. */
  skills: string[];
}

export const resume: ResumeConfig = {
  file: 'Silvia-Meica-Resume.pdf',
  education: [
    {
      school: 'Georgia Gwinnett College, Lawrenceville, GA',
      program: 'Bachelor of Science in Management Information Systems',
      dates: 'May 2026',
      details: [
        'GPA: 4.0',
        'Business Intelligence Certificate, May 2026',
        'Honors: Outstanding Student Award in MIS; Beta Gamma Sigma; President’s List, all semesters, 2022–2026',
      ],
    },
  ],
  certifications: ['IT Specialist Certification — Networking (ITS Certification), April 2026'],
  experience: [
    {
      organization: 'Academic project',
      title: 'Retail Sales & Pricing Analysis',
      dates: 'Jan – May 2026',
      kind: 'project',
      highlights: [
        'Analyzed retail sales data with SQL and Excel to examine revenue trends, pricing patterns, and product performance.',
        'Compared pricing and discount scenarios to assess potential revenue impact.',
        'Built interactive Power BI and Tableau dashboards comparing sales trends and product performance.',
      ],
    },
    {
      organization: 'Academic project',
      title: 'Travel Agency Database',
      dates: 'Jan – May 2026',
      kind: 'project',
      highlights: [
        'Designed an Oracle relational database using entity-relationship modeling and normalization.',
        'Created tables and constraints to maintain data integrity, and populated and updated records with SQL.',
        'Wrote multi-table joins and nested subqueries to retrieve related records for reporting.',
      ],
    },
    {
      organization: 'Academic project',
      title: 'Global Education & Economic Indicators',
      dates: 'Sep – Dec 2025',
      kind: 'project',
      highlights: [
        'Analyzed education and economic indicators across 50+ countries with Python, Pandas, and NumPy.',
        'Cleaned and transformed the datasets to resolve inconsistencies and support cross-country comparison.',
        'Communicated patterns with Matplotlib visualizations.',
      ],
    },
    {
      organization: 'Academic project',
      title: 'Housing Market Analytics',
      dates: 'Sep – Dec 2024',
      kind: 'project',
      highlights: [
        'Cleaned and standardized housing and demographic datasets in Excel, including records with FIPS codes.',
        'Integrated geographic and housing data into an interactive Power BI dashboard for regional analysis.',
        'Examined regional housing prices and demographic indicators to identify market trends.',
      ],
    },
    {
      organization: 'Dental clinic, Chisinau, Moldova',
      title: 'Office Administrator',
      dates: '2017 – 2019',
      kind: 'professional',
      highlights: [
        'Maintained electronic and paper patient records, verifying information and correcting discrepancies while preserving confidentiality.',
        'Coordinated patient registration, appointment scheduling, and daily administrative operations.',
      ],
    },
    {
      organization: 'SBA Torch Team, Georgia Gwinnett College',
      title: 'Ambassador',
      dates: 'May 2024 – May 2026',
      kind: 'leadership',
      highlights: ['Supported business networking and student engagement events with faculty, staff, and student organizations.'],
    },
    {
      organization: 'Junior Achievement of Georgia',
      title: 'Mentor',
      dates: 'Feb 2024',
      kind: 'leadership',
      highlights: ['Guided 10–15 students through the BizTown simulation, applying marketing, finance, and business operations concepts.'],
    },
  ],
  skills: [
    'SQL',
    'Python (Pandas, NumPy, Matplotlib)',
    'Power BI',
    'Tableau',
    'Excel (PivotTables, XLOOKUP)',
    'Data cleaning',
    'Exploratory analysis',
    'Oracle Database',
    'Relational data modeling',
    'Normalization, joins, subqueries, constraints',
  ],
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
