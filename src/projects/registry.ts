/**
 * PROJECT REGISTRY: the one list of projects shown on the Home page and in the gallery.
 *
 * To add a project:
 *   1. Put its CSVs in public/data/<id>/ (generate them in scripts/generate-data.ts so they stay reproducible).
 *   2. Create src/projects/<id>/ with schema.ts (validation), load.ts, findings.ts, and a view component.
 *   3. Add an entry below. `status: 'available'` makes the card link to the detail view; use 'in-development' until it works.
 * All data in this portfolio is synthetic; the gallery labels it automatically.
 */
export type ProjectCategory = 'Spend & cost' | 'Adoption & utilization' | 'Workflow value & quality';

export interface ProjectSummary {
  /** URL-safe id; used in the route (#/projects/<id>) and as the data folder name. */
  id: string;
  title: string;
  category: ProjectCategory;
  /** One-sentence description for cards. */
  summary: string;
  /** The business question the analysis answers. */
  businessQuestion: string;
  /** Keywords for gallery search. */
  tags: string[];
  /** Methods demonstrated, shown on cards. */
  methods: string[];
  status: 'available' | 'in-development';
}

export const projects: ProjectSummary[] = [
  {
    id: 'ai-spend',
    title: 'AI Spend & Consumption',
    category: 'Spend & cost',
    summary: 'Where AI spend comes from, how it compares with budget, and which changes might lower cost without hurting service.',
    businessQuestion: 'What drives AI spending, and which changes could improve cost efficiency without sacrificing service quality?',
    tags: ['cost', 'budget', 'tokens', 'anomalies', 'projection', 'scenarios'],
    methods: ['Budget variance', 'Cost per successful task', 'Anomaly review', 'Savings scenarios'],
    status: 'in-development',
  },
  {
    id: 'ai-adoption',
    title: 'AI Adoption & License Utilization',
    category: 'Adoption & utilization',
    summary: 'Whether paid AI software seats are used, and how contract terms limit what can be reclaimed.',
    businessQuestion: 'Are AI software licenses being used, and how should the company adjust procurement or enablement?',
    tags: ['licenses', 'seats', 'utilization', 'procurement', 'contracts', 'enablement'],
    methods: ['Utilization and cost per active seat', 'Cohort comparison', 'Contract-aware reclaim scenario'],
    status: 'in-development',
  },
  {
    id: 'ai-workflow',
    title: 'AI Workflow Value & Quality',
    category: 'Workflow value & quality',
    summary: 'Whether an AI-assisted workflow pilot saves enough time, at acceptable quality, to justify its cost.',
    businessQuestion: 'Under what conditions does an AI-assisted workflow produce enough value to justify its cost?',
    tags: ['pilot', 'quality', 'break-even', 'payback', 'sensitivity', 'labor'],
    methods: ['Time and quality comparison', 'Break-even and payback', 'Sensitivity analysis'],
    status: 'in-development',
  },
];

export function findProject(id: string): ProjectSummary | undefined {
  return projects.find((p) => p.id === id);
}
