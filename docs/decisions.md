# Architecture decisions

Short records of choices that are easy to forget. Newest last.

1. **Frontend only, hash routing.** GitHub Pages cannot rewrite URLs, so routes use `#/...` (`src/lib/routes.ts`). Cost: no per-project SEO or social previews.
2. **Pure calculations outside React.** `src/analysis/*` has no React or DOM imports so it can be unit-tested with Node alone and reconciled to the CSVs.
3. **Validation at the boundary.** `src/projects/*/schema.ts` normalizes CSV rows, drops and counts invalid rows, and keeps blank values as `null` (never 0).
4. **shadcn-style components written by hand.** The sandbox could not run the shadcn CLI, so `src/components/ui/*` follow the Base UI ("base") pattern manually. They can be replaced with `npx shadcn add <component>` in a networked environment. Do not mix Radix.
5. **No icon or font dependencies.** Two inline SVG icons and system font stacks keep dependencies minimal and avoid third-party requests.
6. **Colour tokens are checked.** `scripts/check-contrast.ts` computes WCAG contrast for every token pair in `src/index.css`.
7. **Data volume.** Spend data is scaled to 0.8× its original volume: the smallest size that still preserves the seeded retry-storm anomaly.
8. **Live-data provider.** Frankfurter (no key). Verified on 2026-10-31 in a real browser: response `{date, base, quote, rate}`, cross-origin reads allowed from an unrelated origin, and an unknown currency returns HTTP 422. The service still validates strictly and surfaces every failure.
9. **One pure view model per project.** `buildSpendView`, `buildAdoptionView`, and `buildWorkflowView` derive every KPI, chart series, and table row from the same filtered data. Tests assert that these reconcile under each filter.
10. **Scenarios that ignore some filters, said on screen.** The Adoption reclaim scenario ignores the department filter, because seat contracts are company-wide. The Workflow value scenario uses the full dataset, because software and one-time costs cannot be split across filter slices. Both pages state this next to the scenario.
11. **Estimated value vs cash, kept apart.** The Workflow scenario reports released time valued at a labor rate separately from a cash view, where only an explicit, visitor-chosen share becomes cash. Payback is shown for both.
12. **Live data stays separate.** Exchange rates are fetched only on a button press, cached for 10 minutes in `sessionStorage`, and never used in project calculations. If any currency fails, the whole load fails, so partial data is never shown as complete.
13. **Résumé is the only source of personal facts.** `src/config/site.ts` and `src/config/resume.ts` were filled from the owner's résumé; the owner chose to publish the PDF. Anything the résumé does not state (for example a GitHub URL) stays empty, and empty values hide their links.
