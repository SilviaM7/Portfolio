/**
 * Everything the AI Workflow view shows, derived from (dataset, filters) and (dataset, scenario params) in pure
 * functions, so KPIs, charts, and tables always read the same filtered records.
 *
 * Deliberate split: the descriptive analysis follows the filters; the value scenario is built from the FULL
 * dataset (per complexity level), because break-even and payback describe the whole pilot program, whose software
 * and one-time costs cannot be divided among filter slices. The view states this next to the scenario.
 */
import {
  buildScenarioBase,
  byComplexity,
  compareProcesses,
  cumulativeValue,
  estimateValue,
  filterRecords,
  monthlyTrend,
  pilotTeams,
  sensitivity,
  workflowFilterOptions,
  type ComplexityRow,
  type MonthlyTrendRow,
  type ProcessComparison,
  type ScenarioBase,
  type SensitivityRow,
  type ValueEstimate,
  type ValueParams,
  type WorkflowFilters,
  type WorkflowRecord,
} from '@/analysis/workflow';
import type { WorkflowDataset } from './load';

/** Months shown in the payback chart. */
export const PAYBACK_HORIZON_MONTHS = 24;

export interface WorkflowViewModel {
  records: WorkflowRecord[];
  /** Months inside the selected range (x-axis of the trend chart). */
  months: string[];
  comparison: ProcessComparison;
  complexity: ComplexityRow[];
  trend: MonthlyTrendRow[];
  /** First month with AI-assisted work in the full dataset (marks the pilot start on the trend chart). */
  pilotStart: string | null;
  pilotTeams: string[];
  options: ReturnType<typeof workflowFilterOptions>;
}

export function buildWorkflowView(data: WorkflowDataset, filters: WorkflowFilters): WorkflowViewModel {
  const options = workflowFilterOptions(data.records);
  const months = options.months.filter((m) => (filters.fromMonth === null || m >= filters.fromMonth) && (filters.toMonth === null || m <= filters.toMonth));
  const records = filterRecords(data.records, filters);
  const pilot = pilotTeams(data.records);
  const aiMonths = data.records.filter((r) => r.process === 'ai_assisted').map((r) => r.month).sort();
  return {
    records,
    months,
    comparison: compareProcesses(records, data.records, data.assumptions),
    complexity: byComplexity(records, data.assumptions),
    trend: monthlyTrend(records, months, pilot, data.assumptions),
    pilotStart: aiMonths[0] ?? null,
    pilotTeams: [...pilot].sort(),
    options,
  };
}

export interface ScenarioViewModel {
  estimate: ValueEstimate;
  /** Cumulative estimated value and cumulative cash, month 0 = one-time costs paid. */
  payback: { month: number; estimatedUsd: number; cashUsd: number }[];
  sensitivity: SensitivityRow[];
}

/** Null base means the full dataset has no usable baseline/AI pair at any complexity level. */
export function buildScenarioView(base: ScenarioBase, params: ValueParams): ScenarioViewModel {
  const estimate = estimateValue(base, params);
  const est = cumulativeValue(estimate.estimatedNetValueUsdPerMonth, estimate.oneTimeUsd, PAYBACK_HORIZON_MONTHS);
  const cash = cumulativeValue(estimate.cashNetUsdPerMonth, estimate.oneTimeUsd, PAYBACK_HORIZON_MONTHS);
  return {
    estimate,
    payback: est.map((p, i) => ({ month: p.month, estimatedUsd: p.cumulativeUsd, cashUsd: cash[i]?.cumulativeUsd ?? 0 })),
    sensitivity: sensitivity(base, params),
  };
}

export function scenarioBaseFor(data: WorkflowDataset): ScenarioBase | null {
  return buildScenarioBase(data.records, data.assumptions);
}
