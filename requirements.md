Build a complete, polished portfolio website for an MIS student focused on business analytics, data analysis, and translating data into business decisions.

I use AI to help build and maintain projects. Keep the code understandable, organized, and easy to update without requiring advanced programming knowledge. Implement the working website, not just a plan or mockup.

## Required stack

- React with Vite.
- TypeScript, using straightforward types and avoiding complex abstractions.
- Tailwind CSS.
- shadcn/ui using its Base UI implementation for interactive components. Follow current documentation: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- Recharts for all charts and data visualizations. shadcn chart wrappers are fine when they use Recharts.
- Papa Parse for CSV parsing.
- npm with a committed lockfile.
- GitHub Pages for hosting.

Use current, compatible stable versions. Verify current installation instructions rather than relying on outdated setup patterns. Do not mix Radix and Base UI implementations.

This is a purely frontend application. Do not add Next.js, a server, a database, authentication, or unnecessary infrastructure.

## Portfolio purpose and content

The audience is recruiters, hiring managers, and potential collaborators interested in business analytics and MIS.

Present me as someone who connects business questions, data, and practical recommendations. Avoid positioning me as an experienced software engineer or inventing credentials.

Create:

1. A homepage with a concise introduction, featured projects, skills, and clear links to explore my work.
2. A searchable project gallery with useful category filters.
3. Individual project detail views with working interactive analyses.
4. An About section.
5. A Contact section with configurable email, LinkedIn, GitHub, and résumé links.

Keep unknown personal details in one clearly documented configuration file. Use obvious placeholders for identity and links. Hide unavailable optional links rather than rendering broken buttons. Do not invent employers, certifications, or achievements.

## Design direction

Create a professional editorial portfolio with interactive analytical demonstrations—not a generic admin dashboard.

Use:

- Strong typography and readable content widths.
- A restrained neutral palette with one distinctive accent color.
- Clear visual hierarchy, generous whitespace, and subtle borders.
- Charts with consistent semantic colors and readable labels.
- Responsive layouts for mobile, tablet, and desktop.
- Light and dark modes with a saved preference.
- Subtle motion that respects reduced-motion settings.

Avoid excessive gradients, decorative charts, endless card grids, stock imagery, and unnecessary animations. Prioritize clarity and business storytelling.

## Demonstration projects

Create three complete projects using included, realistic synthetic CSV datasets:

1. Retail performance: revenue, profit margin, categories, regions, and monthly trends.
2. Customer retention: customer segments, retention or churn, and relevant business drivers.
3. Operations: fulfillment times, on-time delivery, and performance by location or category.

Clearly label all datasets and conclusions as demonstrations based on synthetic data.

Every project should follow:
Business question → dataset and assumptions → analysis → findings → recommendation → limitations.

Each project detail view should include:

- A concise business question and executive summary.
- Dataset source, field descriptions, and methodology.
- KPI cards calculated from the dataset.
- Two or three purposeful Recharts visualizations.
- Working filters that update every relevant chart, KPI, and table consistently.
- A sortable, paginated data table.
- A filter reset control.
- A download link for the source CSV.
- Findings and recommendations supported by the included data.
- Clear limitations and data-quality notes.

Generate actual CSV files. Calculate metrics and chart series from those files; do not hardcode separate numbers that can disagree with the analysis. Define metric formulas and denominators clearly. Avoid implying causation from descriptive analysis.

If written findings refer to the full dataset, label them accordingly so they are not confused with filtered results.

## CSV architecture

Store bundled CSV files in public/data and load them using URLs that respect Vite’s deployment base path.

Separate:

- CSV loading and parsing.
- Field validation and data normalization.
- Analysis calculations.
- Presentation components.

Handle missing fields, blank values, invalid numbers, malformed dates, and failed downloads gracefully. Do not silently treat missing values as zero. Use explicit date handling that avoids timezone shifts.

Provide loading, error, and empty states. An invalid dataset should produce a helpful message rather than crash the application.

Make adding a fourth project straightforward through a documented project registry, dataset configuration, and reusable components. Avoid designing a complicated generic analytics framework.

CSV upload functionality is not required for this first version.

## On-demand API capability

Include a small, working “Live data” demonstration that fetches information only when the visitor explicitly clicks a button.

Choose a public HTTPS API that supports browser requests through CORS and requires no secret key. Verify its current documentation before using it. Keep this example separate from the synthetic project datasets.

Include:

- An initial state explaining what will be requested.
- Loading and success states.
- A useful error message and retry action.
- A timeout and request cancellation.
- Protection against duplicate requests.
- A last-successful-update timestamp.
- Lightweight session caching and an explicit refresh control.
- Clear source attribution and units.

Keep API access in a small service module so I can replace the provider later. Validate the response before displaying it.

Never embed secret keys in frontend code or Vite environment variables. Explain in the README that frontend environment variables are public and APIs requiring secrets need a separate backend or proxy. Do not use a public CORS workaround service.

Never display mock API results as live data. If the request fails, show the failure honestly and keep the rest of the portfolio usable.

## GitHub Pages requirements

The production build must work on both:

- https://USERNAME.github.io/
- https://USERNAME.github.io/REPOSITORY/

Configure Vite’s base path with a clear, documented way to select the deployment target. Use import.meta.env.BASE_URL where appropriate for CSV files and other public assets. Avoid root-relative asset paths that break under a repository subdirectory.

Use hash-based routing for project detail views so direct links and refreshes work on GitHub Pages without server rewrite rules. Ensure navigation, section anchors, and the theme control work correctly with this routing approach.

Include a GitHub Actions workflow that:

- Runs on pushes to main and supports manual execution.
- Uses a supported Node LTS version compatible with the dependencies.
- Installs dependencies with npm ci.
- Runs type checking and the production build.
- Uploads dist and deploys it through the official GitHub Pages actions.
- Includes the required permissions and deployment environment.

Include meaningful page titles and metadata. Explain any relevant limitations of hash-based routes for search indexing and per-project social previews.

## Accessibility and performance

- Use semantic landmarks, a skip link, keyboard navigation, visible focus indicators, and properly labeled controls.
- Provide readable contrast in both themes.
- Ensure charts have descriptive headings, units, and an accessible textual summary or corresponding data table.
- Do not rely on color alone to distinguish information.
- Give responsive chart containers explicit usable dimensions.
- Format currency, percentages, and dates consistently.
- Lazy-load project analysis views when appropriate.
- Keep dependencies minimal and avoid unnecessary global state libraries.

## Verification

Run the available checks and fix failures:

- Type checking.
- Production build.
- Focused tests for important calculations, CSV normalization, and filtering.
- Verify that all displayed KPIs reconcile with the underlying data.
- Check the production build with a repository subpath.
- Check navigation, refreshed project links, CSV downloads, filters, sorting, pagination, theme switching, and API loading/error/retry states.
- Inspect desktop and mobile layouts if browser tools are available.

Do not claim checks passed unless you actually ran them. Clearly identify anything you could not verify.

## Deliverables

Deliver the complete working project, including:

- Source code and reusable components.
- Three synthetic CSV datasets.
- Working analysis views and the on-demand API example.
- GitHub Pages deployment workflow.
- A concise README covering local setup, deployment, personalizing the site, replacing CSVs, adding projects, changing the API provider, and troubleshooting common Pages issues.

Make reasonable choices and proceed without asking me to approve every detail. Use editable placeholders where personal information is missing. Keep the initial implementation focused and complete.

At the end, summarize what you built, what you verified, and the few values I need to personalize before publishing.

## Revised portfolio positioning and projects

Position this portfolio around “Business analytics for AI investment, adoption, and value.”

The goal is to demonstrate MIS skills: defining business questions, validating data, calculating meaningful metrics, evaluating tradeoffs, and communicating recommendations. Avoid presenting the portfolio as an AI model engineering showcase.

Replace the retail, retention, and operations examples with these three projects:

### 1. AI Spend & Consumption

Business question: What drives AI spending, and which changes could improve cost efficiency without sacrificing service quality?

Create related synthetic CSVs for usage events, historical model pricing, and monthly budgets.

Include fields such as:

- Date, department, use case, provider, model, and request identifier.
- Input, output, and cached token counts with explicitly documented billing definitions.
- Successful or failed request, latency, retry relationship, and task outcome.
- Effective-dated pricing assumptions and monthly departmental budgets.

Analyze:

- Spend by department, model, provider, and use case.
- Actual spend against budget.
- Cost per successful task, including attributable failed attempts and retries.
- Consumption trends and explainable cost anomalies.
- A clearly labeled spending projection with documented assumptions.
- Model-routing or consumption-reduction scenarios, presented as estimates rather than guaranteed savings.

Avoid double-counting cached tokens or retries. Use weighted aggregate rates rather than averaging percentages incorrectly.

### 2. AI Adoption & License Utilization

Business question: Are AI software licenses being used, and how should the company adjust procurement or enablement?

Create related synthetic CSVs for license assignments, product activity, and department-level headcount or eligibility.

Use pseudonymous employee identifiers and include no personal information.

Analyze:

- Assigned, eligible, and active users with explicit definitions.
- License utilization and cost per active user.
- Inactive paid seats using a clearly stated observation window.
- Adoption by department and assignment cohort.
- Opportunities to reclaim or reassign seats.
- Scenario-based savings that account for contract terms and renewal timing.

Do not assume low usage proves low business value. Explain limitations of activity-based measures and distinguish license assignment dates from actual activity.

### 3. AI Workflow Value & Quality

Business question: Under what conditions does an AI-assisted workflow produce enough value to justify its cost?

Create synthetic workflow records covering a baseline process and an AI-assisted pilot.

Include:

- Workflow type, complexity, period, and cohort.
- Handling time, review time, rework, quality outcome, and escalation.
- Labor-rate assumptions, software costs, implementation costs, and training costs.

Analyze:

- Time per completed task, including review and rework.
- Quality and escalation rates.
- Total cost per successful task.
- Break-even volume and payback scenarios.
- Sensitivity to adoption, time savings, quality, and labor assumptions.

Distinguish capacity released from cash savings. Do not describe estimated labor value as realized financial savings. Treat pre/post comparisons as descriptive unless the study design supports stronger conclusions.

### Dataset integrity and storytelling

- Use deterministic, reproducible dataset generation with a documented seed.
- Include realistic variation, seasonality, and a small number of documented data-quality issues.
- Preserve valid relationships between CSVs.
- Include a data dictionary with record grain, keys, units, missing-value rules, and metric definitions.
- Keep datasets small enough for a responsive browser experience.
- Clearly label synthetic data at the project summary and analysis levels.
- Explain that intentionally seeded patterns demonstrate analytical methods; they are not independent empirical discoveries.
- Cite verified public sources for external context and assumptions, including publication dates.
- Never fabricate sources, market statistics, provider prices, or company outcomes.
- When using real provider prices, record their effective date and source. Otherwise label rates as fictional assumptions.
- Keep live API information separate from historical CSV assumptions unless the visitor explicitly selects a scenario using it.
- Support recommendations with traceable calculations, tradeoffs, and limitations.

## Repository instructions: AGENTS.md and CLAUDE.md

Before implementation, create a root AGENTS.md containing the project rules below. Create a root CLAUDE.md that explicitly imports AGENTS.md using Claude Code’s supported import syntax, verified against current documentation.

Maintain one authoritative rules file rather than duplicating instructions that can drift. These files guide contributors and AI assistants; do not claim that they automatically enforce quality.

Include these principles and their concrete acceptance criteria:

### “Enterprise grade code and content”

For this portfolio, this means dependable, maintainable, accessible, and reviewable work appropriate to a static frontend application.

- Use strict TypeScript and clear domain types.
- Validate CSV and API data at application boundaries.
- Keep calculations independent of UI components.
- Use small, cohesive modules and explicit error handling.
- Avoid unexplained any types, suppressed errors, dead code, and unnecessary dependencies.
- Add focused tests for financial calculations, aggregation, normalization, and filtering.
- Never invent credentials, results, citations, or live-data claims.
- Every financial metric must define its units, period, denominator, and assumptions.
- Distinguish observed results, synthetic demonstrations, projections, and recommendations.

Do not describe the finished portfolio as enterprise-certified, audited, or production-proven.

### “Industry standard”

- Follow current official React, Vite, Tailwind, shadcn/Base UI, Recharts, and GitHub Pages documentation.
- Use supported, compatible dependency versions and commit the lockfile.
- Provide reproducible installation, type checking, linting, testing, and build scripts.
- Use consistent formatting and descriptive naming.
- Keep changes focused and document consequential architectural decisions.
- Use GitHub Actions for checks and Pages deployment.
- Do not add infrastructure merely to make the project appear sophisticated.

### “Best practice UI UX”

- Target WCAG 2.2 AA and verify applicable criteria; do not claim compliance without evidence.
- Support keyboard operation, visible focus, semantic structure, labeled controls, and accessible validation.
- Ensure readable contrast, usable touch targets, and responsive layouts.
- Provide loading, empty, error, retry, and success states where relevant.
- Preserve understandable navigation and consistent filter behavior.
- Use chart types that fit the analytical question.
- Show units, time ranges, sources, and active filters.
- Avoid misleading axes, unnecessary dual axes, decorative charting, and color-only distinctions.
- Provide accessible summaries or tables alongside visualizations.
- Respect reduced motion and saved theme preferences.

### Security and privacy

- Treat CSV content and API responses as untrusted input.
- Never embed secret keys or credentials in client code, environment files, or build output.
- Avoid rendering untrusted HTML.
- Use HTTPS APIs and document CORS requirements.
- Make network activity explicit and keep API failures isolated.
- Use synthetic identifiers and exclude personal data.
- Do not add analytics or tracking by default.

### Scope and maintainability

- Preserve the agreed frontend-only architecture.
- Use shadcn components backed by Base UI and Recharts for all charts.
- Prefer local state and straightforward composition.
- Add dependencies only for a concrete need.
- Keep personal content and project configuration easy to find and edit.
- Keep README instructions synchronized with the implementation.

### Definition of done

A change is complete when:

- Relevant type, lint, test, and build checks pass.
- Metrics reconcile with source data.
- Related filters update charts, KPIs, and tables consistently.
- Empty and invalid datasets are handled.
- GitHub Pages repository-subpath behavior is verified.
- Navigation, refreshed project links, and CSV downloads work.
- Applicable mobile, keyboard, theme, and API states are checked.
- Documentation reflects the final implementation.

Report checks actually performed and identify anything unverified. Never substitute “enterprise grade,” “industry standard,” or “best practice” claims for evidence.

## Populate the portfolio from my résumé

Read the résumé I provide and use it to populate my name, introduction, education, experience, skills, and relevant project descriptions.

- Treat the résumé as the source of truth for personal facts. Do not invent qualifications, accomplishments, metrics, dates, or links.
- Adapt résumé wording into concise website copy rather than copying every bullet.
- Position me accurately for MIS, business analytics, and related roles based on my actual background.
- Distinguish professional experience, coursework, and personal projects.
- Ask about material contradictions between the résumé and other supplied materials. Use editable placeholders for missing information.
- Keep personal content in the portfolio’s central configuration files.

### Downloadable résumé

- If I supply a PDF, preserve it unchanged and add a clearly labeled “Download résumé” link.
- If I supply another format, create a faithful, selectable-text PDF if conversion tools are available. Verify its layout and content before using it; otherwise explain that a PDF is needed.
- Store the approved public résumé in public/documents with a professional filename.
- Make the link respect Vite’s base path so it works on GitHub Pages.
- Provide a download link and an optional “View résumé” link.
- Verify that both links work in the production build.

Before publishing, flag sensitive details such as a full home address or references’ contact information. Do not silently modify the original résumé. If needed, prepare a separate public version for my review.

Document how I can replace the résumé later without changing application code.
