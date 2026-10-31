# Accessibility status (target: WCAG 2.2 AA)

This is a checklist, not a compliance claim. **Verified** means checked with the evidence named. Everything else is not yet verified.

## Verified by automated checks (every `npm run check` and every deploy)
- Colour-token contrast in light and dark themes: `npm run check:contrast` (text ≥ 4.5:1; focus ring and chart series ≥ 3:1).
- `eslint-plugin-jsx-a11y` rules in `npm run lint`: labelled controls, valid ARIA, no click handlers on non-interactive elements, safe `target="_blank"` links.

## Verified by code review (2026-10-31)
- One `h1` per page; focus moves to it on every route change, including project detail pages (`data-route-heading`).
- Skip link to `main`; labelled `nav`; `aria-current` on the active link; theme toggle exposes its state.
- Every form control has a visible label: filters, window and dimension selects, sliders (each shows its value in an `<output>`), number inputs, and checkboxes in a `fieldset` with a `legend`.
- Invalid input (date range, workflow volume, converter amount) shows a red message with an icon and a hidden "Error:" label (`role="alert"`). The field gets `aria-invalid`, a red outline, and `aria-describedby` pointing to the message. Warnings (yellow) and successes (green) use `role="status"` with their own icon and label.
- Every chart has a heading, units and period in its subtitle, a generated text summary, and a data table. Series differ by pattern, dash, or marker shape as well as colour (hatched bars, dashed lines, square markers).
- Live regions are short status sentences (filter result counts, scenario summary, live-data loading state). Errors use `role="alert"`, and large content is never announced as a whole.
- External links announce "(opens in a new tab)". Links with empty or placeholder values are hidden.
- Primary controls are at least 44 px tall; a reduced-motion query disables animation and smooth scrolling.

## Verified by the owner in a browser
- The owner ran the site locally and reviewed the project pages, About, Contact, and Live data during development (2026-10-31).

## Not yet verified
- A full keyboard-only walkthrough of every page, with a written record.
- A screen-reader spot check (VoiceOver or NVDA).
- 200% zoom and 320 px reflow without horizontal scrolling, and touch use on a phone.
- These are planned on the live GitHub Pages site and will be recorded in `docs/verification.md`.
