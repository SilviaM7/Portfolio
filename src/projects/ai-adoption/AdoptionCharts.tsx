/** The two AI Adoption charts. Presentation only: every number arrives already computed (see viewModel.ts). */
import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisLine, axisTick, gridStroke, SERIES, tooltipStyles } from '@/components/charts/theme';
import { HatchPattern, safeId } from '@/components/charts/HatchPattern';
import { ChartCard } from '@/components/project/ChartCard';
import { formatDate } from '@/lib/dates';
import { formatInteger, formatPercent } from '@/lib/format';
import type { AdoptionGroup, ObservationWindow, WeeklyAdoptionPoint } from '@/analysis/adoption';

const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive', newSeats: 'New (too early)', unknown: 'Unknown (no telemetry)' };

export function SeatStatusChart({ groups, dimensionLabel, scope }: { groups: AdoptionGroup[]; dimensionLabel: string; scope: string }) {
  const hatchId = safeId(useId());
  const data = groups.map((g) => ({ name: g.key, active: g.active, inactive: g.inactive, newSeats: g.newSeats, unknown: g.unknown }));
  const ranked = groups.filter((g) => g.utilization !== null).sort((a, b) => (a.utilization ?? 0) - (b.utilization ?? 0));
  const lowest = ranked[0];
  const highest = ranked[ranked.length - 1];
  const summary =
    lowest === undefined || highest === undefined
      ? 'No seats in the current selection.'
      : `Across ${groups.length} ${dimensionLabel} groups, utilization ranges from ${formatPercent(lowest.utilization)} (${lowest.key}, ${formatInteger(lowest.assigned)} seats) to ${formatPercent(highest.utilization)} (${highest.key}, ${formatInteger(highest.assigned)} seats).`;
  return (
    <ChartCard
      id="chart-seat-status"
      title={`Seat status by ${dimensionLabel}`}
      subtitle={`Seats held on the as-of date, ${scope}. Segments: solid = active, hatched = inactive, lighter shades = new or unknown (see legend). The table lists exact counts and utilization.`}
      summary={summary}
      table={{
        caption: `Seat status by ${dimensionLabel}`,
        columns: [dimensionLabel, 'Seats held', 'Active', 'Inactive', 'New', 'Unknown', 'Utilization'],
        rows: groups.map((g) => [g.key, g.assigned, g.active, g.inactive, g.newSeats, g.unknown, formatPercent(g.utilization)]),
      }}
    >
      <HatchPattern id={hatchId} color={SERIES.secondary} />
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} accessibilityLayer={false}>
          <CartesianGrid horizontal={false} stroke={gridStroke} />
          <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={axisTick} axisLine={axisLine} tickLine={false} interval={0} />
          <Tooltip {...tooltipStyles} formatter={(value, name) => [formatInteger(Number(value)), STATUS_LABEL[String(name)] ?? String(name)]} cursor={{ fill: 'var(--muted)' }} />
          <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{STATUS_LABEL[value] ?? value}</span>} />
          <Bar dataKey="active" stackId="seats" fill={SERIES.primary} isAnimationActive={false} />
          <Bar dataKey="inactive" stackId="seats" fill={`url(#${hatchId})`} stroke={SERIES.secondary} isAnimationActive={false} />
          <Bar dataKey="newSeats" stackId="seats" fill={SERIES.tertiary} isAnimationActive={false} />
          <Bar dataKey="unknown" stackId="seats" fill={SERIES.quaternary} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WeeklyActiveChart({ weekly, window, scope }: { weekly: WeeklyAdoptionPoint[]; window: ObservationWindow; scope: string }) {
  const data = weekly.map((w) => ({ week: w.weekStart, rate: w.activeRate }));
  const firstWindowWeek = window.weeks[0];
  const lastWindowWeek = window.weeks[window.weeks.length - 1];
  const gaps = weekly.filter((w) => w.activeRate === null);
  const reported = weekly.filter((w) => w.activeRate !== null);
  const first = reported[0];
  const last = reported[reported.length - 1];
  const summary =
    first === undefined || last === undefined
      ? 'No reported telemetry for the current selection.'
      : `The weekly active rate moved from ${formatPercent(first.activeRate)} in the week of ${formatDate(first.weekStart)} to ${formatPercent(last.activeRate)} in the week of ${formatDate(last.weekStart)}.${gaps.length > 0 ? ` ${gaps.length} week(s) have no reported telemetry and are shown as gaps.` : ''}`;
  return (
    <ChartCard
      id="chart-weekly-active"
      title="Weekly active rate"
      subtitle={`Share of held seats with at least one active day, per week (0–100%), ${scope}. The shaded band is the selected observation window. Seat-weeks without telemetry are excluded from the denominator, not counted as inactive.`}
      summary={summary}
      table={{
        caption: 'Weekly active rate',
        columns: ['Week starting', 'Seats held', 'Seats with telemetry', 'Active seats', 'Active rate'],
        rows: weekly.map((w) => [formatDate(w.weekStart), w.heldSeats, w.reportedSeats, w.activeSeats, w.activeRate === null ? 'Not reported' : formatPercent(w.activeRate)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          {firstWindowWeek !== undefined && lastWindowWeek !== undefined && (
            <ReferenceArea x1={firstWindowWeek} x2={lastWindowWeek} fill="var(--muted)" fillOpacity={0.6} label={{ value: 'Observation window', position: 'insideTop', fill: 'var(--muted-foreground)', fontSize: 12 }} />
          )}
          <XAxis dataKey="week" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={32} tickFormatter={(d: string) => formatDate(d)} />
          <YAxis domain={[0, 1]} tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v: number) => formatPercent(v, 0)} width={48} />
          <Tooltip {...tooltipStyles} labelFormatter={(label) => `Week of ${formatDate(String(label))}`} formatter={(value) => [value === null ? 'Not reported' : formatPercent(Number(value)), 'Active rate']} />
          <Line dataKey="rate" type="linear" stroke={SERIES.primary} strokeWidth={2} dot={{ r: 3, fill: SERIES.primary }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
