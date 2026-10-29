# Architecture decisions

Short records of choices that are easy to forget. Newest last.

1. **Frontend only, hash routing.** GitHub Pages cannot rewrite URLs, so routes use `#/...` (`src/lib/routes.ts`). Cost: no per-project SEO or social previews.
2. **Pure calculations outside React.** `src/analysis/*` has no React or DOM imports so it can be unit-tested with Node alone and reconciled to the CSVs.
3. **Validation at the boundary.** `src/projects/*/schema.ts` normalizes CSV rows, drops and counts invalid rows, and keeps blank values as `null` (never 0).
4. **shadcn-style components written by hand.** The sandbox could not run the shadcn CLI, so `src/components/ui/*` follow the Base UI ("base") pattern manually. They can be replaced with `npx shadcn add <component>` in a networked environment. Do not mix Radix.
5. **No icon or font dependencies.** Two inline SVG icons and system font stacks keep dependencies minimal and avoid third-party requests.
6. **Colour tokens are checked.** `scripts/check-contrast.ts` computes WCAG contrast for every token pair in `src/index.css`.
7. **Data volume.** Spend data is scaled to 0.8× its original volume: the smallest size that still preserves the seeded retry-storm anomaly.
8. **Live-data provider.** Frankfurter (no key). Response shape beyond `rate` and browser CORS behavior were not verifiable from the build sandbox; the service validates strictly and surfaces failures.
