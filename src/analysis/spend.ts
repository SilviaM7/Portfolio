/**
 * AI Spend & Consumption: pure calculations. No React, no network.
 *
 * Billing definitions (also shown to visitors in the methodology panel):
 *   - input_tokens is the TOTAL prompt size and INCLUDES cached_input_tokens.
 *   - billable uncached input = input_tokens - cached_input_tokens (never negative).
 *   - request cost (USD) = (uncached input * input rate + cached input * cached rate
 *                           + output tokens * output rate) / 1,000,000
 *   - rates are the effective-dated price in force on the request's event_date.
 *   - failed requests are billed for the tokens recorded on them (assumption).
 * A request whose price cannot be determined, or whose cached tokens exceed input tokens,
 * has costUsd = null and is excluded from spend; it is never treated as $0.
 */
import { addDays, addMonths, isWeekend, monthRange } from '@/lib/dates';
import { clamp, groupBy, median, medianAbsoluteDeviation, safeDivide, sum, uniqueSorted } from './common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RequestStatus = 'success' | 'failed';
export type TaskOutcome = 'completed' | 'abandoned';

export interface UsageEvent {
  requestId: string;
  date: string;
  month: string;
  department: string;
  useCase: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  status: RequestStatus;
  latencyMs: number | null;
  retryOf: string | null;
  taskId: string;
  taskOutcome: TaskOutcome;
}

export interface PriceEntry {
  model: string;
  provider: string;
  effectiveFrom: string;
  /** Inclusive last day, or null if still in force. */
  effectiveTo: string | null;
  inputPerMtok: number;
  cachedPerMtok: number;
  outputPerMtok: number;
}

export interface Budget {
  month: string;
  department: string;
  budgetUsd: number;
}

export type CostIssue = 'no_price' | 'cached_exceeds_input';

export interface PricedEvent extends UsageEvent {
  /** USD for this request, or null when it could not be priced (see costIssue). */
  costUsd: number | null;
  costIssue: CostIssue | null;
  isRetry: boolean;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Price in force for a model on a date; if entries overlap, the latest effective_from wins. */
export function findPrice(prices: readonly PriceEntry[], model: string, date: string): PriceEntry | null {
  let best: PriceEntry | null = null;
  for (const p of prices) {
    if (p.model !== model) continue;
    if (p.effectiveFrom > date) continue;
    if (p.effectiveTo !== null && p.effectiveTo < date) continue;
    if (best === null || p.effectiveFrom > best.effectiveFrom) best = p;
  }
  return best;
}

/** Cost of the given token counts at one price entry (USD). Cached tokens must not exceed input tokens. */
export function tokenCost(price: PriceEntry, inputTokens: number, cachedTokens: number, outputTokens: number): number {
  const uncached = inputTokens - cachedTokens;
  return (uncached * price.inputPerMtok + cachedTokens * price.cachedPerMtok + outputTokens * price.outputPerMtok) / 1_000_000;
}

export function priceEvents(events: readonly UsageEvent[], prices: readonly PriceEntry[]): PricedEvent[] {
  return events.map((e) => {
    const base = { ...e, isRetry: e.retryOf !== null };
    if (e.cachedTokens > e.inputTokens) return { ...base, costUsd: null, costIssue: 'cached_exceeds_input' as const };
    const price = findPrice(prices, e.model, e.date);
    if (!price) return { ...base, costUsd: null, costIssue: 'no_price' as const };
    return { ...base, costUsd: tokenCost(price, e.inputTokens, e.cachedTokens, e.outputTokens), costIssue: null };
  });
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** null means "All". Months are "YYYY-MM" and inclusive. */
export interface SpendFilters {
  fromMonth: string | null;
  toMonth: string | null;
  department: string | null;
  provider: string | null;
  model: string | null;
  useCase: string | null;
}

export const EMPTY_SPEND_FILTERS: SpendFilters = {
  fromMonth: null,
  toMonth: null,
  department: null,
  provider: null,
  model: null,
  useCase: null,
};

export function filterEvents(events: readonly PricedEvent[], f: SpendFilters): PricedEvent[] {
  return events.filter(
    (e) =>
      (f.fromMonth === null || e.month >= f.fromMonth) &&
      (f.toMonth === null || e.month <= f.toMonth) &&
      (f.department === null || e.department === f.department) &&
      (f.provider === null || e.provider === f.provider) &&
      (f.model === null || e.model === f.model) &&
      (f.useCase === null || e.useCase === f.useCase),
  );
}

/** Budgets exist only per department and month, so they are comparable only without these filters. */
export function hasEntityFilters(f: SpendFilters): boolean {
  return f.provider !== null || f.model !== null || f.useCase !== null;
}

export function isFiltered(f: SpendFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}

// ---------------------------------------------------------------------------
// Summary metrics
// ---------------------------------------------------------------------------

export interface SpendSummary {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  retryRequests: number;
  /** Requests excluded from spend because they could not be priced. */
  unpricedRequests: number;
  invalidTokenRequests: number;
  spendUsd: number;
  /** Spend on failed requests (attempts that did not deliver output). */
  failedSpendUsd: number;
  successRate: number | null;
  /** Share of spend on failed requests. */
  failedSpendShare: number | null;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  /** Sum(cached) / Sum(input) over priced requests: a weighted rate, not an average of per-request rates. */
  cacheHitRate: number | null;
  medianLatencyMs: number | null;
  tasks: number;
  /** Tasks whose every request was priced. Task metrics use only these. */
  costCompleteTasks: number;
  completedTasks: number;
  abandonedTasks: number;
  /** Spend of cost-complete completed tasks, including their failed attempts and retries. */
  completedTaskSpendUsd: number;
  /** Spend of cost-complete abandoned tasks (attempts that never produced a result). */
  abandonedTaskSpendUsd: number;
  /** (completed + abandoned task spend) / completed tasks. */
  costPerSuccessfulTask: number | null;
  /** completed task spend / completed tasks (excludes abandoned-task spend). */
  directCostPerSuccessfulTask: number | null;
}

export function summarizeSpend(events: readonly PricedEvent[]): SpendSummary {
  const priced = events.filter((e) => e.costUsd !== null);
  const spendUsd = sum(priced.map((e) => e.costUsd ?? 0));
  const failed = events.filter((e) => e.status === 'failed');
  const failedSpendUsd = sum(failed.map((e) => e.costUsd ?? 0));
  const inputTokens = sum(priced.map((e) => e.inputTokens));
  const cachedTokens = sum(priced.map((e) => e.cachedTokens));
  const outputTokens = sum(priced.map((e) => e.outputTokens));
  const latencies = events.filter((e) => e.status === 'success' && e.latencyMs !== null).map((e) => e.latencyMs ?? 0);

  const byTask = groupBy(events, (e) => e.taskId);
  let costCompleteTasks = 0;
  let completedTasks = 0;
  let abandonedTasks = 0;
  let completedTaskSpendUsd = 0;
  let abandonedTaskSpendUsd = 0;
  for (const rows of byTask.values()) {
    if (rows.some((r) => r.costUsd === null)) continue;
    costCompleteTasks += 1;
    const taskSpend = sum(rows.map((r) => r.costUsd ?? 0));
    if (rows.some((r) => r.taskOutcome === 'completed')) {
      completedTasks += 1;
      completedTaskSpendUsd += taskSpend;
    } else {
      abandonedTasks += 1;
      abandonedTaskSpendUsd += taskSpend;
    }
  }

  const successfulRequests = events.filter((e) => e.status === 'success').length;
  return {
    requests: events.length,
    successfulRequests,
    failedRequests: failed.length,
    retryRequests: events.filter((e) => e.isRetry).length,
    unpricedRequests: events.filter((e) => e.costIssue === 'no_price').length,
    invalidTokenRequests: events.filter((e) => e.costIssue === 'cached_exceeds_input').length,
    spendUsd,
    failedSpendUsd,
    successRate: safeDivide(successfulRequests, events.length),
    failedSpendShare: safeDivide(failedSpendUsd, spendUsd),
    inputTokens,
    cachedTokens,
    outputTokens,
    cacheHitRate: safeDivide(cachedTokens, inputTokens),
    medianLatencyMs: median(latencies),
    tasks: byTask.size,
    costCompleteTasks,
    completedTasks,
    abandonedTasks,
    completedTaskSpendUsd,
    abandonedTaskSpendUsd,
    costPerSuccessfulTask: safeDivide(completedTaskSpendUsd + abandonedTaskSpendUsd, completedTasks),
    directCostPerSuccessfulTask: safeDivide(completedTaskSpendUsd, completedTasks),
  };
}

// ---------------------------------------------------------------------------
// Grouped series
// ---------------------------------------------------------------------------

export type SpendDimension = 'department' | 'provider' | 'model' | 'useCase';

export interface SpendGroup {
  key: string;
  spendUsd: number;
  share: number | null;
  requests: number;
  /** Spend per 1M (input + output) tokens, a weighted blended rate. */
  usdPerMillionTokens: number | null;
}

export function spendByDimension(events: readonly PricedEvent[], dimension: SpendDimension): SpendGroup[] {
  const total = sum(events.map((e) => e.costUsd ?? 0));
  const groups = groupBy(events, (e) => e[dimension]);
  return [...groups.entries()]
    .map(([key, rows]) => {
      const priced = rows.filter((r) => r.costUsd !== null);
      const spendUsd = sum(priced.map((r) => r.costUsd ?? 0));
      const tokens = sum(priced.map((r) => r.inputTokens + r.outputTokens));
      return {
        key,
        spendUsd,
        share: safeDivide(spendUsd, total),
        requests: rows.length,
        usdPerMillionTokens: tokens > 0 ? (spendUsd / tokens) * 1_000_000 : null,
      };
    })
    .sort((a, b) => b.spendUsd - a.spendUsd);
}

export interface MonthlySpendRow {
  month: string;
  totalUsd: number;
  byDepartment: Record<string, number>;
}

/** One row per month in [from, to] (including months with no spend). */
export function monthlySpend(events: readonly PricedEvent[], months: readonly string[]): MonthlySpendRow[] {
  const byMonth = groupBy(events, (e) => e.month);
  return months.map((month) => {
    const rows = byMonth.get(month) ?? [];
    const byDepartment: Record<string, number> = {};
    for (const r of rows) byDepartment[r.department] = (byDepartment[r.department] ?? 0) + (r.costUsd ?? 0);
    return { month, totalUsd: sum(Object.values(byDepartment)), byDepartment };
  });
}

export interface DailySpendRow {
  date: string;
  spendUsd: number;
  requests: number;
}

/** One row per calendar day between the first and last event, including zero-spend days. */
export function dailySpend(events: readonly PricedEvent[]): DailySpendRow[] {
  if (events.length === 0) return [];
  const byDate = groupBy(events, (e) => e.date);
  const dates = [...byDate.keys()].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === undefined || last === undefined) return [];
  const out: DailySpendRow[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const rows = byDate.get(d) ?? [];
    out.push({ date: d, spendUsd: sum(rows.map((r) => r.costUsd ?? 0)), requests: rows.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Budget comparison
// ---------------------------------------------------------------------------

export interface BudgetRow {
  month: string;
  actualUsd: number;
  budgetUsd: number;
  varianceUsd: number;
}

export interface BudgetComparison {
  rows: BudgetRow[];
  actualUsd: number;
  budgetUsd: number;
  varianceUsd: number;
  /** variance / budget, positive = over budget. */
  variancePct: number | null;
}

/**
 * Actual (priced) spend vs department budgets for the given months.
 * Returns null when budgets are not comparable (provider/model/use-case filters are active).
 */
export function compareToBudget(
  events: readonly PricedEvent[],
  budgets: readonly Budget[],
  filters: SpendFilters,
  months: readonly string[],
): BudgetComparison | null {
  if (hasEntityFilters(filters)) return null;
  const budgetByMonth = new Map<string, number>();
  for (const b of budgets) {
    if (filters.department !== null && b.department !== filters.department) continue;
    budgetByMonth.set(b.month, (budgetByMonth.get(b.month) ?? 0) + b.budgetUsd);
  }
  const actualByMonth = new Map<string, number>();
  for (const e of events) actualByMonth.set(e.month, (actualByMonth.get(e.month) ?? 0) + (e.costUsd ?? 0));

  const rows = months.map((month) => {
    const actualUsd = actualByMonth.get(month) ?? 0;
    const budgetUsd = budgetByMonth.get(month) ?? 0;
    return { month, actualUsd, budgetUsd, varianceUsd: actualUsd - budgetUsd };
  });
  const actualUsd = sum(rows.map((r) => r.actualUsd));
  const budgetUsd = sum(rows.map((r) => r.budgetUsd));
  return { rows, actualUsd, budgetUsd, varianceUsd: actualUsd - budgetUsd, variancePct: safeDivide(actualUsd - budgetUsd, budgetUsd) };
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

export interface AnomalyOptions {
  /** Calendar days looked back (comparable day type only). */
  windowDays: number;
  /** Minimum comparable days required before a day can be flagged. */
  minComparable: number;
  /** Robust z-score threshold (median/MAD based). */
  zThreshold: number;
  /** The day must also be at least this multiple of the trailing median. */
  minRatio: number;
  /**
   * Materiality: the dollars above the trailing median must be at least this multiple of the trailing
   * mean daily spend, so tiny weekend blips are not reported as anomalies.
   */
  minExcessOfMeanDaily: number;
}

export const DEFAULT_ANOMALY_OPTIONS: AnomalyOptions = {
  windowDays: 28,
  minComparable: 8,
  zThreshold: 3.5,
  minRatio: 1.8,
  minExcessOfMeanDaily: 0.75,
};

export type AnomalyDriver = 'retries and failures' | 'larger prompts' | 'higher request volume' | 'no single driver';

export interface DailyAnomaly {
  date: string;
  spendUsd: number;
  typicalUsd: number;
  ratio: number;
  robustZ: number;
  requests: number;
  typicalRequests: number;
  failedShare: number | null;
  typicalFailedShare: number | null;
  avgInputTokens: number | null;
  typicalAvgInputTokens: number | null;
  topUseCase: string | null;
  topDepartment: string | null;
  driver: AnomalyDriver;
  explanation: string;
}

interface DayStats {
  date: string;
  spendUsd: number;
  requests: number;
  failedShare: number | null;
  avgInput: number | null;
}

function dayStats(events: readonly PricedEvent[]): Map<string, DayStats> {
  const out = new Map<string, DayStats>();
  for (const [date, rows] of groupBy(events, (e) => e.date)) {
    const failed = rows.filter((r) => r.status === 'failed').length;
    out.set(date, {
      date,
      spendUsd: sum(rows.map((r) => r.costUsd ?? 0)),
      requests: rows.length,
      failedShare: safeDivide(failed, rows.length),
      avgInput: safeDivide(sum(rows.map((r) => r.inputTokens)), rows.length),
    });
  }
  return out;
}

/**
 * Flags days whose spend is far above the trailing median of comparable days (weekdays are compared with
 * weekdays, weekends with weekends), then attributes the spike to retries, prompt size, or volume.
 * This is descriptive: it says which measurable pattern moved, not why the business behaved that way.
 */
export function detectAnomalies(events: readonly PricedEvent[], options: AnomalyOptions = DEFAULT_ANOMALY_OPTIONS): DailyAnomaly[] {
  const daily = dailySpend(events);
  const stats = dayStats(events);
  const eventsByDate = groupBy(events, (e) => e.date);
  const first = daily[0]?.date;
  const anomalies: DailyAnomaly[] = [];

  for (const day of daily) {
    const comparable: DailyAnomalyWindowDay[] = [];
    for (let back = 1; back <= options.windowDays; back++) {
      const date = addDays(day.date, -back);
      if (isWeekend(date) !== isWeekend(day.date)) continue;
      const s = stats.get(date);
      comparable.push({ date, spendUsd: s?.spendUsd ?? 0, requests: s?.requests ?? 0, failedShare: s?.failedShare ?? null, avgInput: s?.avgInput ?? null });
    }
    // Only judge days that have a full-enough history inside the dataset.
    const usable = comparable.filter((c) => first !== undefined && c.date >= first);
    if (usable.length < options.minComparable) continue;

    const spends = usable.map((c) => c.spendUsd);
    const typical = median(spends);
    const mad = medianAbsoluteDeviation(spends);
    if (typical === null || mad === null || typical <= 0) continue;
    // Floor the scale at 5% of the typical value so a perfectly flat history (MAD = 0) cannot hide a spike.
    const scale = Math.max(mad, 0.05 * typical);
    const robustZ = (0.6745 * (day.spendUsd - typical)) / scale;
    const ratio = day.spendUsd / typical;
    if (robustZ < options.zThreshold || ratio < options.minRatio) continue;

    // Materiality check against the trailing mean daily spend (all day types).
    const trailing: number[] = [];
    for (let back = 1; back <= options.windowDays; back++) {
      const date = addDays(day.date, -back);
      if (first !== undefined && date >= first) trailing.push(stats.get(date)?.spendUsd ?? 0);
    }
    const meanDaily = trailing.length > 0 ? sum(trailing) / trailing.length : 0;
    if (day.spendUsd - typical < options.minExcessOfMeanDaily * meanDaily) continue;

    const typicalRequests = median(usable.map((c) => c.requests)) ?? 0;
    const typicalFailedShare = median(usable.map((c) => c.failedShare).filter((v): v is number => v !== null));
    const typicalAvgInput = median(usable.map((c) => c.avgInput).filter((v): v is number => v !== null));
    const today = stats.get(day.date);
    const failedShare = today?.failedShare ?? null;
    const avgInput = today?.avgInput ?? null;

    const rows = eventsByDate.get(day.date) ?? [];
    const spendByUseCase = new Map<string, number>();
    const spendByDept = new Map<string, number>();
    for (const r of rows) {
      spendByUseCase.set(r.useCase, (spendByUseCase.get(r.useCase) ?? 0) + (r.costUsd ?? 0));
      spendByDept.set(r.department, (spendByDept.get(r.department) ?? 0) + (r.costUsd ?? 0));
    }
    const topUseCase = largestKey(spendByUseCase);
    const topDepartment = largestKey(spendByDept);

    const failedLift = failedShare !== null && typicalFailedShare !== null ? failedShare - typicalFailedShare : 0;
    const inputRatio = avgInput !== null && typicalAvgInput !== null && typicalAvgInput > 0 ? avgInput / typicalAvgInput : 1;
    const volumeRatio = typicalRequests > 0 ? day.requests / typicalRequests : 1;

    let driver: AnomalyDriver = 'no single driver';
    if (failedLift >= 0.15) driver = 'retries and failures';
    else if (inputRatio >= 1.4) driver = 'larger prompts';
    else if (volumeRatio >= 1.5) driver = 'higher request volume';

    anomalies.push({
      date: day.date,
      spendUsd: day.spendUsd,
      typicalUsd: typical,
      ratio,
      robustZ,
      requests: day.requests,
      typicalRequests,
      failedShare,
      typicalFailedShare,
      avgInputTokens: avgInput,
      typicalAvgInputTokens: typicalAvgInput,
      topUseCase,
      topDepartment,
      driver,
      explanation: buildExplanation({ ratio, driver, volumeRatio, inputRatio, failedShare, typicalFailedShare, topUseCase, topDepartment }),
    });
  }
  return anomalies;
}

interface DailyAnomalyWindowDay {
  date: string;
  spendUsd: number;
  requests: number;
  failedShare: number | null;
  avgInput: number | null;
}

function largestKey(map: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of map) {
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  return best;
}

function buildExplanation(input: {
  ratio: number;
  driver: AnomalyDriver;
  volumeRatio: number;
  inputRatio: number;
  failedShare: number | null;
  typicalFailedShare: number | null;
  topUseCase: string | null;
  topDepartment: string | null;
}): string {
  const parts = [`Spend was ${input.ratio.toFixed(1)}× the typical comparable day.`, `Requests ${input.volumeRatio.toFixed(1)}× typical; average prompt size ${input.inputRatio.toFixed(1)}× typical.`];
  if (input.failedShare !== null && input.typicalFailedShare !== null) {
    parts.push(`Failed requests were ${(input.failedShare * 100).toFixed(0)}% of requests (typical ${(input.typicalFailedShare * 100).toFixed(0)}%).`);
  }
  if (input.topUseCase !== null) parts.push(`Largest contributor: ${input.topUseCase}${input.topDepartment ? ` (${input.topDepartment})` : ''}.`);
  parts.push(`Largest measured change: ${input.driver}. Calendar effects such as quarter-end are not modeled, so confirm with the department before acting.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Projection (a labeled assumption-based projection, not a forecast)
// ---------------------------------------------------------------------------

export interface ProjectedMonth {
  month: string;
  projectedUsd: number;
  budgetUsd: number | null;
}

/**
 * Compound monthly growth rate from a log-linear least-squares fit over the last `maxMonths` months
 * (more stable than averaging single month-over-month changes). Null if fewer than 3 positive months.
 */
export function observedMonthlyGrowth(monthly: readonly { totalUsd: number }[], maxMonths = 6): number | null {
  const values = monthly.slice(-maxMonths).map((m) => m.totalUsd);
  if (values.length < 3 || values.some((v) => v <= 0)) return null;
  const logs = values.map((v) => Math.log(v));
  const n = logs.length;
  const meanX = (n - 1) / 2;
  const meanY = sum(logs) / n;
  let numerator = 0;
  let denominator = 0;
  logs.forEach((y, x) => {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  });
  return Math.exp(numerator / denominator) - 1;
}

/**
 * Projection = average of the last `baselineMonths` months x (1 + monthly growth)^k for k = 1..horizon.
 * Because the baseline is an average, it lags the latest month: the projection is conservative when growth is positive.
 */
export function projectSpend(
  monthly: readonly { month: string; totalUsd: number }[],
  budgetsByMonth: ReadonlyMap<string, number> | null,
  monthlyGrowth: number,
  horizonMonths = 3,
  baselineMonths = 3,
): ProjectedMonth[] {
  if (monthly.length < baselineMonths) return [];
  const baseline = monthly.slice(-baselineMonths);
  const runRate = sum(baseline.map((m) => m.totalUsd)) / baselineMonths;
  const last = baseline[baseline.length - 1];
  if (last === undefined) return [];
  const out: ProjectedMonth[] = [];
  for (let k = 1; k <= horizonMonths; k++) {
    const month = addMonths(last.month, k);
    out.push({ month, projectedUsd: runRate * Math.pow(1 + monthlyGrowth, k), budgetUsd: budgetsByMonth?.get(month) ?? null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scenarios (estimates, not guaranteed savings)
// ---------------------------------------------------------------------------

/**
 * Analyst assumption (NOT in the dataset): use cases judged low-risk to run on a smaller model.
 * Revisit with quality evaluation before acting on any routing estimate.
 */
export const ROUTABLE_USE_CASES: ReadonlySet<string> = new Set([
  'Ticket summarization',
  'Reply drafting',
  'Invoice extraction',
  'Clause extraction',
  'SOP Q&A',
  'Document extraction',
  'Content drafting',
]);

/** Same-provider downshift targets (avoids vendor switching in the estimate). */
export const MODEL_DOWNSHIFT: Readonly<Record<string, string>> = {
  'alder-large': 'alder-small',
  'birch-standard': 'birch-mini',
};

/** Prompts at least this long are treated as plausible caching candidates (analyst assumption). */
export const CACHE_CANDIDATE_MIN_INPUT_TOKENS = 8000;
/** Use cases whose current cache hit rate is below this are treated as under-using caching. */
export const CACHE_LOW_HIT_RATE = 0.2;

export interface ScenarioParams {
  /** Share (0-1) of eligible requests moved to the smaller model. */
  routingShare: number;
  /** Share (0-1) of routing savings assumed lost to quality problems, retries, or rework. */
  qualityHaircut: number;
  /** Additional share (0-1) of input tokens served from cache on candidate requests. */
  cacheLift: number;
  /** Share (0-1) of failed-request spend removed by fixing root causes. */
  failureReduction: number;
}

export const DEFAULT_SCENARIO_PARAMS: ScenarioParams = { routingShare: 0.5, qualityHaircut: 0.2, cacheLift: 0.3, failureReduction: 0.4 };

export interface ScenarioEstimates {
  routing: { eligibleRequests: number; eligibleSpendUsd: number; grossSavingsUsd: number; netSavingsUsd: number };
  caching: { candidateRequests: number; additionalCachedTokens: number; savingsUsd: number };
  failures: { failedSpendUsd: number; savingsUsd: number };
}

export function estimateScenarios(events: readonly PricedEvent[], prices: readonly PriceEntry[], params: ScenarioParams): ScenarioEstimates {
  const routingShare = clamp(params.routingShare, 0, 1);
  const haircut = clamp(params.qualityHaircut, 0, 1);
  const cacheLift = clamp(params.cacheLift, 0, 1);
  const failureReduction = clamp(params.failureReduction, 0, 1);

  // Routing: re-price eligible requests on the target model at the same date, with the same tokens.
  let eligibleRequests = 0;
  let eligibleSpendUsd = 0;
  let grossRoutingSavings = 0;
  for (const e of events) {
    if (e.costUsd === null || !ROUTABLE_USE_CASES.has(e.useCase)) continue;
    const target = MODEL_DOWNSHIFT[e.model];
    if (target === undefined) continue;
    const targetPrice = findPrice(prices, target, e.date);
    if (!targetPrice) continue;
    eligibleRequests += 1;
    eligibleSpendUsd += e.costUsd;
    grossRoutingSavings += (e.costUsd - tokenCost(targetPrice, e.inputTokens, e.cachedTokens, e.outputTokens)) * routingShare;
  }

  // Caching: long prompts in use cases that barely use the cache today.
  const hitRateByUseCase = new Map<string, number | null>();
  for (const [useCase, rows] of groupBy(events.filter((e) => e.costUsd !== null), (e) => e.useCase)) {
    hitRateByUseCase.set(useCase, safeDivide(sum(rows.map((r) => r.cachedTokens)), sum(rows.map((r) => r.inputTokens))));
  }
  let candidateRequests = 0;
  let additionalCachedTokens = 0;
  let cachingSavings = 0;
  for (const e of events) {
    if (e.costUsd === null || e.inputTokens < CACHE_CANDIDATE_MIN_INPUT_TOKENS) continue;
    const hitRate = hitRateByUseCase.get(e.useCase);
    if (hitRate === undefined || hitRate === null || hitRate >= CACHE_LOW_HIT_RATE) continue;
    const price = findPrice(prices, e.model, e.date);
    if (!price) continue;
    const additional = Math.min(e.inputTokens - e.cachedTokens, Math.round(e.inputTokens * cacheLift));
    if (additional <= 0) continue;
    candidateRequests += 1;
    additionalCachedTokens += additional;
    cachingSavings += (additional * (price.inputPerMtok - price.cachedPerMtok)) / 1_000_000;
  }

  const failedSpendUsd = sum(events.filter((e) => e.status === 'failed').map((e) => e.costUsd ?? 0));

  return {
    routing: { eligibleRequests, eligibleSpendUsd, grossSavingsUsd: grossRoutingSavings, netSavingsUsd: grossRoutingSavings * (1 - haircut) },
    caching: { candidateRequests, additionalCachedTokens, savingsUsd: cachingSavings },
    failures: { failedSpendUsd, savingsUsd: failedSpendUsd * failureReduction },
  };
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export function spendFilterOptions(events: readonly PricedEvent[]): {
  months: string[];
  departments: string[];
  providers: string[];
  models: string[];
  useCases: string[];
} {
  const months = uniqueSorted(events.map((e) => e.month));
  const first = months[0];
  const last = months[months.length - 1];
  return {
    months: first !== undefined && last !== undefined ? monthRange(first, last) : [],
    departments: uniqueSorted(events.map((e) => e.department)),
    providers: uniqueSorted(events.map((e) => e.provider)),
    models: uniqueSorted(events.map((e) => e.model)),
    useCases: uniqueSorted(events.map((e) => e.useCase)),
  };
}
