# Portfolio: business analytics for AI investment, adoption, and value

A frontend-only portfolio (React + Vite + TypeScript + Tailwind, shadcn/ui on Base UI, Recharts, Papa Parse) hosted on GitHub Pages.
All project data is **synthetic**; see `AGENTS.md` for the project rules and `docs/modules.md` for the build plan and current status.

## Status

Built in modules (see `docs/modules.md`). **M1 (site shell) and M2 (project framework + AI Spend) are written**: Home, gallery, About, Contact, theme, hash routing, deploy workflow, and the AI Spend project view.
The Adoption and Workflow project views and the live-data page arrive in M3–M5. Data, validation, analysis, findings, and the live-data service
already exist with tests (`src/analysis`, `src/projects/*`, `src/services`).

> **Not yet verified in a full build.** The environment this was written in could not reach the npm registry, so dependencies were never installed:
> `npm run check` (type check, lint, tests, build) has **not** been run end to end, and `package-lock.json` does not exist yet.
> Run the steps under "First run" and fix anything they report before publishing.

## First run

Requires Node 22+ (`.nvmrc`).

```bash
npm install          # creates package-lock.json: commit it (CI uses npm ci)
npm run check        # typecheck + lint + tests + data check + contrast check + build
npm run dev          # http://localhost:5173
```

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

1. Push to a repository's `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy.yml` runs on every push to `main` (and manually): `npm ci`, type check, lint, tests, data and contrast checks, build, deploy.

The base path is set automatically. For local builds choose it with `VITE_BASE`:

| Site | URL | Build |
|---|---|---|
| User/organization site | `https://USERNAME.github.io/` | `npm run build` (default `/`) |
| Project site | `https://USERNAME.github.io/REPOSITORY/` | `VITE_BASE=/REPOSITORY/ npm run build` |

Check a subpath build locally: `VITE_BASE=/portfolio/ npm run build && npm run preview`, then open `http://localhost:4173/portfolio/`.
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
- **Deploy job says "environment protection" or "Pages not enabled"**: set Settings → Pages → Source to *GitHub Actions*.
- **`npm ci` fails in CI**: `package-lock.json` is missing or out of date. Run `npm install` locally and commit the lockfile.
- **Links to LinkedIn/GitHub/résumé missing**: the value in `src/config/*` is empty, a placeholder, or not an `https://` URL.
- **Theme flashes on load**: keep the inline script in `index.html`; it applies the saved theme before first paint.
