/** Written findings for AI Spend & Consumption. Computed from the FULL dataset (all months, no filters). */
import {
  compareToBudget,
  DEFAULT_SCENARIO_PARAMS,
  detectAnomalies,
  EMPTY_SPEND_FILTERS,
  estimateScenarios,
  filterEvents,
  monthlySpend,
  observedMonthlyGrowth,
  projectSpend,
  spendByDimension,
  spendFilterOptions,
  summarizeSpend,
} from '@/analysis/spend';
import { formatPercent, formatSignedPercent, formatUsd, formatUsdPrecise } from '@/lib/format';
import { formatDate, formatMonth } from '@/lib/dates';
import type { Finding } from '../findings';
import type { SpendDataset } from './load';

/** Months that have actual usage; budgets also cover future months, which are not compared. */
export function actualMonths(data: Pick<SpendDataset, 'events'>): string[] {
  const withUsage = new Set(data.events.map((e) => e.month));
  return spendFilterOptions(data.events).months.filter((m) => withUsage.has(m));
}

function isQuarterEnd(iso: string): boolean {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return [3, 6, 9, 12].includes(month) && day >= 27;
}

export function buildSpendFindings(data: SpendDataset): Finding[] {
  const { events, prices, budgets } = data;
  const months = actualMonths(data);
  const first = months[0];
  const last = months[months.length - 1];
  const summary = summarizeSpend(events);
  const period = first !== undefined && last !== undefined ? `${formatMonth(first)}–${formatMonth(last)}` : 'the dataset period';
  const out: Finding[] = [];

  const byDept = spendByDimension(events, 'department');
  const topTwo = byDept.slice(0, 2);
  if (topTwo.length === 2) {
    const share = (topTwo[0]?.share ?? 0) + (topTwo[1]?.share ?? 0);
    out.push({
      kind: 'observed',
      title: 'Where spend concentrates',
      text: `Full dataset, ${period}: ${topTwo[0]?.key} and ${topTwo[1]?.key} account for ${formatPercent(share)} of ${formatUsd(summary.spendUsd)} priced spend. Share of spend is not a judgment on value.`,
    });
  }

  const overBudget: string[] = [];
  const underBudget: string[] = [];
  for (const department of spendFilterOptions(events).departments) {
    const filters = { ...EMPTY_SPEND_FILTERS, department };
    const cmp = compareToBudget(filterEvents(events, filters), budgets, filters, months);
    if (cmp?.variancePct == null) continue;
    (cmp.variancePct > 0 ? overBudget : underBudget).push(`${department} ${formatSignedPercent(cmp.variancePct)}`);
  }
  if (overBudget.length > 0 || underBudget.length > 0) {
    out.push({
      kind: 'observed',
      title: 'Actual spend against budget',
      text: `Full dataset, ${period}, actual priced spend vs departmental budget: ${overBudget.length > 0 ? `over budget: ${overBudget.join('; ')}. ` : 'no department over budget. '}${underBudget.length > 0 ? `Under budget: ${underBudget.join('; ')}.` : ''} A large underspend can mean the budget was set too high, not that usage was efficient.`,
    });
  }

  out.push({
    kind: 'observed',
    title: 'Cost per successful task includes failures and retries',
    text: `Full dataset: ${formatUsdPrecise(summary.costPerSuccessfulTask)} per completed task including spend on failed attempts, retries, and abandoned tasks (${formatUsdPrecise(summary.directCostPerSuccessfulTask)} counting completed-task spend only). Failed requests were ${formatPercent(summary.failedSpendShare)} of spend, so this is the share of spend that delivered no output.`,
  });

  const anomalies = detectAnomalies(events);
  if (anomalies.length > 0) {
    const calendar = anomalies.filter((a) => isQuarterEnd(a.date)).length;
    const retry = anomalies.filter((a) => a.driver === 'retries and failures');
    const prompts = anomalies.filter((a) => a.driver === 'larger prompts');
    const parts: string[] = [];
    if (retry.length > 0) parts.push(`${retry.map((a) => formatDate(a.date)).join(', ')} moved mainly with retries and failures`);
    if (prompts.length > 0) parts.push(`${prompts.map((a) => formatDate(a.date)).join(', ')} moved mainly with larger prompts`);
    out.push({
      kind: 'observed',
      title: 'Flagged cost anomalies',
      text: `${anomalies.length} days were flagged as unusually high versus comparable days. ${parts.join('; ')}${parts.length > 0 ? '. ' : ''}${calendar > 0 ? `${calendar} flagged day${calendar === 1 ? '' : 's'} fall${calendar === 1 ? 's' : ''} at a quarter end, which the method does not model, so they may be routine. ` : ''}The tool reports which measured pattern moved; it cannot say why the business behaved that way.`,
    });
  }

  const growth = observedMonthlyGrowth(monthlySpend(events, months));
  const monthly = monthlySpend(events, months);
  if (growth !== null) {
    const budgetByMonth = new Map<string, number>();
    for (const b of budgets) budgetByMonth.set(b.month, (budgetByMonth.get(b.month) ?? 0) + b.budgetUsd);
    const projection = projectSpend(monthly, budgetByMonth, growth, 3);
    const projTotal = projection.reduce((n, p) => n + p.projectedUsd, 0);
    const budgetTotal = projection.reduce((n, p) => n + (p.budgetUsd ?? 0), 0);
    out.push({
      kind: 'scenario',
      title: 'Projection (assumption-based, not a forecast)',
      text: `If the recent compound trend (${formatSignedPercent(growth)} per month over the last 6 months) continued, the next ${projection.length} months would total about ${formatUsd(projTotal)} against ${formatUsd(budgetTotal)} budgeted. The projection assumes no change in mix, prices, or policy and is one illustrative path.`,
    });
  }

  const scenario = estimateScenarios(events, prices, DEFAULT_SCENARIO_PARAMS);
  out.push({
    kind: 'scenario',
    title: 'Savings levers (estimates with default assumptions)',
    text: `With the default assumptions in the scenario panel: routing low-risk use cases to smaller models ≈ ${formatUsd(scenario.routing.netSavingsUsd)} (after a quality haircut, on ${formatUsd(scenario.routing.eligibleSpendUsd)} of eligible spend); more prompt caching on long prompts ≈ ${formatUsd(scenario.caching.savingsUsd)}; fixing root causes of failures ≈ ${formatUsd(scenario.failures.savingsUsd)}. These overlap, so they must not be added together, and none is a guaranteed saving.`,
  });

  const engineering = (() => {
    const filters = { ...EMPTY_SPEND_FILTERS, department: 'Engineering' };
    const series = monthlySpend(filterEvents(events, filters), months);
    return observedMonthlyGrowth(series);
  })();
  out.push({
    kind: 'recommendation',
    title: 'What to do next',
    text: [
      overBudget.length > 0 ? `1. Review the over-budget department(s) (${overBudget.join('; ')}) with their owners${engineering !== null ? `; Engineering's recent monthly growth is ${formatSignedPercent(engineering)}` : ''}. Decide whether to raise the budget or set usage guardrails.` : '1. Keep monitoring budget variance monthly.',
      `2. Pilot routing for the low-risk use cases only after a quality check on a sample; the estimate above is a ceiling until quality is measured.`,
      `3. Add prompt caching where long prompts have low cache hit rates (overall hit rate: ${formatPercent(summary.cacheHitRate)}).`,
      `4. Cap automated retries and alert on days whose spend exceeds the comparable-day threshold, so a retry storm is caught the same day.`,
    ].join(' '),
  });

  return out;
}
