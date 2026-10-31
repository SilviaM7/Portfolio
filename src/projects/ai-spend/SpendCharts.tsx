/** The three AI Spend charts. Presentation only: every number arrives already computed (see viewModel.ts). */
import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisLine, axisTick, gridStroke, SERIES, tooltipStyles } from '@/components/charts/theme';
import { HatchPattern, safeId } from '@/components/charts/HatchPattern';
import { ChartCard } from '@/components/project/ChartCard';
import { formatDate, formatMonth, formatMonthShort } from '@/lib/dates';
import { formatPercent, formatUsd, formatUsdCents, formatUsdCompact } from '@/lib/format';
import type { SpendGroup } from '@/analysis/spend';
import type { SpendViewModel } from './viewModel';

const money = (value: unknown): string => formatUsdCents(typeof value === 'number' ? value : Number(value));

export function SpendByDimensionChart({ groups, dimensionLabel, scope }: { groups: SpendGroup[]; dimensionLabel: string; scope: string }) {
  const top = groups[0];
  const data = groups.map((g) => ({ name: g.key, spend: Number(g.spendUsd.toFixed(2)) }));
  return (
    <ChartCard
      id="chart-by-dimension"
      title={`Spend by ${dimensionLabel}`}
      subtitle={`USD of priced spend, ${scope}. Bars are sorted from largest to smallest; the value is printed on each bar.`}
      summary={top === undefined ? 'No spend in the current selection.' : `${top.key} is the largest at ${formatUsd(top.spendUsd)} (${formatPercent(top.share)} of spend) among ${groups.length} ${dimensionLabel} groups.`}
      table={{ caption: `Spend by ${dimensionLabel}`, columns: [dimensionLabel, 'Spend (USD)', 'Share of spend', 'Requests', 'USD per 1M tokens'], rows: groups.map((g) => [g.key, formatUsdCents(g.spendUsd), formatPercent(g.share), g.requests, g.usdPerMillionTokens === null ? '—' : formatUsdCents(g.usdPerMillionTokens)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} accessibilityLayer={false}>
          <CartesianGrid horizontal={false} stroke={gridStroke} />
          <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatUsdCompact} />
          <YAxis type="category" dataKey="name" width={130} tick={axisTick} axisLine={axisLine} tickLine={false} interval={0} />
          <Tooltip {...tooltipStyles} formatter={(value) => [money(value), 'Spend']} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="spend" fill={SERIES.primary} isAnimationActive={false} label={{ position: 'right', fill: 'var(--foreground)', fontSize: 12, formatter: (value: unknown) => formatUsd(Number(value)) }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MonthlyBudgetChart({ view, scope }: { view: SpendViewModel; scope: string }) {
  const hatchId = safeId(useId());
  const budgetByMonth = new Map(view.budget?.rows.map((r) => [r.month, r.budgetUsd]));
  const data = [
    ...view.monthly.map((m) => ({ month: m.month, actual: Number(m.totalUsd.toFixed(2)), projected: null as number | null, budget: budgetByMonth.get(m.month) ?? null })),
    ...view.projection.map((p) => ({ month: p.month, actual: null as number | null, projected: Number(p.projectedUsd.toFixed(2)), budget: p.budgetUsd })),
  ];
  const v = view.budget;
  const summary =
    v === null
      ? 'Budgets exist only by department and month, so no budget line is shown while a provider, model, or use-case filter is active.'
      : `Actual spend was ${formatUsd(v.actualUsd)} against a budget of ${formatUsd(v.budgetUsd)} (${v.variancePct === null ? 'n/a' : `${v.variancePct > 0 ? '+' : '−'}${formatPercent(Math.abs(v.variancePct))}`} ${v.variancePct !== null && v.variancePct > 0 ? 'over' : 'under'} budget) in the months shown.`;
  return (
    <ChartCard
      id="chart-monthly"
      title="Monthly spend versus budget"
      subtitle={`USD per month, ${scope}. Solid bars = actual spend. Dashed line with markers = departmental budget.${view.projection.length > 0 ? ' Hatched bars = illustrative projection (see the Projection tab), not a forecast.' : ''}`}
      summary={summary}
      table={{
        caption: 'Monthly actual spend, budget, and projection',
        columns: ['Month', 'Actual (USD)', 'Budget (USD)', 'Projected (USD)'],
        rows: data.map((d) => [formatMonth(d.month), d.actual === null ? '—' : formatUsdCents(d.actual), d.budget === null ? '—' : formatUsd(d.budget), d.projected === null ? '—' : formatUsdCents(d.projected)]),
      }}
    >
      <HatchPattern id={hatchId} color={SERIES.primary} />
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="month" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatMonthShort} />
          <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatUsdCompact} width={56} />
          <Tooltip {...tooltipStyles} labelFormatter={(label) => formatMonth(String(label))} formatter={(value, name) => [money(value), name === 'actual' ? 'Actual' : name === 'projected' ? 'Projected' : 'Budget']} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="actual" stackId="spend" fill={SERIES.primary} isAnimationActive={false} />
          <Bar dataKey="projected" stackId="spend" fill={`url(#${hatchId})`} stroke={SERIES.primary} isAnimationActive={false} />
          {view.budget !== null && <Line dataKey="budget" type="monotone" stroke={SERIES.secondary} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: SERIES.secondary, stroke: SERIES.secondary }} isAnimationActive={false} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DailySpendChart({ view, scope }: { view: SpendViewModel; scope: string }) {
  const data = view.daily.map((d) => ({ date: d.date, spend: Number(d.spendUsd.toFixed(2)) }));
  const byDate = new Map(data.map((d) => [d.date, d.spend]));
  return (
    <ChartCard
      id="chart-daily"
      title="Daily spend and flagged anomalies"
      subtitle={`USD per calendar day, ${scope}. Circles labeled A1, A2… mark days flagged by the anomaly rule (listed in the Anomalies tab).`}
      summary={view.anomalies.length === 0 ? 'No days were flagged as unusually high in the current selection.' : `${view.anomalies.length} day${view.anomalies.length === 1 ? ' was' : 's were'} flagged: ${view.anomalies.map((a, i) => `A${i + 1} ${formatDate(a.date)}`).join(', ')}.`}
      table={{ caption: 'Daily spend', columns: ['Date', 'Spend (USD)', 'Requests'], rows: view.daily.map((d) => [d.date, formatUsdCents(d.spendUsd), d.requests]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="date" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={48} tickFormatter={(d: string) => formatMonthShort(d.slice(0, 7))} />
          <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={formatUsdCompact} width={56} />
          <Tooltip {...tooltipStyles} labelFormatter={(label) => formatDate(String(label))} formatter={(value) => [money(value), 'Spend']} />
          <Line dataKey="spend" type="linear" stroke={SERIES.primary} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {view.anomalies.map((a, index) => {
            const y = byDate.get(a.date);
            return y === undefined ? null : (
              <ReferenceDot key={a.date} x={a.date} y={y} r={6} fill="var(--card)" stroke={SERIES.secondary} strokeWidth={2} label={{ value: `A${index + 1}`, position: 'top', fill: 'var(--foreground)', fontSize: 12 }} />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
