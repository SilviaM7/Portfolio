# Handover: AI portfolio (GitHub Pages)

Last updated: 2026-10-31. Local repo: `/Users/sm/github/Portfolio` (git repository). Project docs also live in the Claude Project "My Portfolio Github".

## 1. What this is
A frontend-only portfolio for an MIS student, positioned as "Business analytics for AI investment, adoption, and value."
Stack: React + Vite + strict TypeScript, Tailwind v4, shadcn/ui on Base UI (no Radix), Recharts for all charts, Papa Parse, npm with committed lockfile, hash routing, GitHub Actions deploy to Pages, light/dark theme.
Source of truth for requirements: `requirements.md`. Rules for AI assistants: `AGENTS.md` (CLAUDE.md imports it). Read both first. Key rules: all data is synthetic and labeled; never invent credentials, metrics, prices or links; never treat missing values as 0; weighted aggregates, not averaged percentages; no analytics; honest API failures.

## 2. How the user wants to work
- Build in small modules, each a working deliverable, to save credits. Keep data small.
- Plan lives in `docs/modules.md` (copy in Project: `claude/build-plan-modules.md`).
- Run `npm run check` before calling anything done, and report only checks actually run.

## 3. Status
| Module | State |
|---|---|
| Back end (seeded data, validation, analysis, findings, live-data service) | Done. 149 unit tests pass. |
| M1 Site shell (Home, Projects, About, Contact, theme, router, deploy workflow) | Done. User runs it locally. |
| M2 Project framework + AI Spend view | Done and committed (`d2f0519`). Visual review of `#/projects/ai-spend` still pending. |
| M3 AI Adoption & License Utilization view | Done. User ran checks and reviewed it; committed (`273072d`). |
| M4 AI Workflow Value & Quality view | Done. User reviewed it; committed (`b6182f9`). |
| M5a About/Contact from résumé | Written 2026-10-31, uncommitted. Verified: typecheck, lint, 172 tests. Awaiting the user's visual review of `#/about` and `#/contact`. |
| M5b Live-data page | Not started. |
| M5c Accessibility pass, `docs/metrics.md`, `docs/data-dictionary.md`, final README, verification report | Not started. |

Registry (`src/projects/registry.ts`): all three projects are `status: 'available'`.

M3 files: `src/projects/ai-adoption/{viewModel.ts, viewModel.test.ts, content.ts, AdoptionCharts.tsx, AdoptionView.tsx}`, plus `buildAdoptionExecutiveSummary` in `findings.ts`. Design choice: the reclaim scenario ignores the department filter (contracts are company-wide) and says so on screen; everything else follows all filters.

M4 files: `src/projects/ai-workflow/{viewModel.ts, viewModel.test.ts, content.ts, WorkflowCharts.tsx, WorkflowView.tsx}`, plus `buildWorkflowExecutiveSummary` in `findings.ts` (also fixed a stray `}` in the break-even finding). Design choice: the value scenario (break-even, payback, sensitivity) uses the full dataset, because program costs cannot be split across filter slices; the page says so.

## 4. Architecture to reuse for M3 and M4
- Pure analysis: `src/analysis/{common,spend,adoption,workflow}.ts` (no React), with tests.
- Validation at the boundary: `src/projects/<id>/schema.ts`; loaders `load.ts`; generated findings `findings.ts` (tagged observed / scenario / recommendation).
- One pure view-model function per project (see `src/projects/ai-spend/viewModel.ts`: `buildSpendView(data, filters)`) so KPIs, charts and tables always reconcile. Do the same for adoption and workflow.
- View components: copy the pattern of `src/projects/ai-spend/SpendView.tsx` (default export; `useDataset(load)` + `AsyncState`), `SpendCharts.tsx`, `content.ts` (static field/definition/limitation text). Register the view in `src/projects/views.ts` (lazy import).
- Shared UI in `src/components/project/*` (KpiCard, ChartCard with data table, FilterBar/SelectField, DataTable, FindingsPanel, QualityPanel, ProjectFrame, AsyncState) and `src/components/charts/*`.
- Adoption model: seat-based, observation window, statuses active/inactive/new/unknown, contract notice deadlines and seat floors. Workflow model: estimated labor value vs cash savings, complexity standardization, scenario base per level, break-even, payback, sensitivity (`sensitivity` returns 19 rows).
- Data: `scripts/generate-data.ts` (seed 20260930). `npm run generate:data` / `npm run check:data` (must stay byte-identical). 9 CSVs in `public/data/`, about 0.96 MB.
- Routing: hash routes. In-page jumps are buttons calling `scrollToId`, not `#anchors`. Vite base via `VITE_BASE`; use `assetUrl()`.

## 5. Known gaps and risks
- Things I could not verify (sandbox had no npm registry): real Recharts rendering, Tailwind styling, mobile layout, dark-mode look, ESLint locally (user found 4 errors, since fixed). I did verify behaviour in headless Chromium with shimmed libraries: filters, KPI reconciliation, sort/pagination, tabs, reset, invalid-range alert.
- Live-data service (Frankfurter `/v2/rate/USD/{EUR|GBP|JPY}`): CORS and full response shape unverified; it relies only on `rate` (optional `date`). Needs a real browser test in M5.
- GitHub Pages base-path behaviour (`VITE_BASE=/portfolio/ npm run build`, then preview) not yet verified by the user.
- Résumé: `Silvia_Meica.pdf` (repo root) is the source for `src/config/site.ts` and `src/config/resume.ts`, filled in M5a. The user chose to publish it as is (phone number included) at `public/documents/Silvia-Meica-Resume.pdf`. The résumé says *graduate* (BS MIS, May 2026), so site copy says graduate, not student. GitHub link intentionally empty: the user will add the URL later in `site.ts`. Never invent personal facts.
- Not yet done from the original list: h1 focus is handled in `ProjectHeader`; adoption/workflow need the same. Add `docs/metrics.md` and `docs/data-dictionary.md` in M5.

## 6. Lessons learned (avoid repeating)
- Claude's cloud sandbox and the desktop Linux shell may have no npm registry access. Typecheck and lint run from the Mac's `node_modules` (pure JS); tests can be compiled with `tsc` to ESM and run with `node --test` plus a small resolve hook for `@/` and extensionless imports. `vite build` cannot run there (native binaries).
- When updating from a zip, use terminal `unzip -o <zip> -d /Users/sm/github/Portfolio`. Do NOT drag folders in Finder: "Replace" deletes sibling files (this happened once; restored with `git ls-files -d -z | xargs -0 git checkout --`).
- Findings text must be generated from computed values and stay neutral; no hardcoded conclusions or counts in static content.
- Blank values stay `null`, never 0.

## 7. Next actions, in order
1. User reviews `#/about` and `#/contact` (M5a), then commit.
2. `VITE_BASE=/portfolio/ npm run build && npm run preview`: confirm deep links and CSV downloads.
3. M5b: live-data page. M5c: accessibility pass, `docs/metrics.md`, `docs/data-dictionary.md`, final README, verification report.
4. Commit after each module's checks pass.

## 8. Starting prompt for the next session
> Read `HANDOVER.md`, `AGENTS.md`, `requirements.md` and `docs/modules.md` in this repo. M1–M4 and M5a are done and checked. Continue with M5b (live-data page), then M5c (accessibility pass, docs, README, verification report). Run `npm run check` before reporting done.
