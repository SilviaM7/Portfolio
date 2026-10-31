/**
 * Everything the AI Spend view shows, derived from (dataset, filters) in one pure function, so KPIs, charts,
 * and the table can never disagree: they all read the same filtered events.
 */
import {
  compareToBudget,
  dailySpend,
  detectAnomalies,
  filterEvents,
  hasEntityFilters,
  monthlySpend,
  observedMonthlyGrowth,
  projectSpend,
  spendFilterOptions,
  summarizeSpend,
  type BudgetComparison,
  type DailyAnomaly,
  type DailySpendRow,
  type MonthlySpendRow,
  type PricedEvent,
  type ProjectedMonth,
  type SpendFilters,
  type SpendSummary,
} from '@/analysis/spend';
import type { SpendDataset } from './load';

/** Months that have actual usage. Budgets also cover future months, which are never compared with actuals. */
export function actualMonths(data: Pick<SpendDataset, 'events'>): string[] {
  const withUsage = new Set(data.events.map((e) => e.month));
  return spendFilterOptions(data.events).months.filter((m) => withUsage.has(m));
}

export interface SpendViewModel {
  events: PricedEvent[];
  /** Months with usage inside the selected range (the x-axis of the monthly chart). */
  months: string[];
  summary: SpendSummary;
  /** Null when provider/model/use-case filters are active: budgets exist only per department and month. */
  budget: BudgetComparison | null;
  monthly: MonthlySpendRow[];
  daily: DailySpendRow[];
  anomalies: DailyAnomaly[];
  growth: number | null;
  /** Empty unless the selected range reaches the latest month with data (projecting from an old window would mislead). */
  projection: ProjectedMonth[];
  options: ReturnType<typeof spendFilterOptions>;
}

export function buildSpendView(data: SpendDataset, filters: SpendFilters): SpendViewModel {
  const all = actualMonths(data);
  const months = all.filter((m) => (filters.fromMonth === null || m >= filters.fromMonth) && (filters.toMonth === null || m <= filters.toMonth));
  const events = filterEvents(data.events, filters);
  const monthly = monthlySpend(events, months);
  const budget = compareToBudget(events, data.budgets, filters, months);
  const growth = observedMonthlyGrowth(monthly);

  let projection: ProjectedMonth[] = [];
  const latest = all[all.length - 1];
  const reachesLatest = months.length > 0 && months[months.length - 1] === latest;
  if (growth !== null && reachesLatest) {
    let budgetByMonth: Map<string, number> | null = null;
    if (!hasEntityFilters(filters)) {
      budgetByMonth = new Map();
      for (const b of data.budgets) {
        if (filters.department !== null && b.department !== filters.department) continue;
        budgetByMonth.set(b.month, (budgetByMonth.get(b.month) ?? 0) + b.budgetUsd);
      }
    }
    projection = projectSpend(monthly, budgetByMonth, growth, 3);
  }

  return {
    events,
    months,
    summary: summarizeSpend(events),
    budget,
    monthly,
    daily: dailySpend(events),
    anomalies: detectAnomalies(events),
    growth,
    projection,
    options: spendFilterOptions(data.events),
  };
}
