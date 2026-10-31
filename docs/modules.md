# Build plan: modules

Each module ends in something that builds, deploys, and works on its own. Do them in order; stop after any module.
"Done" for every module follows AGENTS.md (type, lint, test, build, base-path check, and the specific checks below).

## Already complete (shared back end, no UI)
- Rules: `AGENTS.md`, `CLAUDE.md` (imports AGENTS.md).
- Seeded synthetic data (`scripts/generate-data.ts`, seed 20260930), 9 CSVs, ~0.96 MB total.
- Validation + analysis + generated findings for all three projects; live-data service. 119 tests pass.
- Site/résumé config placeholders (`src/config/`).

## M1 — Site shell (deployable portfolio, no projects yet) — WRITTEN, awaiting first full build
Vite/Tailwind/shadcn(Base UI) setup, `npm install` + lockfile, hash router, layout, skip link, light/dark theme,
Home, About, Contact (hidden-when-empty links, résumé links), GitHub Actions workflow, README basics.
Checks: `npm run check`, subpath build `VITE_BASE=/portfolio/`, keyboard/theme/mobile pass.

## M2 — Project framework + AI Spend (first complete project) — WRITTEN, awaiting your `npm run check`
Shared components (KPI cards, chart card with data table, filter bar, sortable/paginated table, quality and
methodology panels, loading/error/empty states), gallery with search and category filters, AI Spend detail view.
Checks: KPIs reconcile to CSV, filters update every chart/KPI/table, CSV download, refreshed deep link.
Verified in the build sandbox (shimmed Recharts/Base UI/Papa Parse, headless Chromium): data loads, 8 KPIs render, department and
provider filters update KPIs/tables/budget variance, reset, invalid date range alert, tabs, table sort and pagination, and the
by-model chart table sums to the KPI. NOT verified there: TSX type check, lint, Tailwind styling, real Recharts rendering, mobile layout.

## M3 — AI Adoption & License Utilization
Detail view only (reuses M2 components): window selector, utilization charts, reclaim scenario with contract terms.

## M4 — AI Workflow Value & Quality
Detail view only: complexity and trend charts, scenario controls, break-even/payback, sensitivity table.

## M5 — Live data, polish, and final verification
Live-data page (button-triggered, loading/error/retry, cache, timestamp), accessibility and contrast pass,
`docs/` (metrics, data dictionary, decisions, accessibility), final README, verification report.

## Known blockers (as of M1)
- The authoring sandbox blocked the npm registry, so dependencies were never installed. M1 code has NOT been type-checked
  (TSX), linted, or built. First action in any networked environment: `npm install`, commit `package-lock.json`, run `npm run check`, fix what it reports.
- No résumé was supplied; personal content is placeholders until it is.
- Live-data API: browser CORS and the full response shape are unverified (see README and `docs/decisions.md`).
