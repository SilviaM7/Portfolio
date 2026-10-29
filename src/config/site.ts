/**
 * PERSONALIZE HERE. This is the one file that holds your identity, links, and headline copy.
 *
 * Rules:
 *   - Anything wrapped in [square brackets] is a placeholder. Replace it before publishing.
 *   - Optional links (linkedin, github, resume) are hidden automatically while they are empty strings.
 *   - Do not add employers, credentials, or numbers you cannot back up.
 *   - Education, experience, and skills live in ./resume.ts.
 */

export interface SiteConfig {
  /** Your name as it should appear in the header, footer, and page titles. */
  name: string;
  /** Short role line shown under your name. */
  role: string;
  /** Used in the browser tab title and share previews. */
  siteTitle: string;
  /** One-sentence site description (meta tag). */
  description: string;
  /** Hero headline. Keep it about the business problem, not about tools. */
  headline: string;
  /** Hero paragraph: two or three sentences. */
  intro: string;
  /** City/region or "Remote"; leave empty to hide. */
  location: string;
  contact: {
    /** Required for the Contact page. Replace the placeholder. */
    email: string;
    /** Full URL, e.g. https://www.linkedin.com/in/your-handle. Empty string hides the link. */
    linkedin: string;
    /** Full URL, e.g. https://github.com/your-username. Empty string hides the link. */
    github: string;
  };
  /** Short availability line shown on the Contact page; leave empty to hide. */
  availability: string;
}

export const site: SiteConfig = {
  name: '[Your Name]',
  role: 'Management Information Systems student · business analytics',
  siteTitle: '[Your Name] — Business analytics for AI investment, adoption, and value',
  description:
    'Portfolio of a Management Information Systems student: business analytics for AI investment, adoption, and value, shown through interactive analyses on clearly labeled synthetic data.',
  headline: 'Business analytics for AI investment, adoption, and value.',
  intro:
    'I turn business questions about AI spending, software licenses, and workflow pilots into validated data, clearly defined metrics, and recommendations with their limits stated. The projects below are interactive demonstrations built on synthetic data.',
  location: '',
  contact: {
    email: '[your-email@example.com]',
    linkedin: '',
    github: '',
  },
  availability: '',
};

/** True while a value is still an unfilled [placeholder]. Used to warn in the UI and keep placeholders out of links. */
export function isPlaceholder(value: string): boolean {
  return value.trim() === '' || /^\[.*\]$/.test(value.trim());
}
