/** Shared Recharts styling so every chart uses the same tokens (and follows light/dark mode automatically). */
export const SERIES = {
  primary: 'var(--chart-1)',
  secondary: 'var(--chart-2)',
  tertiary: 'var(--chart-3)',
  quaternary: 'var(--chart-4)',
} as const;

export const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 } as const;
export const axisLine = { stroke: 'var(--border)' } as const;
export const gridStroke = 'var(--border)';

export const tooltipStyles = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)', fontSize: 13 },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  itemStyle: { color: 'var(--foreground)' },
} as const;

/** Explicit chart height: a responsive container needs a parent with real dimensions. */
export const CHART_HEIGHT_CLASS = 'h-72 sm:h-80';
