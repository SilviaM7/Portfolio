/**
 * AI Workflow Value & Quality: pure calculations. No React, no network.
 *
 * Definitions (also shown to visitors in the methodology panel):
 *   - Minutes per task = handling + review + rework. Rows with a BLANK rework value are excluded from every
 *     time and cost metric (never treated as zero rework).
 *   - Pass rate = pass / (pass + fail) over audited rows. Blank quality outcomes are excluded (not audited).
 *   - Escalation rate = escalated tasks / all tasks.
 *   - Operating cost per task (USD) = minutes / 60 x labor rate + AI variable cost (AI-assisted only)
 *                                     + escalation cost (escalated tasks only).
 *   - Cost per SUCCESSFUL task = total operating cost of all analyzable tasks (passed AND failed) /
 *     number of passed tasks. Failed work therefore raises the cost of each success.
 *   - Program costs (software subscription for the months the pilot ran, one-time implementation and training)
 *     are reported separately and allocated to AI-assisted tasks in proportion to the tasks in view.
 *   - Labor costs are an ESTIMATED VALUE OF TIME at a fully loaded rate. Released capacity is not cash:
 *     cash savings exist only if hours are actually removed from payroll or avoided spend (modeled as an explicit share).
 *   - Baseline vs AI-assisted comparisons are DESCRIPTIVE. The pilot teams were not randomly chosen and one pilot
 *     team had an easier task mix, so differences are also shown standardized to the AI-assisted complexity mix.
 */
import { clamp, groupBy, safeDivide, sum, uniqueSorted } from './common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COMPLEXITIES = ['low', 'medium', 'high'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];
export type Process = 'baseline' | 'ai_assisted';
export type QualityOutcome = 'pass' | 'fail';

export interface WorkflowRecord {
  taskId: string;
  month: string;
  workflow: string;
  complexity: Complexity;
  team: string;
  process: Process;
  handlingMinutes: number;
  reviewMinutes: number;
  /** Null = not recorded. */
  reworkMinutes: number | null;
  /** Null = not audited. */
  quality: QualityOutcome | null;
  escalated: boolean;
}

export interface WorkflowAssumptions {
  laborRateUsdPerHour: number;
  aiVariableCostUsdPerTask: number;
  escalationCostUsdPerTask: number;
  softwareUsdPerMonth: number;
  implementationOneTimeUsd: number;
  trainingOneTimeUsd: number;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface WorkflowFilters {
  fromMonth: string | null;
  toMonth: string | null;
  workflow: string | null;
  complexity: Complexity | null;
  team: string | null;
}

export const EMPTY_WORKFLOW_FILTERS: WorkflowFilters = { fromMonth: null, toMonth: null, workflow: null, complexity: null, team: null };

export function isWorkflowFiltered(f: WorkflowFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}

export function filterRecords(records: readonly WorkflowRecord[], f: WorkflowFilters): WorkflowRecord[] {
  return records.filter(
    (r) =>
      (f.fromMonth === null || r.month >= f.fromMonth) &&
      (f.toMonth === null || r.month <= f.toMonth) &&
      (f.workflow === null || r.workflow === f.workflow) &&
      (f.complexity === null || r.complexity === f.complexity) &&
      (f.team === null || r.team === f.team),
  );
}

// ---------------------------------------------------------------------------
// Task-level calculations
// ---------------------------------------------------------------------------

/** Minutes per task, or null when rework was not recorded. */
export function taskMinutes(r: WorkflowRecord): number | null {
  return r.reworkMinutes === null ? null : r.handlingMinutes + r.reviewMinutes + r.reworkMinutes;
}

/** Estimated labor value of the minutes (USD), excluding AI variable cost and escalation. */
export function laborCostUsd(minutes: number, a: WorkflowAssumptions): number {
  return (minutes / 60) * a.laborRateUsdPerHour;
}

/** Operating cost of one task (USD), or null when minutes are not fully recorded. */
export function taskCostUsd(r: WorkflowRecord, a: WorkflowAssumptions): number | null {
  const minutes = taskMinutes(r);
  if (minutes === null) return null;
  return laborCostUsd(minutes, a) + (r.process === 'ai_assisted' ? a.aiVariableCostUsdPerTask : 0) + (r.escalated ? a.escalationCostUsdPerTask : 0);
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export interface ProcessSummary {
  tasks: number;
  /** Tasks with rework recorded (denominator of the time and cost metrics). */
  timeTasks: number;
  meanMinutes: number | null;
  meanHandlingMinutes: number | null;
  meanReviewMinutes: number | null;
  meanReworkMinutes: number | null;
  auditedTasks: number;
  passedTasks: number;
  passRate: number | null;
  escalatedTasks: number;
  escalationRate: number | null;
  /** Tasks with both rework recorded and quality audited. */
  analyzableTasks: number;
  analyzableOperatingCostUsd: number;
  successfulTasks: number;
  /** analyzable operating cost / successful tasks (USD per successful task), before program costs. */
  costPerSuccessfulTaskUsd: number | null;
  /** Total hours of all recorded time. */
  totalHours: number;
}

export function summarizeProcess(rows: readonly WorkflowRecord[], a: WorkflowAssumptions): ProcessSummary {
  const timed = rows.filter((r) => r.reworkMinutes !== null);
  const audited = rows.filter((r) => r.quality !== null);
  const analyzable = rows.filter((r) => r.reworkMinutes !== null && r.quality !== null);
  const passed = audited.filter((r) => r.quality === 'pass');
  const analyzableCost = sum(analyzable.map((r) => taskCostUsd(r, a) ?? 0));
  const successful = analyzable.filter((r) => r.quality === 'pass').length;
  const mean = (values: number[]): number | null => (values.length > 0 ? sum(values) / values.length : null);
  return {
    tasks: rows.length,
    timeTasks: timed.length,
    meanMinutes: mean(timed.map((r) => taskMinutes(r) ?? 0)),
    meanHandlingMinutes: mean(timed.map((r) => r.handlingMinutes)),
    meanReviewMinutes: mean(timed.map((r) => r.reviewMinutes)),
    meanReworkMinutes: mean(timed.map((r) => r.reworkMinutes ?? 0)),
    auditedTasks: audited.length,
    passedTasks: passed.length,
    passRate: safeDivide(passed.length, audited.length),
    escalatedTasks: rows.filter((r) => r.escalated).length,
    escalationRate: safeDivide(rows.filter((r) => r.escalated).length, rows.length),
    analyzableTasks: analyzable.length,
    analyzableOperatingCostUsd: analyzableCost,
    successfulTasks: successful,
    costPerSuccessfulTaskUsd: safeDivide(analyzableCost, successful),
    totalHours: sum(timed.map((r) => (taskMinutes(r) ?? 0) / 60)),
  };
}

export function splitByProcess(rows: readonly WorkflowRecord[]): { baseline: WorkflowRecord[]; ai: WorkflowRecord[] } {
  return { baseline: rows.filter((r) => r.process === 'baseline'), ai: rows.filter((r) => r.process === 'ai_assisted') };
}

// ---------------------------------------------------------------------------
// Complexity standardization (so a different task mix is not mistaken for a process effect)
// ---------------------------------------------------------------------------

export type ComplexityMix = Record<Complexity, number>;

export function complexityMix(rows: readonly WorkflowRecord[]): ComplexityMix {
  const total = rows.length;
  return {
    low: total === 0 ? 0 : rows.filter((r) => r.complexity === 'low').length / total,
    medium: total === 0 ? 0 : rows.filter((r) => r.complexity === 'medium').length / total,
    high: total === 0 ? 0 : rows.filter((r) => r.complexity === 'high').length / total,
  };
}

/**
 * Weighted mean of a per-row value, reweighted so the rows' complexity mix equals `mix`.
 * Complexity levels with no usable rows are dropped and the remaining weights renormalized.
 */
export function standardizedMean(rows: readonly WorkflowRecord[], mix: ComplexityMix, valueOf: (r: WorkflowRecord) => number | null): number | null {
  let weighted = 0;
  let weight = 0;
  for (const c of COMPLEXITIES) {
    const values = rows.filter((r) => r.complexity === c).map(valueOf).filter((v): v is number => v !== null);
    if (values.length === 0 || mix[c] === 0) continue;
    weighted += mix[c] * (sum(values) / values.length);
    weight += mix[c];
  }
  return weight === 0 ? null : weighted / weight;
}

export interface ProcessComparison {
  baseline: ProcessSummary;
  ai: ProcessSummary;
  /** Raw difference in mean minutes per task (baseline - AI; positive = AI faster). */
  minutesSavedRaw: number | null;
  /** Same, with the baseline reweighted to the AI-assisted complexity mix. */
  minutesSavedStandardized: number | null;
  /** AI pass rate minus baseline pass rate (percentage points as a ratio). */
  passRateDelta: number | null;
  escalationRateDelta: number | null;
  /** baseline - AI cost per successful task (positive = AI cheaper), before program costs. */
  costPerSuccessDeltaUsd: number | null;
  /** AI operating cost per successful task including allocated program costs. */
  aiCostPerSuccessWithProgramUsd: number | null;
  allocatedProgramCostUsd: number;
}

export function programCostUsd(allRecords: readonly WorkflowRecord[], a: WorkflowAssumptions): number {
  const pilotMonths = new Set(allRecords.filter((r) => r.process === 'ai_assisted').map((r) => r.month)).size;
  return a.softwareUsdPerMonth * pilotMonths + a.implementationOneTimeUsd + a.trainingOneTimeUsd;
}

/**
 * Compare processes within the filtered rows. Program cost is allocated by the share of all
 * AI-assisted tasks that fall inside the filtered rows, so a filtered view never carries the full program cost.
 */
export function compareProcesses(rows: readonly WorkflowRecord[], allRecords: readonly WorkflowRecord[], a: WorkflowAssumptions): ProcessComparison {
  const { baseline, ai } = splitByProcess(rows);
  const b = summarizeProcess(baseline, a);
  const s = summarizeProcess(ai, a);
  const mix = complexityMix(ai);
  const stdBaseline = standardizedMean(baseline, mix, taskMinutes);
  const allAi = allRecords.filter((r) => r.process === 'ai_assisted').length;
  const allocated = allAi === 0 ? 0 : programCostUsd(allRecords, a) * (ai.length / allAi);
  return {
    baseline: b,
    ai: s,
    minutesSavedRaw: b.meanMinutes !== null && s.meanMinutes !== null ? b.meanMinutes - s.meanMinutes : null,
    minutesSavedStandardized: stdBaseline !== null && s.meanMinutes !== null ? stdBaseline - s.meanMinutes : null,
    passRateDelta: b.passRate !== null && s.passRate !== null ? s.passRate - b.passRate : null,
    escalationRateDelta: b.escalationRate !== null && s.escalationRate !== null ? s.escalationRate - b.escalationRate : null,
    costPerSuccessDeltaUsd: b.costPerSuccessfulTaskUsd !== null && s.costPerSuccessfulTaskUsd !== null ? b.costPerSuccessfulTaskUsd - s.costPerSuccessfulTaskUsd : null,
    aiCostPerSuccessWithProgramUsd: safeDivide(s.analyzableOperatingCostUsd + allocated, s.successfulTasks),
    allocatedProgramCostUsd: allocated,
  };
}

// ---------------------------------------------------------------------------
// Grouped views for charts
// ---------------------------------------------------------------------------

export interface ComplexityRow {
  complexity: Complexity;
  baselineTasks: number;
  aiTasks: number;
  baselineMinutes: number | null;
  aiMinutes: number | null;
  baselinePassRate: number | null;
  aiPassRate: number | null;
}

export function byComplexity(rows: readonly WorkflowRecord[], a: WorkflowAssumptions): ComplexityRow[] {
  return COMPLEXITIES.map((complexity) => {
    const { baseline, ai } = splitByProcess(rows.filter((r) => r.complexity === complexity));
    const b = summarizeProcess(baseline, a);
    const s = summarizeProcess(ai, a);
    return {
      complexity,
      baselineTasks: b.tasks,
      aiTasks: s.tasks,
      baselineMinutes: b.meanMinutes,
      aiMinutes: s.meanMinutes,
      baselinePassRate: b.passRate,
      aiPassRate: s.passRate,
    };
  });
}

export interface MonthlyTrendRow {
  month: string;
  pilotTasks: number;
  comparisonTasks: number;
  pilotMinutes: number | null;
  comparisonMinutes: number | null;
}

/** Pilot teams = teams that run AI-assisted work at any time in the full dataset. */
export function pilotTeams(allRecords: readonly WorkflowRecord[]): Set<string> {
  return new Set(allRecords.filter((r) => r.process === 'ai_assisted').map((r) => r.team));
}

export function monthlyTrend(rows: readonly WorkflowRecord[], months: readonly string[], pilot: ReadonlySet<string>, a: WorkflowAssumptions): MonthlyTrendRow[] {
  const byMonth = groupBy(rows, (r) => r.month);
  return months.map((month) => {
    const inMonth = byMonth.get(month) ?? [];
    const p = summarizeProcess(inMonth.filter((r) => pilot.has(r.team)), a);
    const c = summarizeProcess(inMonth.filter((r) => !pilot.has(r.team)), a);
    return { month, pilotTasks: p.tasks, comparisonTasks: c.tasks, pilotMinutes: p.meanMinutes, comparisonMinutes: c.meanMinutes };
  });
}

// ---------------------------------------------------------------------------
// Break-even, payback, and sensitivity (scenario estimates, not realized savings)
// ---------------------------------------------------------------------------

/** Inputs for one complexity level, measured within that level so task mix cannot distort the comparison. */
export interface LevelBase {
  complexity: Complexity;
  /** Share of observed AI-assisted tasks at this level (shares of usable levels sum to 1). */
  share: number;
  baselineMinutes: number;
  aiMinutes: number;
  baselinePassRate: number;
  aiPassRate: number;
  baselineEscalationRate: number;
  aiEscalationRate: number;
}

export interface ScenarioBase {
  levels: LevelBase[];
  /** Observed AI-assisted tasks per pilot month. */
  observedAiTasksPerMonth: number;
  assumptions: WorkflowAssumptions;
}

function meanOf(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

/**
 * Build scenario inputs from the FULL dataset (scenario inputs ignore the on-screen filters).
 * A complexity level without usable baseline AND AI rows is left out and the remaining shares renormalized.
 * Null when no level is usable.
 */
export function buildScenarioBase(allRecords: readonly WorkflowRecord[], a: WorkflowAssumptions): ScenarioBase | null {
  const { baseline, ai } = splitByProcess(allRecords);
  const pilotMonths = new Set(ai.map((r) => r.month)).size;
  if (pilotMonths === 0) return null;

  const stats = (rows: WorkflowRecord[]) => ({
    n: rows.length,
    minutes: meanOf(rows.map(taskMinutes).filter((v): v is number => v !== null)),
    pass: meanOf(rows.filter((r) => r.quality !== null).map((r) => (r.quality === 'pass' ? 1 : 0))),
    escalation: meanOf(rows.map((r) => (r.escalated ? 1 : 0))),
  });

  const usable: Omit<LevelBase, 'share'>[] = [];
  const counts: number[] = [];
  for (const complexity of COMPLEXITIES) {
    const b = stats(baseline.filter((r) => r.complexity === complexity));
    const s = stats(ai.filter((r) => r.complexity === complexity));
    if (b.minutes === null || b.pass === null || b.escalation === null || s.minutes === null || s.pass === null || s.escalation === null) continue;
    usable.push({
      complexity,
      baselineMinutes: b.minutes,
      aiMinutes: s.minutes,
      baselinePassRate: b.pass,
      aiPassRate: s.pass,
      baselineEscalationRate: b.escalation,
      aiEscalationRate: s.escalation,
    });
    counts.push(s.n);
  }
  const total = sum(counts);
  if (usable.length === 0 || total === 0) return null;
  const levels = usable.map((level, i) => ({ ...level, share: (counts[i] ?? 0) / total }));
  return { levels, observedAiTasksPerMonth: ai.length / pilotMonths, assumptions: a };
}

export interface ValueParams {
  /** Tasks per month handled in the workflow (all processes). */
  monthlyVolume: number;
  /** Share (0-1) of that volume that actually goes through the AI-assisted process. */
  adoptionShare: number;
  /** Complexity levels routed to AI-assisted work. Others stay on the baseline process. */
  complexities: readonly Complexity[];
  /** Multiplier on the observed minutes saved (1 = as observed). */
  timeSavingsFactor: number;
  /** Percentage points (as a ratio, e.g. -0.05) added to the AI pass rate. */
  passRateShift: number;
  /** Multiplier on the labor rate (1 = assumption as given). */
  laborRateFactor: number;
  /** Share (0-1) of estimated labor value converted to real cash savings (avoided hiring/overtime, headcount). */
  cashRealizationShare: number;
}

export function defaultValueParams(base: ScenarioBase): ValueParams {
  return {
    monthlyVolume: Math.round(base.observedAiTasksPerMonth),
    adoptionShare: 1,
    complexities: COMPLEXITIES,
    timeSavingsFactor: 1,
    passRateShift: 0,
    laborRateFactor: 1,
    cashRealizationShare: 0,
  };
}

export interface ValueEstimate {
  /** AI-routed tasks per month after adoption and complexity scope. */
  aiRoutedTasksPerMonth: number;
  /** Hours of staff time released per month (capacity, not cash). */
  capacityHoursPerMonth: number;
  /** Estimated benefit per month valued at the labor rate, net of AI variable cost (USD; not cash). */
  estimatedGrossValueUsdPerMonth: number;
  softwareUsdPerMonth: number;
  /** estimated gross value - software (USD per month; an estimate of value, not realized savings). */
  estimatedNetValueUsdPerMonth: number;
  /** Cash view: cash realization share x labor value - AI variable cost - software (USD per month). Negative = cost with no cash offset. */
  cashNetUsdPerMonth: number;
  oneTimeUsd: number;
  /** AI-routed tasks per month at which estimated net value is zero. Null when AI is not cheaper per successful task. */
  breakEvenAiTasksPerMonth: number | null;
  paybackMonthsEstimated: number | null;
  paybackMonthsCash: number | null;
  /** Estimated value per AI-routed successful task (USD), baseline minus AI, net of AI variable cost. */
  valuePerSuccessfulTaskUsd: number;
}

/** Labor + escalation cost per SUCCESSFUL task (failed work is spread over the successes), and the AI cost per success. */
function perSuccess(minutes: number, escalationRate: number, passRate: number, aiVariable: number, a: WorkflowAssumptions, rateFactor: number): { labor: number; aiVariable: number } {
  const pass = clamp(passRate, 0.01, 1);
  const labor = ((minutes / 60) * a.laborRateUsdPerHour + escalationRate * a.escalationCostUsdPerTask) * rateFactor;
  return { labor: labor / pass, aiVariable: aiVariable / pass };
}

export function estimateValue(base: ScenarioBase, params: ValueParams): ValueEstimate {
  const a = base.assumptions;
  const adoption = clamp(params.adoptionShare, 0, 1);
  const cashShare = clamp(params.cashRealizationShare, 0, 1);
  const volume = Math.max(0, params.monthlyVolume) * adoption;

  let routed = 0;
  let capacityMinutes = 0;
  let laborBenefit = 0;
  let aiVariable = 0;
  for (const level of base.levels) {
    if (!params.complexities.includes(level.complexity)) continue;
    const tasks = volume * level.share;
    const minutesSaved = (level.baselineMinutes - level.aiMinutes) * params.timeSavingsFactor;
    const aiPass = clamp(level.aiPassRate + params.passRateShift, 0.01, 1);
    const b = perSuccess(level.baselineMinutes, level.baselineEscalationRate, level.baselinePassRate, 0, a, params.laborRateFactor);
    const s = perSuccess(Math.max(0, level.baselineMinutes - minutesSaved), level.aiEscalationRate, aiPass, a.aiVariableCostUsdPerTask, a, params.laborRateFactor);
    routed += tasks;
    capacityMinutes += tasks * minutesSaved;
    laborBenefit += tasks * (b.labor - s.labor);
    aiVariable += tasks * s.aiVariable;
  }

  const gross = laborBenefit - aiVariable;
  const net = gross - a.softwareUsdPerMonth;
  const cashNet = cashShare * laborBenefit - aiVariable - a.softwareUsdPerMonth;
  const oneTime = a.implementationOneTimeUsd + a.trainingOneTimeUsd;
  const valuePerTask = routed > 0 ? gross / routed : 0;

  return {
    aiRoutedTasksPerMonth: routed,
    capacityHoursPerMonth: capacityMinutes / 60,
    estimatedGrossValueUsdPerMonth: gross,
    softwareUsdPerMonth: a.softwareUsdPerMonth,
    estimatedNetValueUsdPerMonth: net,
    cashNetUsdPerMonth: cashNet,
    oneTimeUsd: oneTime,
    breakEvenAiTasksPerMonth: valuePerTask > 0 ? a.softwareUsdPerMonth / valuePerTask : null,
    paybackMonthsEstimated: net > 0 ? oneTime / net : null,
    paybackMonthsCash: cashNet > 0 ? oneTime / cashNet : null,
    valuePerSuccessfulTaskUsd: valuePerTask,
  };
}

/** Cumulative value after `months` months, starting from the one-time cost: -oneTime + months x monthly. */
export function cumulativeValue(monthlyUsd: number, oneTimeUsd: number, horizonMonths: number): { month: number; cumulativeUsd: number }[] {
  return Array.from({ length: horizonMonths + 1 }, (_, month) => ({ month, cumulativeUsd: -oneTimeUsd + month * monthlyUsd }));
}

export interface SensitivityRow {
  parameter: string;
  setting: string;
  estimatedNetValueUsdPerMonth: number;
  paybackMonthsEstimated: number | null;
}

/** One-at-a-time sensitivity around `params`. Each row changes exactly one input. */
export function sensitivity(base: ScenarioBase, params: ValueParams): SensitivityRow[] {
  const rows: SensitivityRow[] = [];
  const add = (parameter: string, setting: string, change: Partial<ValueParams>) => {
    const e = estimateValue(base, { ...params, ...change });
    rows.push({ parameter, setting, estimatedNetValueUsdPerMonth: e.estimatedNetValueUsdPerMonth, paybackMonthsEstimated: e.paybackMonthsEstimated });
  };
  for (const v of [1, 2, 5, 10]) add('Monthly volume', `${v}× current volume`, { monthlyVolume: params.monthlyVolume * v });
  add('Complexity scope', 'All complexities', { complexities: COMPLEXITIES });
  add('Complexity scope', 'Low and medium only', { complexities: ['low', 'medium'] });
  for (const v of [0.5, 0.75, 1]) add('Adoption share', `${v * 100}% of volume`, { adoptionShare: v });
  for (const v of [0.5, 0.75, 1, 1.25]) add('Time savings vs observed', `${v * 100}%`, { timeSavingsFactor: v });
  for (const v of [-0.05, 0, 0.02]) add('AI pass-rate shift', `${v >= 0 ? '+' : '−'}${Math.abs(v * 100)} pts`, { passRateShift: v });
  for (const v of [0.8, 1, 1.2]) add('Labor rate', `${v * 100}% of assumption`, { laborRateFactor: v });
  return rows;
}

export function workflowFilterOptions(records: readonly WorkflowRecord[]): { months: string[]; workflows: string[]; teams: string[] } {
  return {
    months: uniqueSorted(records.map((r) => r.month)),
    workflows: uniqueSorted(records.map((r) => r.workflow)),
    teams: uniqueSorted(records.map((r) => r.team)),
  };
}
