/**
 * Diagonal-hatch fill for the "projected" or "secondary" series, so series differ by pattern as well as colour.
 * Render once NEXT TO the chart (not inside it): SVG patterns are document-wide, so any chart element can use
 * fill={`url(#${id})`}. This avoids depending on how a chart library treats custom children.
 */
export function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="var(--card)" />
          <rect width="3" height="7" fill={color} />
        </pattern>
      </defs>
    </svg>
  );
}

/** useId() returns ids with colons, which are awkward inside url(#...); strip them. */
export const safeId = (raw: string): string => raw.replace(/[^a-zA-Z0-9_-]/g, '');
