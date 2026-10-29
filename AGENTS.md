# AGENTS.md — Project rules for contributors and AI assistants

This is the single authoritative rules file for this repository. `CLAUDE.md` imports it; do not duplicate these rules elsewhere. These files **guide** contributors and AI assistants. They do not enforce quality by themselves — checks (type, lint, test, build) and human review do.

## What this project is

A frontend-only portfolio for an MIS student, positioned around **"Business analytics for AI investment, adoption, and value."** It demonstrates defining business questions, validating data, calculating meaningful metrics, weighing tradeoffs, and communicating recommendations. It is **not** an AI model-engineering showcase and must not present the owner as an experienced software engineer.

- Stack: React + Vite, strict TypeScript, Tailwind CSS, shadcn/ui (Base UI implementation), Recharts, Papa Parse, npm, GitHub Pages.
- Frontend only. No Next.js, server, database, authentication, or analytics/tracking.
- Personal content lives in `src/config/site.ts` (and `src/config/resume.ts`). Project registry lives in `src/projects/registry.ts`.

## Honesty rules (never break these)

- Never invent credentials, employers, achievements, metrics, dates, links, citations, provider prices, market statistics, or company outcomes.
- The résumé (when supplied) is the source of truth for personal facts. Missing facts use obvious placeholders (`[Your Name]`) in the config file. Ask about material contradictions.
- All project data is **synthetic**. Label it as such at the project summary and analysis level. Seeded patterns demonstrate methods; they are not empirical discoveries.
- Real provider prices or external statistics are used only with a verified source and effective/publication date recorded. Otherwise label rates "fictional assumptions".
- Never show mock API results as live data. Failures are shown honestly.
- Distinguish **observed (in the synthetic data)**, **synthetic demonstration**, **projection/scenario**, and **recommendation**. Do not imply causation from descriptive analysis.
- Do not describe the portfolio as "enterprise-certified", "audited", "production-proven", or as "WCAG compliant" without evidence. Claims of "enterprise grade", "industry standard", or "best practice" are never a substitute for evidence.

## "Enterprise grade code and content" — what this means here

Dependable, maintainable, accessible, reviewable work appropriate to a static frontend app.

Acceptance criteria:
- Strict TypeScript (`strict: true`) and clear domain types in `src/types/` or next to the module that owns them.
- CSV and API data are validated at the boundary (`src/data/`, `src/services/`). Components receive already-validated, typed data.
- Calculations live in `src/analysis/` as pure functions with no React imports.
- Small, cohesive modules. Explicit error handling (typed results or thrown `DataError`), never swallowed errors.
- No unexplained `any`, no `@ts-ignore`/`eslint-disable` without a one-line reason, no dead code, no unnecessary dependencies.
- Focused tests (`*.test.ts`) for financial calculations, aggregation, normalization, and filtering.
- Every financial metric defines **units, period, denominator, and assumptions** (see `docs/metrics.md` and each project's methodology panel).
- Do not treat missing values as zero. Do not average percentages; use weighted aggregates (numerator sums over denominator sums).

## "Industry standard"

- Follow current official docs for React, Vite, Tailwind, shadcn/ui (Base UI), Recharts, and GitHub Pages. Do not mix Radix and Base UI components. New shadcn components must be added with the Base UI base (`components.json` → `"base": "base"`; avoid `-b radix`).
- Use supported, compatible dependency versions. Commit `package-lock.json`. CI uses `npm ci`.
- Scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check` (all of them).
- Consistent formatting and descriptive names. Keep changes focused. Record consequential architectural decisions in `docs/decisions.md`.
- Do not add infrastructure merely to look sophisticated.

## "Best practice UI UX"

- Target WCAG 2.2 AA; verify applicable criteria; do not claim compliance without evidence (see `docs/accessibility.md` for the checklist and what has/has not been verified).
- Keyboard operation, visible focus, semantic landmarks, skip link, labeled controls, accessible validation messages.
- Readable contrast in both themes; touch targets at least 24×24 CSS px (prefer 44px for primary controls); responsive layouts.
- Loading, empty, error, retry, and success states wherever data is fetched or filtered.
- Consistent filter behavior: filters update **every** KPI, chart, and table in a project view. Provide a reset control and show active filters.
- Chart type fits the question. Show units, time ranges, sources, and active filters. No misleading axes, no unnecessary dual axes, no decorative charts, no color-only distinctions (use labels, patterns, or markers).
- Every chart has a heading, units, and an accessible text summary or data table.
- Respect `prefers-reduced-motion` and the saved theme preference.

## Security and privacy

- Treat CSV content and API responses as untrusted input. Validate and bound them.
- Never put secret keys or credentials in client code, `.env*` files, or build output. `VITE_*` variables are public.
- Never render untrusted HTML (`dangerouslySetInnerHTML` is prohibited).
- HTTPS only for APIs; document CORS requirements. No public CORS-proxy services.
- Network activity is explicit (user-initiated for the live-data demo). API failures are isolated and must not break the rest of the site.
- Use pseudonymous synthetic identifiers. Include no personal data in datasets.
- Do not add analytics or tracking by default.

## Scope and maintainability

- Preserve the frontend-only architecture.
- shadcn components (Base UI) for UI; Recharts for **all** charts.
- Prefer local state and straightforward composition. No global state library.
- Add a dependency only for a concrete need, and say why in the PR/commit.
- Keep personal content and project configuration easy to find and edit.
- Keep the README synchronized with the implementation.
- Adding a project = new folder under `src/projects/`, new CSVs in `public/data/<project-id>/`, one entry in `src/projects/registry.ts`. Reuse `src/components/project/*`.

## Dataset integrity

- Datasets are produced by `scripts/generate-data.ts` with a documented seed. Re-running it must produce byte-identical CSVs.
- Include realistic variation, seasonality, and a small number of **documented** data-quality issues. Document them in the project's data-quality notes and in `docs/data-dictionary.md`.
- Preserve valid relationships between CSVs (foreign keys). Keep files small enough for a responsive browser experience.
- Keep live API data separate from historical CSV assumptions.

## Definition of done

A change is complete when:
- Type, lint, test, and build checks pass.
- Metrics reconcile with source data (tests assert this).
- Filters update charts, KPIs, and tables consistently.
- Empty and invalid datasets are handled with a helpful message.
- GitHub Pages repository-subpath behavior is verified (`VITE_BASE=/portfolio/ npm run build`, then preview).
- Navigation, refreshed project links (hash routes), and CSV downloads work.
- Applicable mobile, keyboard, theme, and API states are checked.
- Documentation reflects the final implementation.

When reporting, list the checks actually performed and name anything unverified.
