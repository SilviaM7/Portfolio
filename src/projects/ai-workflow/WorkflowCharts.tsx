/** The three AI Workflow charts. Presentation only: every number arrives already computed (see viewModel.ts). */
import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisLine, axisTick, gridStroke, SERIES, tooltipStyles } from '@/components/charts/theme';
import { HatchPattern, safeId } from '@/components/charts/HatchPattern';
import { ChartCard } from '@/components/project/ChartCard';
import { formatMonth, formatMonthShort } from '@/lib/dates';
import { formatDecimal, formatPercent, formatUsd, formatUsdCompact } from '@/lib/format';
import type { ComplexityRow, MonthlyTrendRow } from '@/analysis/workflow';
import type { ScenarioViewModel } from './viewModel';

/** Square markers for the comparison series, so the two lines differ by marker shape as well as colour and dash. */
function renderSquareDot(props: { cx?: number; cy?: number; index?: number; value?: unknown }) {
  const { cx, cy, index, value } = props;
  if (cx === undefined || cy === undefined || value === null || value === undefined) return <g key={`sq-${index ?? 0}`} />;
  return <rect key={`sq-${index ?? 0}`} x={cx - 4} y={cy - 4} width={8} height={8} fill={SERIES.secondary} />;
}

const round1 = (v: number | null): number | null => (v === null ? null : Number(v.toFixed(1)));
const minutesLabel = (v: unknown): string => (v === null || v === undefined ? 'No data' : `${formatDecimal(Number(v))} min`);

export function ComplexityChart({ rows, scope }: { rows: ComplexityRow[]; scope: string }) {
  const hatchId = safeId(useId());
  const data = rows.map((r) => ({ name: r.complexity, baseline: round1(r.baselineMinutes), ai: round1(r.aiMinutes) }));
  const compared = rows.filter((r) => r.baselineMinutes !== null && r.aiMinutes !== null);
  const summary =
    compared.length === 0
      ? 'The current selection does not contain both baseline and AI-assisted tasks at any complexity level, so no comparison is shown.'
      : compared.map((r) => `${r.complexity}: ${formatDecimal(r.aiMinutes)} min AI-assisted vs ${formatDecimal(r.baselineMinutes)} min baseline`).join('; ') + '.';
  return (
    <ChartCard
      id="chart-complexity"
      title="Minutes per task by complexity"
      subtitle={`Mean handling + review + rework minutes per task, ${scope}. Solid bars = baseline, hatched bars = AI-assisted. Comparing within a level keeps task mix from distorting the result.`}
      summary={summary}
      table={{
        caption: 'Minutes per task and pass rate by complexity',
        columns: ['Complexity', 'Baseline tasks', 'AI-assisted tasks', 'Baseline minutes', 'AI-assisted minutes', 'Baseline pass rate', 'AI-assisted pass rate'],
        rows: rows.map((r) => [r.complexity, r.baselineTasks, r.aiTasks, r.baselineMinutes === null ? '—' : formatDecimal(r.baselineMinutes), r.aiMinutes === null ? '—' : formatDecimal(r.aiMinutes), formatPercent(r.baselinePassRate), formatPercent(r.aiPassRate)]),
      }}
    >
      <HatchPattern id={hatchId} color={SERIES.secondary} />
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="name" tick={axisTick} axisLine={axisLine} tickLine={false} />
          <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={48} />
          <Tooltip {...tooltipStyles} formatter={(value, name) => [minutesLabel(value), name === 'ai' ? 'AI-assisted' : 'Baseline']} cursor={{ fill: 'var(--muted)' }} />
          <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{value === 'ai' ? 'AI-assisted' : 'Baseline'}</span>} />
          <Bar dataKey="baseline" fill={SERIES.primary} isAnimationActive={false} />
          <Bar dataKey="ai" fill={`url(#${hatchId})`} stroke={SERIES.secondary} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrendChart({ rows, pilotStart, pilotTeams, scope }: { rows: MonthlyTrendRow[]; pilotStart: string | null; pilotTeams: string[]; scope: string }) {
  const data = rows.map((r) => ({ month: r.month, pilot: round1(r.pilotMinutes), comparison: round1(r.comparisonMinutes) }));
  const showStart = pilotStart !== null && rows.some((r) => r.month === pilotStart);
  const withPilot = rows.filter((r) => r.pilotMinutes !== null);
  const first = withPilot[0];
  const last = withPilot[withPilot.length - 1];
  const summary =
    first === undefined || last === undefined
      ? 'No pilot-team tasks in the current selection.'
      : `Pilot teams (${pilotTeams.join(', ')}) averaged ${formatDecimal(first.pilotMinutes)} minutes per task in ${formatMonth(first.month)} and ${formatDecimal(last.pilotMinutes)} in ${formatMonth(last.month)}.${pilotStart !== null ? ` The pilot began in ${formatMonth(pilotStart)}.` : ''} The comparison team never used AI assistance.`;
  return (
    <ChartCard
      id="chart-trend"
      title="Monthly minutes per task: pilot teams vs comparison team"
      subtitle={`Mean minutes per task per month, ${scope}. Solid line with circles = pilot teams (all their tasks, baseline and AI-assisted); dashed line with squares = comparison team. The vertical line marks the pilot start. Descriptive only.`}
      summary={summary}
      table={{
        caption: 'Monthly minutes per task',
        columns: ['Month', 'Pilot tasks', 'Pilot minutes', 'Comparison tasks', 'Comparison minutes'],
        rows: rows.map((r) => [formatMonth(r.month), r.pilotTasks, r.pilotMinutes === null ? '—' : formatDecimal(r.pilotMinutes), r.comparisonTasks, r.comparisonMinutes === null ? '—' : formatDecimal(r.comparisonMinutes)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="month" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatMonthShort} />
          <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={48} />
          {showStart && <ReferenceLine x={pilotStart} stroke="var(--muted-foreground)" strokeDasharray="2 3" label={{ value: 'Pilot starts', position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 12 }} />}
          <Tooltip {...tooltipStyles} labelFormatter={(label) => formatMonth(String(label))} formatter={(value, name) => [minutesLabel(value), name === 'pilot' ? 'Pilot teams' : 'Comparison team']} />
          <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{value === 'pilot' ? 'Pilot teams' : 'Comparison team'}</span>} />
          <Line dataKey="pilot" type="linear" stroke={SERIES.primary} strokeWidth={2} dot={{ r: 4, fill: SERIES.primary }} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="comparison" type="linear" stroke={SERIES.secondary} strokeWidth={2} strokeDasharray="6 4" dot={renderSquareDot} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PaybackChart({ scenario }: { scenario: ScenarioViewModel }) {
  const e = scenario.estimate;
  const fmtPayback = (m: number | null) => (m === null ? 'does not pay back' : m > 24 ? `pays back in about ${formatDecimal(m, 0)} months (beyond the chart)` : `pays back in about ${formatDecimal(m, 0)} months`);
  return (
    <ChartCard
      id="chart-payback"
      title="Cumulative value after one-time costs (scenario)"
      subtitle="USD, months after launch (month 0 = implementation and training paid). Solid line = estimated value of released time; dashed line = cash view. The zero line is where the one-time cost is recovered. An estimate, not realized savings."
      summary={`With the current scenario settings, the estimated value view ${fmtPayback(e.paybackMonthsEstimated)} and the cash view ${fmtPayback(e.paybackMonthsCash)}.`}
      table={{
        caption: 'Cumulative value by month',
        columns: ['Month', 'Estimated value view (USD)', 'Cash view (USD)'],
        rows: scenario.payback.filter((p) => p.month % 3 === 0).map((p) => [p.month, formatUsd(p.estimatedUsd), formatUsd(p.cashUsd)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scenario.payback} margin={{ top: 16, right: 16, bottom: 4, left: 8 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="month" tick={axisTick} axisLine={axisLine} tickLine={false} />
          <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatUsdCompact} width={64} />
          <ReferenceLine y={0} stroke="var(--foreground)" />
          <Tooltip {...tooltipStyles} labelFormatter={(label) => `Month ${String(label)}`} formatter={(value, name) => [formatUsd(Number(value)), name === 'estimatedUsd' ? 'Estimated value view' : 'Cash view']} />
          <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{value === 'estimatedUsd' ? 'Estimated value view' : 'Cash view'}</span>} />
          <Line dataKey="estimatedUsd" type="linear" stroke={SERIES.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="cashUsd" type="linear" stroke={SERIES.secondary} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
