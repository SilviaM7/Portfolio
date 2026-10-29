# Accessibility status (target: WCAG 2.2 AA)

This is a checklist, not a compliance claim. "Verified" means checked in this repository with evidence; everything else is **not yet verified**.

## Verified (M1)
- Colour token contrast, light and dark: `npm run check:contrast` (text ≥ 4.5:1, focus ring ≥ 3:1).
- Server-rendered markup of Home, Projects, About, Contact, header, footer: one `h1` per page, `nav` with a label, theme toggle has `aria-pressed`, placeholder/empty links are hidden, external links announce "opens in a new tab".

## Implemented but not verified in a browser
- Skip link (button), visible focus style, focus moved to the page heading on navigation, `aria-current` on the active nav link.
- 44px minimum height on primary controls; reduced-motion media query disables animations and smooth scrolling.
- Responsive layout at phone/tablet/desktop widths (Tailwind CSS could not be built in the authoring sandbox).

## Still to do
- Keyboard walkthrough, screen-reader spot check, 200% zoom and 320px reflow check, and a mobile check once the site builds.
- Charts: accessible summaries and data tables arrive with each project module.
