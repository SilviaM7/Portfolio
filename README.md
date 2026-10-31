# Silvia Meica: business analytics for AI investment, adoption, and value

A frontend-only portfolio (React + Vite + strict TypeScript + Tailwind, shadcn/ui on Base UI, Recharts, Papa Parse) hosted on GitHub Pages.
Three interactive projects show how business questions about AI spend, license adoption, and workflow pilots turn into validated data, defined metrics, scenarios, and recommendations with stated limits.
All project data is **synthetic** and labeled as such. Project rules for contributors and AI assistants are in `AGENTS.md`.

## What is on the site

| Page | Route | What it shows |
|---|---|---|
| Home, Projects | `#/`, `#/projects` | Introduction and a searchable, filterable project gallery |
| AI Spend & Consumption | `#/projects/ai-spend` | Spend drivers, budget variance, cost per completed task, anomalies, illustrative projection, savings scenarios |
| AI Adoption & License Utilization | `#/projects/ai-adoption` | Seat utilization over a selectable window, cohort and department adoption, a contract-aware reclaim scenario |
| AI Workflow Value & Quality | `#/projects/ai-workflow` | Baseline vs AI-assisted time and quality, break-even, payback (estimated value vs cash), sensitivity |
| Live data | `#/live-data` | Current USD reference exchange rates, fetched only when the visitor asks |
| About, Contact | `#/about`, `#/contact` | Résumé-based background, contact links, résumé download |

Every project page has an executive summary, the dataset with downloads, field and metric definitions, filters that update every KPI, chart, and table, charts with text summaries and data tables, generated findings, a recommendation, limitations, and a data-quality report.

## Documentation

| File | Contents |
|---|---|
| `docs/metrics.md` | Every metric with unit, period, denominator, and assumptions |
| `docs/data-dictionary.md` | Each CSV's grain, keys, columns, units, missing-value rules, and seeded issues |
| `docs/decisions.md` | Architecture decisions and their trade-offs |
| `docs/accessibility.md` | Accessibility checklist: what is verified and what is not |
| `docs/verification.md` | What was checked before release, how, and what remains unverified |
| `docs/modules.md`, `docs/HANDOVER.md` | Build plan and handover notes |

## First run

Requires Node 22+ (`.nvmrc`).

```bash
npm ci               # installs exactly what package-lock.json lists (same as CI)
npm run check        # typecheck + lint + tests + data check + contrast check + build
npm run dev          # http://localhost:5173
```

After changing dependencies, run `npm install` and commit the updated `package-lock.json`.

Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `generate:data`, `check:data`, `check:contrast`, `check`.

## Personalize (the only files you need to edit)

| What | File |
|---|---|
| Name, headline, intro, email, LinkedIn, GitHub | `src/config/site.ts` |
| Education, experience, skills, résumé file name | `src/config/resume.ts` |
| Projects shown on Home and in the gallery | `src/projects/registry.ts` |

Anything in `[square brackets]` is a placeholder. Empty LinkedIn/GitHub/résumé values hide those links. Only `https://` links are rendered.
Fill in education and experience **from your résumé**; nothing is invented for you.

### Replacing the résumé (no code changes)

1. Put your approved PDF in `public/documents/` with a professional name, for example `Firstname-Lastname-Resume.pdf`.
2. Set `file: 'Firstname-Lastname-Resume.pdf'` in `src/config/resume.ts`.
3. Rebuild. "Download résumé" and "View résumé" appear on the Contact page and respect the Pages base path.

Before publishing, check the PDF for a full home address, a personal phone number, or references' contact details.

## Deploy to GitHub Pages

1. Make the repository public (GitHub Pages on a free account only publishes from public repositories) and push to `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy.yml` runs on every push to `main` (and manually): `npm ci`, type check, lint, tests, data and contrast checks, build, deploy.

The base path is set automatically. For local builds choose it with `VITE_BASE`:

| Site | URL | Build |
|---|---|---|
| User/organization site | `https://USERNAME.github.io/` | `npm run build` (default `/`) |
| Project site | `https://USERNAME.github.io/REPOSITORY/` | `VITE_BASE=/REPOSITORY/ npm run build` |

Check a subpath build locally: `VITE_BASE=/Portfolio/ npm run build && npm run preview`, then open `http://localhost:4173/Portfolio/` (the path must match the repository name, including capitals).
`VITE_BASE` is only a URL path, not a secret.

### Hash routing: what to know

Routes look like `https://USERNAME.github.io/REPOSITORY/#/projects/ai-spend`. GitHub Pages only ever serves the root file, so deep links and refreshes work without rewrite rules.
Trade-offs: search engines generally ignore the part after `#`, so individual project pages are not indexed separately, and every route shares one set of
social-preview tags (from `index.html`). In-page jump links on this site are buttons, not `#section` anchors, because the hash carries the route.

## Data

Synthetic CSVs live in `public/data/<project-id>/` and are generated deterministically (seed `20260930`) by `scripts/generate-data.ts`.
`npm run generate:data` rewrites them; `npm run check:data` fails if the committed files differ from a fresh generation.
Total size is about 1 MB. Provider names, model names, prices, products, and headcounts are fictional.

## Live data

`#/live-data` fetches current USD reference rates (EUR, GBP, JPY) from [Frankfurter](https://frankfurter.dev), a free public API with no key.
Requests are sent only when the visitor presses the button, without cookies, with an 8-second timeout, and are cached in `sessionStorage` for 10 minutes.
If any pair fails, nothing is shown as complete: the page explains the failure and offers a retry, and the rest of the site is unaffected.
Endpoint, response shape (`date`, `base`, `quote`, `rate`), and browser CORS access from an unrelated origin were verified on 2026-10-31.
These rates are never used in the project analyses. The provider lives only in `src/services/exchangeRates.ts`; swapping it means editing that file and its test.

## Security and privacy

No secrets belong in this repository. Frontend code and `VITE_*` environment variables are **public** in the built site. An API that requires a secret key
needs a separate backend or proxy; do not put the key here, and do not use public CORS-proxy services. No analytics or tracking is included.

## Troubleshooting

- **Blank page or 404 for scripts/CSS on Pages**: the base path is wrong. Rebuild with the right `VITE_BASE` (the workflow does this automatically).
- **"Site not found" at the Pages URL**: Pages is not enabled yet, the repository is private on a free account, or the last workflow run failed (see the Actions tab).
- **Deploy job says "environment protection" or "Pages not enabled"**: set Settings → Pages → Source to *GitHub Actions*.
- **`npm ci` fails in CI**: `package-lock.json` is missing or out of date. Run `npm install` locally and commit the lockfile.
- **Links to LinkedIn/GitHub/résumé missing**: the value in `src/config/*` is empty, a placeholder, or not an `https://` URL.
- **Theme flashes on load**: keep the inline script in `index.html`; it applies the saved theme before first paint.
