/**
 * AI Workflow Value & Quality: CSV schemas and normalization (the validation boundary).
 * Blank rework or quality values are kept as null (not recorded / not audited), never coerced to zero.
 */
import { COMPLEXITIES, type WorkflowAssumptions, type WorkflowRecord } from '@/analysis/workflow';
import { DataError, IssueLog, type NormalizeResult } from '@/data/errors';
import { parseEnum, parseMonth, parseNumber, parseText, requireColumns, requireRows, type RawRow } from '@/data/normalize';

export const RECORDS_FILE = 'workflow_records.csv';
export const ASSUMPTIONS_FILE = 'cost_assumptions.csv';

export const RECORD_COLUMNS = [
  'task_id', 'month', 'workflow', 'complexity', 'team', 'process', 'handling_minutes', 'review_minutes', 'rework_minutes', 'quality_outcome', 'escalated',
] as const;
export const ASSUMPTION_COLUMNS = ['parameter', 'value', 'unit', 'basis', 'description'] as const;

/** Upper bound for a single minutes value; anything larger is treated as a data-entry error. */
const MAX_MINUTES = 24 * 60;

export function normalizeWorkflowRecords(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<WorkflowRecord> {
  requireColumns(RECORDS_FILE, headers, RECORD_COLUMNS);
  const issues = new IssueLog();
  const rows: WorkflowRecord[] = [];
  const seen = new Set<string>();

  raw.forEach((r, index) => {
    const n = index + 1;
    const taskId = parseText(r['task_id']);
    const month = parseMonth(r['month']);
    const workflow = parseText(r['workflow']);
    const team = parseText(r['team']);
    const complexity = parseEnum(r['complexity'], COMPLEXITIES);
    const process = parseEnum(r['process'], ['baseline', 'ai_assisted'] as const);
    if (taskId === null || month === null || workflow === null || team === null || complexity === null || process === null) {
      return issues.add('invalid_dimension', 'Row dropped: blank or invalid task_id, month, workflow, complexity, team, or process', n);
    }
    if (seen.has(taskId)) return issues.add('duplicate_task_id', 'Row dropped: duplicate task_id (first kept)', n);

    const handling = parseNumber(r['handling_minutes']);
    const review = parseNumber(r['review_minutes']);
    if (handling === null || review === null || handling < 0 || review < 0 || handling > MAX_MINUTES || review > MAX_MINUTES) {
      return issues.add('invalid_minutes', 'Row dropped: handling_minutes or review_minutes is blank, negative, or not a plausible number', n);
    }

    let reworkMinutes: number | null = null;
    const reworkRaw = parseText(r['rework_minutes']);
    if (reworkRaw === null) {
      issues.add('missing_rework', 'Row kept: rework_minutes not recorded (excluded from time and cost metrics, not treated as 0)', n);
    } else {
      const rework = parseNumber(reworkRaw);
      if (rework === null || rework < 0 || rework > MAX_MINUTES) return issues.add('invalid_minutes', 'Row dropped: rework_minutes is not a valid number', n);
      reworkMinutes = rework;
    }

    let quality: WorkflowRecord['quality'] = null;
    const qualityRaw = parseText(r['quality_outcome']);
    if (qualityRaw === null) {
      issues.add('missing_quality', 'Row kept: quality_outcome not audited (excluded from pass-rate and cost-per-success, not treated as pass or fail)', n);
    } else {
      quality = parseEnum(qualityRaw, ['pass', 'fail'] as const);
      if (quality === null) return issues.add('invalid_quality', 'Row dropped: quality_outcome is not pass or fail', n);
    }

    const escalated = parseEnum(r['escalated'], ['yes', 'no'] as const);
    if (escalated === null) return issues.add('invalid_escalated', 'Row dropped: escalated is not yes or no', n);

    seen.add(taskId);
    rows.push({ taskId, month, workflow, complexity, team, process, handlingMinutes: handling, reviewMinutes: review, reworkMinutes, quality, escalated: escalated === 'yes' });
  });

  requireRows(RECORDS_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

const PARAMETER_KEYS: Record<keyof WorkflowAssumptions, string> = {
  laborRateUsdPerHour: 'labor_rate_usd_per_hour',
  aiVariableCostUsdPerTask: 'ai_variable_cost_usd_per_task',
  escalationCostUsdPerTask: 'escalation_cost_usd_per_task',
  softwareUsdPerMonth: 'ai_software_usd_per_month',
  implementationOneTimeUsd: 'implementation_one_time_usd',
  trainingOneTimeUsd: 'training_one_time_usd',
};

/** Every parameter is required and must be a non-negative number: a missing assumption is an error, not a zero. */
export function normalizeAssumptions(headers: readonly string[], raw: readonly RawRow[]): WorkflowAssumptions {
  requireColumns(ASSUMPTIONS_FILE, headers, ASSUMPTION_COLUMNS);
  const values = new Map<string, number>();
  for (const r of raw) {
    const key = parseText(r['parameter']);
    const value = parseNumber(r['value']);
    if (key !== null && value !== null && value >= 0) values.set(key, value);
  }
  const missing = Object.values(PARAMETER_KEYS).filter((k) => !values.has(k));
  if (missing.length > 0) {
    throw new DataError(`${ASSUMPTIONS_FILE} is missing or has invalid values for: ${missing.join(', ')}.`, [
      'Each parameter needs a non-negative numeric value. See docs/data-dictionary.md.',
    ]);
  }
  const get = (k: keyof WorkflowAssumptions): number => values.get(PARAMETER_KEYS[k]) ?? Number.NaN;
  return {
    laborRateUsdPerHour: get('laborRateUsdPerHour'),
    aiVariableCostUsdPerTask: get('aiVariableCostUsdPerTask'),
    escalationCostUsdPerTask: get('escalationCostUsdPerTask'),
    softwareUsdPerMonth: get('softwareUsdPerMonth'),
    implementationOneTimeUsd: get('implementationOneTimeUsd'),
    trainingOneTimeUsd: get('trainingOneTimeUsd'),
  };
}
