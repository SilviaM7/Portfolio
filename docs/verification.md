# Verification report

What was checked before release, how it was checked, and what remains unverified. Entries are added as checks are performed and are never written ahead of time.

## Release candidate: 2026-10-31 (modules M1–M5)

### Automated checks

| Check | Result | Where it ran |
|---|---|---|
| `npm run typecheck` (strict TypeScript) | Pass | Owner's Mac `node_modules`, 2026-10-31 |
| `npm run lint` (ESLint + `jsx-a11y` + React hooks) | Pass | Same |
| `npm test` | Pass: 174 tests | Compiled with `tsc` and run with `node --test`, because `tsx` needs a native binary the authoring shell lacked |
| `npm run check:data` | Pass: 9 datasets match a fresh generation (seed 20260930) | Same as tests |
| `npm run check:contrast` | Pass: all token pairs meet their minimum | Same as tests |
| `npm run build` | **Not run by the author** (the authoring shell has no native build binaries). The owner was asked to run `npm run check` with each module. CI runs it on every deploy. | Owner's Mac / CI |
| Full `npm run check` in CI | Runs on every push in `.github/workflows/deploy.yml`. **First green run not yet confirmed**: Pages was not enabled at the time of writing | GitHub Actions |

### What the tests assert

- **Calculations:** spend pricing (effective-dated prices, cached tokens never double-counted, retries and failures attributed to tasks); adoption seat classification (window, grace period, trial activity, telemetry gaps); workflow time, quality, standardization, break-even, payback, and sensitivity.
- **Reconciliation:** for each project and across several filter combinations, the KPIs equal the table rows, every grouped chart sums to the KPIs, and rates are ratios of sums.
- **Validation:** duplicates, impossible values, and coverage gaps are dropped and counted; blank values stay `null` and are never read as 0.
- **Findings text:** generated from computed values, neutral, and labeled observed, scenario, or recommendation.
- **Live-data service:** HTTPS only, no credentials sent, a shared in-flight request, cache expiry and corruption handling, timeout, cancel, HTTP / network / invalid-payload errors, all-or-nothing loading, and parsing of the exact response captured from the provider.

### Manual checks

| Check | Result | Evidence |
|---|---|---|
| Live-data provider contract | Pass | 2026-10-31, built-in browser: Frankfurter docs show `/v2/rate/{base}/{quote}` → `{date, base, quote, rate}`. A live request matched. |
| Live-data CORS | Pass | 2026-10-31: from `https://example.com`, all three pairs returned HTTP 200 with response type `cors`, so the bodies were readable. An unknown currency returned HTTP 422. |
| Project pages, About, Contact, Live data | Reviewed by the owner | Owner ran the site locally and approved each module (2026-10-31). |
| Personal content | Pass | Every About and Contact fact traced to the owner's résumé. The GitHub link is intentionally empty until the owner adds it. |
| Honesty review | Pass | Synthetic labels appear on every project summary and analysis. Prices are marked fictional. Scenario results are labeled estimates. No invented credentials, metrics, sources, or live-data claims. |

### Not yet verified

These checks are planned once the site is live on GitHub Pages:

- [ ] Pages deployment: the workflow succeeds and `https://silviam7.github.io/Portfolio/` loads.
- [ ] Deep links and refresh on `#/projects/<id>` and `#/live-data` under the `/Portfolio/` base path; CSV and résumé downloads.
- [ ] Keyboard-only walkthrough of every page; screen-reader spot check.
- [ ] 200% zoom, 320 px reflow, phone layout, dark mode on the live site.
- [ ] Live data from the real site origin (`silviam7.github.io`).
