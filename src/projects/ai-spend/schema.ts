/**
 * AI Spend & Consumption: CSV schemas and normalization (the validation boundary).
 * Rows that cannot be used are dropped and counted; nothing invalid is silently coerced to zero.
 */
import type { Budget, PriceEntry, UsageEvent } from '@/analysis/spend';
import { IssueLog, type NormalizeResult } from '@/data/errors';
import {
  parseCount,
  parseEnum,
  parseIsoDate,
  parseMonth,
  parseNumber,
  parseText,
  requireColumns,
  requireRows,
  type RawRow,
} from '@/data/normalize';
import { monthKey } from '@/lib/dates';

export const USAGE_FILE = 'usage_events.csv';
export const PRICING_FILE = 'model_pricing.csv';
export const BUDGET_FILE = 'department_budgets.csv';

export const USAGE_COLUMNS = [
  'request_id', 'event_date', 'department', 'use_case', 'provider', 'model',
  'input_tokens', 'output_tokens', 'cached_input_tokens', 'status', 'latency_ms',
  'retry_of_request_id', 'task_id', 'task_outcome',
] as const;
export const PRICING_COLUMNS = [
  'model', 'provider', 'effective_from', 'effective_to',
  'input_usd_per_mtok', 'cached_input_usd_per_mtok', 'output_usd_per_mtok', 'price_basis',
] as const;
export const BUDGET_COLUMNS = ['month', 'department', 'budget_usd'] as const;

export function normalizeUsageEvents(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<UsageEvent> {
  requireColumns(USAGE_FILE, headers, USAGE_COLUMNS);
  const issues = new IssueLog();
  const rows: UsageEvent[] = [];
  const seen = new Set<string>();

  raw.forEach((r, index) => {
    const n = index + 1;
    const requestId = parseText(r['request_id']);
    if (requestId === null) return issues.add('missing_request_id', 'Row dropped: blank request_id', n);
    if (seen.has(requestId)) return issues.add('duplicate_request_id', 'Row dropped: duplicate request_id (first occurrence kept)', n);

    const date = parseIsoDate(r['event_date']);
    if (date === null) return issues.add('invalid_date', 'Row dropped: event_date is not a valid YYYY-MM-DD date', n);

    const department = parseText(r['department']);
    const useCase = parseText(r['use_case']);
    const provider = parseText(r['provider']);
    const model = parseText(r['model']);
    const taskId = parseText(r['task_id']);
    if (department === null || useCase === null || provider === null || model === null || taskId === null) {
      return issues.add('missing_dimension', 'Row dropped: blank department, use_case, provider, model, or task_id', n);
    }

    const inputTokens = parseCount(r['input_tokens']);
    const outputTokens = parseCount(r['output_tokens']);
    const cachedTokens = parseCount(r['cached_input_tokens']);
    if (inputTokens === null || outputTokens === null || cachedTokens === null) {
      return issues.add('invalid_tokens', 'Row dropped: a token count is blank, negative, or not a whole number', n);
    }

    const status = parseEnum(r['status'], ['success', 'failed'] as const);
    const taskOutcome = parseEnum(r['task_outcome'], ['completed', 'abandoned'] as const);
    if (status === null || taskOutcome === null) return issues.add('invalid_status', 'Row dropped: status or task_outcome is not an allowed value', n);

    let latencyMs: number | null = null;
    const latencyRaw = parseText(r['latency_ms']);
    if (latencyRaw === null) issues.add('missing_latency', 'Row kept: latency_ms is blank (excluded from latency statistics, not treated as 0)', n);
    else {
      const latency = parseNumber(latencyRaw);
      if (latency === null || latency < 0) issues.add('invalid_latency', 'Row kept: latency_ms is not a valid number (excluded from latency statistics)', n);
      else latencyMs = latency;
    }

    seen.add(requestId);
    rows.push({
      requestId, date, month: monthKey(date), department, useCase, provider, model,
      inputTokens, outputTokens, cachedTokens, status, latencyMs,
      retryOf: parseText(r['retry_of_request_id']), taskId, taskOutcome,
    });
  });

  requireRows(USAGE_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

export function normalizePrices(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<PriceEntry> {
  requireColumns(PRICING_FILE, headers, PRICING_COLUMNS);
  const issues = new IssueLog();
  const rows: PriceEntry[] = [];

  raw.forEach((r, index) => {
    const n = index + 1;
    const model = parseText(r['model']);
    const provider = parseText(r['provider']);
    const from = parseIsoDate(r['effective_from']);
    const toRaw = parseText(r['effective_to']);
    const to = toRaw === null ? null : parseIsoDate(toRaw);
    const input = parseNumber(r['input_usd_per_mtok']);
    const cached = parseNumber(r['cached_input_usd_per_mtok']);
    const output = parseNumber(r['output_usd_per_mtok']);
    if (model === null || provider === null || from === null || (toRaw !== null && to === null)) {
      return issues.add('invalid_price_row', 'Price row dropped: model, provider, or effective dates are invalid', n);
    }
    if (input === null || cached === null || output === null || input < 0 || cached < 0 || output < 0) {
      return issues.add('invalid_price_value', 'Price row dropped: a rate is blank, negative, or not a number', n);
    }
    if (to !== null && to < from) return issues.add('invalid_price_range', 'Price row dropped: effective_to is before effective_from', n);
    rows.push({ model, provider, effectiveFrom: from, effectiveTo: to, inputPerMtok: input, cachedPerMtok: cached, outputPerMtok: output });
  });

  requireRows(PRICING_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

export function normalizeBudgets(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<Budget> {
  requireColumns(BUDGET_FILE, headers, BUDGET_COLUMNS);
  const issues = new IssueLog();
  const rows: Budget[] = [];

  raw.forEach((r, index) => {
    const n = index + 1;
    const month = parseMonth(r['month']);
    const department = parseText(r['department']);
    const budgetUsd = parseNumber(r['budget_usd']);
    if (month === null || department === null) return issues.add('invalid_budget_row', 'Budget row dropped: month or department is invalid', n);
    if (budgetUsd === null || budgetUsd < 0) return issues.add('invalid_budget_value', 'Budget row dropped: budget_usd is blank, negative, or not a number', n);
    rows.push({ month, department, budgetUsd });
  });

  requireRows(BUDGET_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}
