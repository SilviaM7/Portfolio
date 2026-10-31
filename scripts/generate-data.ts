/**
 * Deterministic synthetic dataset generator.
 *
 *   npm run generate:data     -> (re)writes public/data/**
 *   npm run check:data        -> fails if committed CSVs differ from a fresh generation
 *
 * Everything here is FICTIONAL. Provider names, model names, prices, products, headcounts
 * and outcomes are invented to demonstrate analytical methods. Patterns are seeded on purpose
 * (see the "seeded patterns" comments); they are not empirical findings.
 *
 * Reproducibility: one documented seed (SEED). Each dataset uses its own random stream
 * (SEED + offset) so changing one dataset never shifts another.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEED = 20260930;

// ---------------------------------------------------------------------------
// Random numbers (mulberry32) and small helpers
// ---------------------------------------------------------------------------
class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new Error('pick() from empty list');
    return item;
  }
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((sum, [, w]) => sum + w, 0);
    let r = this.next() * total;
    for (const [item, w] of items) {
      r -= w;
      if (r <= 0) return item;
    }
    const last = items[items.length - 1];
    if (!last) throw new Error('weighted() from empty list');
    return last[0];
  }
  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  logNormal(median: number, sigma: number): number {
    return median * Math.exp(sigma * this.normal());
  }
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = a;
    }
    return copy;
  }
}

type Cell = string | number | null;

function csvCell(value: Cell): string {
  if (value === null) return '';
  const text = typeof value === 'number' ? String(value) : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    if (row.length !== headers.length) throw new Error(`Row has ${row.length} cells, expected ${headers.length}`);
    lines.push(row.map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');
const round = (n: number, digits: number) => Number(n.toFixed(digits));

// Dates are handled as UTC calendar dates so generation never depends on the machine's time zone.
function isoFromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}
function utcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}
const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) => isoFromUtc(utcMs(iso) + n * DAY_MS);
const weekday = (iso: string) => new Date(utcMs(iso)).getUTCDay(); // 0 = Sunday
const monthOf = (iso: string) => iso.slice(0, 7);
function* eachDay(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}
function eachMonth(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${pad(m, 2)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Project 1: AI Spend & Consumption
// ---------------------------------------------------------------------------
const SPEND_START = '2026-01-01';
const SPEND_END = '2026-09-30';
const BUDGET_MONTHS = eachMonth('2026-01', '2026-12');

/**
 * Calibration constants only. They scale request volume and token sizes so total spend lands at a
 * "pilot-scale" level (a few thousand USD over nine months) rather than a toy total. Dollar amounts
 * are fictional and should not be extrapolated to a real organization.
 */
const TOKEN_SCALE = 3.2;
const VOLUME_SCALE = 0.8;

interface PriceRow {
  model: string;
  provider: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  inputPerMtok: number;
  cachedPerMtok: number;
  outputPerMtok: number;
}

// FICTIONAL providers, models and prices (USD per 1,000,000 tokens). Not real vendor pricing.
const PRICES: PriceRow[] = [
  { model: 'alder-large', provider: 'Alder AI', effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31', inputPerMtok: 6.0, cachedPerMtok: 0.6, outputPerMtok: 24.0 },
  { model: 'alder-large', provider: 'Alder AI', effectiveFrom: '2026-04-01', effectiveTo: null, inputPerMtok: 4.8, cachedPerMtok: 0.48, outputPerMtok: 19.2 },
  { model: 'alder-small', provider: 'Alder AI', effectiveFrom: '2026-01-01', effectiveTo: null, inputPerMtok: 0.5, cachedPerMtok: 0.05, outputPerMtok: 2.0 },
  { model: 'birch-standard', provider: 'Birch Labs', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', inputPerMtok: 3.0, cachedPerMtok: 0.3, outputPerMtok: 12.0 },
  { model: 'birch-standard', provider: 'Birch Labs', effectiveFrom: '2026-07-01', effectiveTo: null, inputPerMtok: 3.3, cachedPerMtok: 0.33, outputPerMtok: 13.2 },
  { model: 'birch-mini', provider: 'Birch Labs', effectiveFrom: '2026-01-01', effectiveTo: null, inputPerMtok: 0.25, cachedPerMtok: 0.025, outputPerMtok: 1.0 },
  { model: 'cedar-reasoning', provider: 'Cedar Compute', effectiveFrom: '2026-02-01', effectiveTo: null, inputPerMtok: 10.0, cachedPerMtok: 1.0, outputPerMtok: 40.0 },
];

const MODEL_PROVIDER: Record<string, string> = {
  'alder-large': 'Alder AI',
  'alder-small': 'Alder AI',
  'birch-standard': 'Birch Labs',
  'birch-mini': 'Birch Labs',
  'cedar-reasoning': 'Cedar Compute',
};

function priceFor(model: string, date: string): PriceRow | undefined {
  return PRICES.find(
    (p) => p.model === model && p.effectiveFrom <= date && (p.effectiveTo === null || date <= p.effectiveTo),
  );
}

function requestCost(model: string, date: string, input: number, cached: number, output: number): number | null {
  const price = priceFor(model, date);
  if (!price || cached > input) return null;
  return ((input - cached) * price.inputPerMtok + cached * price.cachedPerMtok + output * price.outputPerMtok) / 1_000_000;
}

interface UseCaseSpec {
  department: string;
  useCase: string;
  baseTasksPerWeekday: number;
  monthlyGrowth: number;
  models: readonly (readonly [string, number])[];
  inputMedian: number;
  outputMedian: number;
  failRate: number;
  cacheStart?: string;
  cacheRate?: number;
  seasonal?: (month: number) => number;
}

const quarterEnd = (m: number) => (m === 3 || m === 6 || m === 9 ? 1.5 : 1);

// Seeded patterns: Support "Reply drafting" runs mostly on a large model (routing opportunity);
// Engineering grows faster than its budget; Marketing is seasonal; Finance peaks at quarter-end;
// caching is adopted by two use cases only.
const USE_CASES: UseCaseSpec[] = [
  { department: 'Customer Support', useCase: 'Ticket summarization', baseTasksPerWeekday: 3.4, monthlyGrowth: 0.03, models: [['alder-small', 0.55], ['birch-mini', 0.45]], inputMedian: 18000, outputMedian: 700, failRate: 0.04, cacheStart: '2026-04-01', cacheRate: 0.35 },
  { department: 'Customer Support', useCase: 'Reply drafting', baseTasksPerWeekday: 3.0, monthlyGrowth: 0.05, models: [['alder-large', 0.6], ['birch-standard', 0.4]], inputMedian: 14000, outputMedian: 900, failRate: 0.05 },
  { department: 'Engineering', useCase: 'Code assistance', baseTasksPerWeekday: 1.6, monthlyGrowth: 0.09, models: [['alder-large', 0.5], ['cedar-reasoning', 0.2], ['birch-standard', 0.3]], inputMedian: 90000, outputMedian: 4500, failRate: 0.06, cacheStart: '2026-02-01', cacheRate: 0.45 },
  { department: 'Engineering', useCase: 'Test generation', baseTasksPerWeekday: 1.3, monthlyGrowth: 0.07, models: [['birch-standard', 0.6], ['alder-large', 0.4]], inputMedian: 50000, outputMedian: 3200, failRate: 0.05 },
  { department: 'Marketing', useCase: 'Content drafting', baseTasksPerWeekday: 1.9, monthlyGrowth: 0.01, models: [['birch-standard', 0.7], ['alder-large', 0.3]], inputMedian: 12000, outputMedian: 2600, failRate: 0.04, seasonal: (m) => (m === 8 ? 0.7 : m === 5 || m === 9 ? 1.2 : 1) },
  { department: 'Marketing', useCase: 'Campaign analysis', baseTasksPerWeekday: 0.9, monthlyGrowth: 0.02, models: [['alder-large', 0.5], ['birch-standard', 0.5]], inputMedian: 40000, outputMedian: 2200, failRate: 0.05, seasonal: (m) => (m === 8 ? 0.7 : 1) },
  { department: 'Finance', useCase: 'Report narration', baseTasksPerWeekday: 0.9, monthlyGrowth: 0.02, models: [['alder-large', 0.6], ['birch-standard', 0.4]], inputMedian: 60000, outputMedian: 3000, failRate: 0.04, seasonal: quarterEnd },
  { department: 'Finance', useCase: 'Invoice extraction', baseTasksPerWeekday: 2.6, monthlyGrowth: 0.025, models: [['alder-small', 0.5], ['birch-mini', 0.5]], inputMedian: 9000, outputMedian: 500, failRate: 0.07 },
  { department: 'Legal', useCase: 'Contract review', baseTasksPerWeekday: 0.8, monthlyGrowth: 0.015, models: [['cedar-reasoning', 0.5], ['alder-large', 0.5]], inputMedian: 110000, outputMedian: 5000, failRate: 0.05 },
  { department: 'Legal', useCase: 'Clause extraction', baseTasksPerWeekday: 1.2, monthlyGrowth: 0.02, models: [['alder-large', 0.5], ['alder-small', 0.5]], inputMedian: 45000, outputMedian: 1500, failRate: 0.05 },
  { department: 'Operations', useCase: 'SOP Q&A', baseTasksPerWeekday: 2.8, monthlyGrowth: 0.04, models: [['birch-mini', 0.5], ['alder-small', 0.5]], inputMedian: 22000, outputMedian: 600, failRate: 0.03, cacheStart: '2026-02-15', cacheRate: 0.6 },
  { department: 'Operations', useCase: 'Document extraction', baseTasksPerWeekday: 2.0, monthlyGrowth: 0.03, models: [['alder-small', 0.6], ['birch-mini', 0.4]], inputMedian: 16000, outputMedian: 700, failRate: 0.06 },
];

const BASE_LATENCY_MS: Record<string, number> = {
  'alder-large': 3800,
  'alder-small': 1000,
  'birch-standard': 2800,
  'birch-mini': 800,
  'cedar-reasoning': 10500,
};

interface UsageEvent {
  requestId: string;
  date: string;
  department: string;
  useCase: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  status: 'success' | 'failed';
  latencyMs: number | null;
  retryOf: string | null;
  taskId: string;
  taskOutcome: 'completed' | 'abandoned';
}

function generateSpend(): { usage: string; pricing: string; budgets: string; summary: string } {
  const rng = new Rng(SEED + 1);
  const events: UsageEvent[] = [];
  let requestCounter = 0;
  let taskCounter = 0;

  for (const date of eachDay(SPEND_START, SPEND_END)) {
    const month = Number(date.slice(5, 7));
    const monthsElapsed = (utcMs(date) - utcMs(SPEND_START)) / (30.4375 * DAY_MS);
    const isWeekend = weekday(date) === 0 || weekday(date) === 6;

    for (const spec of USE_CASES) {
      const seasonal = spec.seasonal ? spec.seasonal(month) : 1;
      let expected =
        spec.baseTasksPerWeekday *
        VOLUME_SCALE *
        Math.pow(1 + spec.monthlyGrowth, monthsElapsed) *
        seasonal *
        (isWeekend ? 0.12 : 1) *
        rng.logNormal(1, 0.22);

      // Seeded anomaly 1: automated retry storm in Marketing "Campaign analysis" (2026-05-12..14).
      const retryStorm = spec.useCase === 'Campaign analysis' && date >= '2026-05-12' && date <= '2026-05-14';
      if (retryStorm) expected *= 8;
      // Seeded anomaly 2: quarter-end Finance close (calendar-explainable).
      if (spec.useCase === 'Report narration' && (date === '2026-03-30' || date === '2026-06-29' || date === '2026-09-28')) expected *= 10;
      // Seeded anomaly 3: oversized-context batch job in Engineering "Code assistance" (2026-07-14).
      const oversized = spec.useCase === 'Code assistance' && date === '2026-07-14';
      if (oversized) expected += 14;

      let tasks = Math.floor(expected);
      if (rng.chance(expected - tasks)) tasks += 1;

      for (let t = 0; t < tasks; t++) {
        taskCounter += 1;
        const taskId = `TSK-${pad(taskCounter, 5)}`;
        const eligibleModels = spec.models.filter(([m]) => m !== 'cedar-reasoning' || date >= '2026-02-01');
        const model = rng.weighted(eligibleModels);
        const failRate = retryStorm ? 0.6 : spec.failRate;
        const maxAttempts = retryStorm ? 6 : 3;
        const retryChance = retryStorm ? 0.97 : 0.85;

        let input = Math.max(200, Math.round(rng.logNormal(spec.inputMedian, 0.45) * TOKEN_SCALE));
        if (oversized) input = Math.round(input * 5.5);
        const cacheActive = spec.cacheStart !== undefined && date >= spec.cacheStart;
        const cacheShare = cacheActive ? Math.min(0.92, (spec.cacheRate ?? 0) * rng.range(0.7, 1.2)) : 0;
        const expectedOutput = Math.max(20, Math.round(rng.logNormal(spec.outputMedian, 0.35) * TOKEN_SCALE));

        const taskEvents: UsageEvent[] = [];
        let previousId: string | null = null;
        let completed = false;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          requestCounter += 1;
          const requestId = `REQ-${pad(requestCounter, 6)}`;
          const failed = rng.chance(attempt === 1 ? failRate : failRate * 0.8);
          const cached = Math.round(input * cacheShare);
          const output = failed ? Math.round(expectedOutput * rng.range(0, 0.2)) : expectedOutput;
          const base = BASE_LATENCY_MS[model] ?? 3000;
          const latency = failed
            ? rng.chance(0.5) ? 30000 : Math.round(rng.range(300, 900))
            : Math.round(base * rng.logNormal(1, 0.25) + ((output / TOKEN_SCALE) * base) / 450);
          taskEvents.push({
            requestId,
            date,
            department: spec.department,
            useCase: spec.useCase,
            provider: MODEL_PROVIDER[model] ?? 'unknown',
            model,
            inputTokens: input,
            outputTokens: output,
            cachedTokens: cached,
            status: failed ? 'failed' : 'success',
            latencyMs: latency,
            retryOf: previousId,
            taskId,
            taskOutcome: 'abandoned',
          });
          previousId = requestId;
          if (!failed) {
            completed = true;
            break;
          }
          if (!rng.chance(retryChance)) break;
        }
        for (const e of taskEvents) e.taskOutcome = completed ? 'completed' : 'abandoned';
        events.push(...taskEvents);
      }
    }
  }

  // Seeded data-quality issue A: 9 events use "cedar-reasoning" before its first price effective date
  // (pricing coverage gap). Single-attempt, completed tasks so exclusion is clean.
  const earlyDates = ['2026-01-27', '2026-01-27', '2026-01-28', '2026-01-28', '2026-01-29', '2026-01-29', '2026-01-30', '2026-01-30', '2026-01-30'];
  for (const date of earlyDates) {
    requestCounter += 1;
    taskCounter += 1;
    const input = Math.round(rng.logNormal(100000, 0.3));
    events.push({
      requestId: `REQ-${pad(requestCounter, 6)}`,
      date,
      department: 'Legal',
      useCase: 'Contract review',
      provider: 'Cedar Compute',
      model: 'cedar-reasoning',
      inputTokens: input,
      outputTokens: Math.round(rng.logNormal(4800, 0.3)),
      cachedTokens: 0,
      status: 'success',
      latencyMs: Math.round(rng.logNormal(11000, 0.2)),
      retryOf: null,
      taskId: `TSK-${pad(taskCounter, 5)}`,
      taskOutcome: 'completed',
    });
  }

  events.sort((a, b) => (a.date === b.date ? a.requestId.localeCompare(b.requestId) : a.date.localeCompare(b.date)));

  // Seeded data-quality issue B: 6 successful single-attempt rows where cached tokens exceed input tokens.
  const candidates = events.filter((e) => e.status === 'success' && e.retryOf === null && e.model !== 'cedar-reasoning');
  for (const e of rng.shuffle(candidates).slice(0, 6)) e.cachedTokens = e.inputTokens + rng.int(150, 2500);

  // Seeded data-quality issue C: 14 rows with a blank latency.
  for (const e of rng.shuffle(events).slice(0, 14)) e.latencyMs = null;

  // Seeded data-quality issue D: 8 exact duplicate rows (same request_id), placed right after the original.
  const duplicateIds = new Set(rng.shuffle(events.map((e) => e.requestId)).slice(0, 8));
  const withDuplicates: UsageEvent[] = [];
  for (const e of events) {
    withDuplicates.push(e);
    if (duplicateIds.has(e.requestId)) withDuplicates.push({ ...e });
  }

  const usageHeaders = [
    'request_id', 'event_date', 'department', 'use_case', 'provider', 'model',
    'input_tokens', 'output_tokens', 'cached_input_tokens', 'status', 'latency_ms',
    'retry_of_request_id', 'task_id', 'task_outcome',
  ];
  const usage = toCsv(
    usageHeaders,
    withDuplicates.map((e) => [
      e.requestId, e.date, e.department, e.useCase, e.provider, e.model,
      e.inputTokens, e.outputTokens, e.cachedTokens, e.status, e.latencyMs,
      e.retryOf, e.taskId, e.taskOutcome,
    ]),
  );

  const pricing = toCsv(
    ['model', 'provider', 'effective_from', 'effective_to', 'input_usd_per_mtok', 'cached_input_usd_per_mtok', 'output_usd_per_mtok', 'price_basis'],
    PRICES.map((p) => [p.model, p.provider, p.effectiveFrom, p.effectiveTo, p.inputPerMtok, p.cachedPerMtok, p.outputPerMtok, 'fictional assumption']),
  );

  // Budgets: planned path = average of Jan-Mar actual priced spend x 1.05, growing 3% per month.
  // Engineering's real growth (9%/month) outpaces its plan (a seeded pattern).
  const actualByDeptMonth = new Map<string, number>();
  let pricedTotal = 0;
  for (const e of events) {
    const cost = requestCost(e.model, e.date, e.inputTokens, e.cachedTokens, e.outputTokens);
    if (cost === null) continue;
    pricedTotal += cost;
    const key = `${e.department}|${monthOf(e.date)}`;
    actualByDeptMonth.set(key, (actualByDeptMonth.get(key) ?? 0) + cost);
  }
  const departments = [...new Set(USE_CASES.map((u) => u.department))];
  const budgetRows: Cell[][] = [];
  for (const month of BUDGET_MONTHS) {
    const monthIndex = BUDGET_MONTHS.indexOf(month);
    for (const dept of departments) {
      const q1 = ['2026-01', '2026-02', '2026-03'].map((m) => actualByDeptMonth.get(`${dept}|${m}`) ?? 0);
      const planBase = (q1.reduce((a, b) => a + b, 0) / 3) * 1.05;
      const budget = Math.max(25, Math.round((planBase * Math.pow(1.03, monthIndex)) / 5) * 5);
      budgetRows.push([month, dept, budget]);
    }
  }
  const budgets = toCsv(['month', 'department', 'budget_usd'], budgetRows);

  const summary = `ai-spend: ${withDuplicates.length} usage rows, ${taskCounter} tasks, priced spend ~$${pricedTotal.toFixed(0)}`;
  return { usage, pricing, budgets, summary };
}

// ---------------------------------------------------------------------------
// Project 2: AI Adoption & License Utilization
// ---------------------------------------------------------------------------
export const ADOPTION_AS_OF = '2026-09-27'; // Sunday: end of the last telemetry week
const TELEMETRY_FIRST_WEEK = '2026-07-06'; // Monday
const TELEMETRY_WEEKS = 12;

const DEPARTMENT_HEADCOUNT: readonly (readonly [string, number])[] = [
  ['Customer Support', 110],
  ['Engineering', 85],
  ['Marketing', 45],
  ['Finance', 40],
  ['Legal', 20],
  ['Operations', 90],
  ['HR', 30],
];

// FICTIONAL products. Eligible employees per department (policy-based, not employee-level).
const PRODUCTS = ['Atlas Assistant', 'Forge Code', 'Scribe Meetings'] as const;
type Product = (typeof PRODUCTS)[number];
const ELIGIBLE: Record<Product, Record<string, number>> = {
  'Atlas Assistant': { 'Customer Support': 95, Engineering: 75, Marketing: 40, Finance: 36, Legal: 18, Operations: 78, HR: 26 },
  'Forge Code': { 'Customer Support': 0, Engineering: 80, Marketing: 0, Finance: 0, Legal: 0, Operations: 12, HR: 0 },
  'Scribe Meetings': { 'Customer Support': 100, Engineering: 60, Marketing: 40, Finance: 30, Legal: 0, Operations: 80, HR: 0 },
};
// Share of eligible employees who were assigned a seat.
const ASSIGN_SHARE: Record<Product, Record<string, number>> = {
  'Atlas Assistant': { 'Customer Support': 0.8, Engineering: 0.92, Marketing: 0.85, Finance: 0.7, Legal: 0.6, Operations: 0.75, HR: 0.55 },
  'Forge Code': { 'Customer Support': 0, Engineering: 0.93, Marketing: 0, Finance: 0, Legal: 0, Operations: 0.5, HR: 0 },
  'Scribe Meetings': { 'Customer Support': 0.95, Engineering: 0.5, Marketing: 0.7, Finance: 0.6, Legal: 0, Operations: 0.85, HR: 0 },
};
// Assignment waves: [month of assignment, weight]. Later "bulk" waves are seeded with lower engagement.
const WAVES: Record<Product, readonly (readonly [string, number])[]> = {
  'Atlas Assistant': [['2025-10', 0.2], ['2026-01', 0.3], ['2026-04', 0.35], ['2026-07', 0.15]],
  'Forge Code': [['2025-11', 0.5], ['2026-02', 0.38], ['2026-06', 0.12]],
  'Scribe Meetings': [['2026-02', 0.4], ['2026-05', 0.38], ['2026-08', 0.22]],
};
const BULK_WAVES = new Set(['Atlas Assistant|2026-04', 'Scribe Meetings|2026-05']);
const FIRST_WAVES = new Set(['Atlas Assistant|2025-10', 'Forge Code|2025-11', 'Scribe Meetings|2026-02']);

type Engagement = 'power' | 'regular' | 'occasional' | 'dormant';
const ACTIVE_DAY_PROB: Record<Engagement, number> = { power: 0.8, regular: 0.45, occasional: 0.12, dormant: 0 };
const ACTIONS_MEDIAN: Record<Product, number> = { 'Atlas Assistant': 14, 'Forge Code': 38, 'Scribe Meetings': 3 };

interface Contract {
  product: Product;
  priceMonthly: number;
  committedSeats: number;
  termStart: string;
  renewalDate: string;
  noticeDays: number;
  floorSeats: number;
}
const CONTRACTS: Contract[] = [
  { product: 'Atlas Assistant', priceMonthly: 30, committedSeats: 280, termStart: '2026-01-01', renewalDate: '2026-12-31', noticeDays: 60, floorSeats: 200 },
  { product: 'Forge Code', priceMonthly: 39, committedSeats: 80, termStart: '2025-11-01', renewalDate: '2026-10-31', noticeDays: 45, floorSeats: 60 },
  { product: 'Scribe Meetings', priceMonthly: 18, committedSeats: 180, termStart: '2026-03-01', renewalDate: '2027-02-28', noticeDays: 30, floorSeats: 120 },
];

interface Assignment {
  id: string;
  employeeId: string;
  department: string;
  product: Product;
  assignedDate: string;
  unassignedDate: string | null;
  engagement: Engagement;
}

function engagementFor(rng: Rng, product: Product, wave: string, department: string): Engagement {
  const base: Record<Product, [number, number, number, number]> = {
    'Atlas Assistant': [0.22, 0.38, 0.22, 0.18],
    'Forge Code': [0.45, 0.35, 0.12, 0.08],
    'Scribe Meetings': [0.15, 0.35, 0.28, 0.22],
  };
  let [power, regular, , dormant] = base[product];
  const occasional = base[product][2];
  const key = `${product}|${wave}`;
  if (BULK_WAVES.has(key)) { power *= 0.4; dormant *= 2.1; }
  if (FIRST_WAVES.has(key)) { power *= 1.5; dormant *= 0.5; }
  if (department === 'Engineering' && product === 'Atlas Assistant') power *= 1.3;
  if (department === 'Marketing' || department === 'HR') dormant *= 1.5;
  if (department === 'Customer Support' && product === 'Scribe Meetings') regular *= 1.3;
  return rng.weighted<Engagement>([['power', power], ['regular', regular], ['occasional', occasional], ['dormant', dormant]]);
}

function generateAdoption(): { assignments: string; activity: string; eligibility: string; contracts: string; summary: string } {
  const rng = new Rng(SEED + 2);

  // Pseudonymous employee ids, allocated in department blocks: E0001 ...
  const employeesByDept = new Map<string, string[]>();
  let next = 1;
  for (const [dept, headcount] of DEPARTMENT_HEADCOUNT) {
    const ids: string[] = [];
    for (let i = 0; i < headcount; i++) ids.push(`E${pad(next++, 4)}`);
    employeesByDept.set(dept, ids);
  }

  const assignments: Assignment[] = [];
  let assignmentCounter = 0;
  for (const product of PRODUCTS) {
    for (const [dept] of DEPARTMENT_HEADCOUNT) {
      const eligible = ELIGIBLE[product][dept] ?? 0;
      const share = ASSIGN_SHARE[product][dept] ?? 0;
      const ids = employeesByDept.get(dept) ?? [];
      const seats = Math.round(eligible * share);
      for (const employeeId of rng.shuffle(ids.slice(0, Math.max(eligible, seats))).slice(0, seats)) {
        const wave = rng.weighted(WAVES[product]);
        const [y, m] = wave.split('-').map(Number) as [number, number];
        const day = rng.int(1, 28);
        assignmentCounter += 1;
        assignments.push({
          id: `A${pad(assignmentCounter, 5)}`,
          employeeId,
          department: dept,
          product,
          assignedDate: `${y}-${pad(m, 2)}-${pad(day, 2)}`,
          unassignedDate: null,
          engagement: engagementFor(rng, product, wave, dept),
        });
      }
    }
  }
  // Seeded governance pattern: two Marketing employees hold Forge Code seats although Marketing has 0 eligible.
  for (const employeeId of (employeesByDept.get('Marketing') ?? []).slice(0, 2)) {
    assignmentCounter += 1;
    assignments.push({
      id: `A${pad(assignmentCounter, 5)}`, employeeId, department: 'Marketing', product: 'Forge Code',
      assignedDate: '2026-02-12', unassignedDate: null, engagement: 'dormant',
    });
  }
  // About 6% of seats were removed (leavers or reclaimed), after at least 30 days.
  for (const a of rng.shuffle(assignments).slice(0, Math.round(assignments.length * 0.06))) {
    const earliest = addDays(a.assignedDate, 30) > '2026-06-01' ? addDays(a.assignedDate, 30) : '2026-06-01';
    if (earliest < '2026-09-10') {
      const span = Math.round((utcMs('2026-09-10') - utcMs(earliest)) / DAY_MS);
      a.unassignedDate = addDays(earliest, rng.int(0, span));
    }
  }

  // Weekly telemetry per seat-week while the seat is assigned.
  const weeks: string[] = [];
  for (let i = 0; i < TELEMETRY_WEEKS; i++) weeks.push(addDays(TELEMETRY_FIRST_WEEK, i * 7));
  if (weekday(TELEMETRY_FIRST_WEEK) !== 1) throw new Error('TELEMETRY_FIRST_WEEK must be a Monday');
  const outageWeek = '2026-07-20'; // Seeded: Scribe Meetings telemetry outage (blank values, not zeros).

  const activityRows: Cell[][] = [];
  for (const a of assignments) {
    for (const week of weeks) {
      const weekEnd = addDays(week, 6);
      const assignedInWeek = a.assignedDate <= weekEnd && (a.unassignedDate === null || a.unassignedDate >= week);
      if (!assignedInWeek) continue;
      if (a.product === 'Scribe Meetings' && week === outageWeek) {
        activityRows.push([a.employeeId, a.product, week, null, null]);
        continue;
      }
      const p = ACTIVE_DAY_PROB[a.engagement];
      let days = 0;
      for (let d = 0; d < 5; d++) if (rng.chance(p)) days += 1;
      let actions = 0;
      for (let d = 0; d < days; d++) actions += Math.max(1, Math.round(rng.logNormal(ACTIONS_MEDIAN[a.product], 0.5)));
      activityRows.push([a.employeeId, a.product, week, days, actions]);
    }
  }
  // Seeded data-quality issue: 6 "trial" activity rows from before the seat was formally assigned.
  const lateSeats = assignments.filter((a) => a.assignedDate > addDays(TELEMETRY_FIRST_WEEK, 14) && a.assignedDate < '2026-08-01');
  for (const a of rng.shuffle(lateSeats).slice(0, 6)) {
    activityRows.push([a.employeeId, a.product, TELEMETRY_FIRST_WEEK, rng.int(1, 3), rng.int(2, 25)]);
  }
  activityRows.sort((x, y) => String(x[2]).localeCompare(String(y[2])) || String(x[0]).localeCompare(String(y[0])) || String(x[1]).localeCompare(String(y[1])));

  // Seeded data-quality issues in assignments: 4 overlapping duplicates and 3 impossible date ranges.
  const dataRows: Assignment[] = [...assignments];
  for (const a of rng.shuffle(assignments.filter((x) => x.unassignedDate === null)).slice(0, 4)) {
    assignmentCounter += 1;
    dataRows.push({ ...a, id: `A${pad(assignmentCounter, 5)}` });
  }
  for (const a of rng.shuffle(dataRows.filter((x) => x.unassignedDate === null && x.assignedDate > '2026-01-01')).slice(0, 3)) {
    a.unassignedDate = addDays(a.assignedDate, -rng.int(5, 40));
  }
  dataRows.sort((x, y) => x.id.localeCompare(y.id));

  const assignmentCsv = toCsv(
    ['assignment_id', 'employee_id', 'department', 'product', 'assigned_date', 'unassigned_date'],
    dataRows.map((a) => [a.id, a.employeeId, a.department, a.product, a.assignedDate, a.unassignedDate]),
  );
  const activityCsv = toCsv(['employee_id', 'product', 'week_start', 'active_days', 'actions'], activityRows);
  const eligibilityRows: Cell[][] = [];
  for (const product of PRODUCTS) {
    for (const [dept, headcount] of DEPARTMENT_HEADCOUNT) {
      eligibilityRows.push([dept, product, headcount, ELIGIBLE[product][dept] ?? 0]);
    }
  }
  const eligibilityCsv = toCsv(['department', 'product', 'department_headcount', 'eligible_employees'], eligibilityRows);
  const contractsCsv = toCsv(
    ['product', 'seat_price_usd_per_month', 'committed_seats', 'term_start', 'renewal_date', 'notice_days', 'floor_seats_at_renewal', 'price_basis'],
    CONTRACTS.map((c) => [c.product, c.priceMonthly, c.committedSeats, c.termStart, c.renewalDate, c.noticeDays, c.floorSeats, 'fictional assumption']),
  );

  const summary = `ai-adoption: ${dataRows.length} assignment rows, ${activityRows.length} activity rows`;
  return { assignments: assignmentCsv, activity: activityCsv, eligibility: eligibilityCsv, contracts: contractsCsv, summary };
}

// ---------------------------------------------------------------------------
// Project 3: AI Workflow Value & Quality
// ---------------------------------------------------------------------------
const WORKFLOWS = ['Invoice exception review', 'Customer inquiry triage', 'Contract summary drafting'] as const;
type Complexity = 'low' | 'medium' | 'high';
const WORKFLOW_MONTHS = eachMonth('2026-01', '2026-09');
const PILOT_START = '2026-04';
const PILOT_TEAMS = new Set(['Team A', 'Team B']);
const TEAMS = ['Team A', 'Team B', 'Team C'] as const;

// Baseline median handling minutes by workflow and complexity (fictional).
const BASE_MINUTES: Record<(typeof WORKFLOWS)[number], Record<Complexity, number>> = {
  'Invoice exception review': { low: 14, medium: 26, high: 48 },
  'Customer inquiry triage': { low: 6, medium: 11, high: 22 },
  'Contract summary drafting': { low: 25, medium: 48, high: 90 },
};
const BASE_REVIEW_MIN: Record<Complexity, number> = { low: 1.5, medium: 4, high: 9 };
const AI_REVIEW_MIN: Record<Complexity, number> = { low: 3, medium: 6, high: 14 };
const AI_HANDLING_MULT: Record<Complexity, number> = { low: 0.62, medium: 0.7, high: 0.92 };
const REWORK_PROB: Record<'baseline' | 'ai_assisted', Record<Complexity, number>> = {
  baseline: { low: 0.06, medium: 0.09, high: 0.14 },
  ai_assisted: { low: 0.07, medium: 0.11, high: 0.24 },
};
const QUALITY_PASS: Record<'baseline' | 'ai_assisted', Record<Complexity, number>> = {
  baseline: { low: 0.95, medium: 0.93, high: 0.9 },
  ai_assisted: { low: 0.96, medium: 0.93, high: 0.84 },
};
const ESCALATION: Record<'baseline' | 'ai_assisted', Record<Complexity, number>> = {
  baseline: { low: 0.02, medium: 0.05, high: 0.12 },
  ai_assisted: { low: 0.02, medium: 0.06, high: 0.17 },
};

function generateWorkflow(): { records: string; assumptions: string; summary: string } {
  const rng = new Rng(SEED + 3);
  const rows: Cell[][] = [];
  let counter = 0;

  for (const month of WORKFLOW_MONTHS) {
    const volumeFactor = month === '2026-06' ? 1.2 : 1;
    const monthsIntoPilot = Math.max(0, WORKFLOW_MONTHS.indexOf(month) - WORKFLOW_MONTHS.indexOf(PILOT_START));
    // Seeded: early pilot months are slower (learning curve); the penalty fades by month 4 of the pilot.
    const learningPenalty = 1 + Math.max(0, 0.14 - 0.035 * monthsIntoPilot);
    for (const team of TEAMS) {
      for (const workflow of WORKFLOWS) {
        const count = Math.max(8, Math.round(rng.logNormal(14, 0.15) * volumeFactor));
        for (let i = 0; i < count; i++) {
          const process = PILOT_TEAMS.has(team) && month >= PILOT_START ? 'ai_assisted' : 'baseline';
          // Seeded selection effect: Team A (volunteers) receives a somewhat easier mix.
          const mix: readonly (readonly [Complexity, number])[] =
            team === 'Team A' ? [['low', 0.58], ['medium', 0.3], ['high', 0.12]] : [['low', 0.5], ['medium', 0.35], ['high', 0.15]];
          const complexity = rng.weighted(mix);
          let handling = rng.logNormal(BASE_MINUTES[workflow][complexity], 0.3);
          let review = rng.logNormal(BASE_REVIEW_MIN[complexity], 0.3);
          if (process === 'ai_assisted') {
            handling *= AI_HANDLING_MULT[complexity] * learningPenalty;
            review = rng.logNormal(AI_REVIEW_MIN[complexity], 0.3);
          }
          const reworked = rng.chance(REWORK_PROB[process][complexity]);
          const rework = reworked ? handling * rng.range(0.4, 0.7) : 0;
          const quality: 'pass' | 'fail' = rng.chance(QUALITY_PASS[process][complexity]) ? 'pass' : 'fail';
          const escalated = rng.chance(ESCALATION[process][complexity]);
          counter += 1;
          rows.push([
            `WF-${pad(counter, 5)}`, month, workflow, complexity, team, process,
            round(handling, 1), round(review, 1), round(rework, 1), quality, escalated ? 'yes' : 'no',
          ]);
        }
      }
    }
  }

  // Seeded data-quality issues: 11 blank quality outcomes (not audited), 5 blank rework values (not recorded).
  const shuffled = rng.shuffle(rows);
  for (const row of shuffled.slice(0, 11)) row[9] = null;
  for (const row of shuffled.slice(11, 16)) row[8] = null;

  const records = toCsv(
    ['task_id', 'month', 'workflow', 'complexity', 'team', 'process', 'handling_minutes', 'review_minutes', 'rework_minutes', 'quality_outcome', 'escalated'],
    rows,
  );
  const assumptions = toCsv(
    ['parameter', 'value', 'unit', 'basis', 'description'],
    [
      ['labor_rate_usd_per_hour', 38, 'USD per hour', 'fictional assumption', 'Fully loaded labor rate applied to handling, review, and rework minutes'],
      ['ai_variable_cost_usd_per_task', 0.45, 'USD per AI-assisted task', 'fictional assumption', 'Model usage cost per AI-assisted task'],
      ['escalation_cost_usd_per_task', 18, 'USD per escalated task', 'fictional assumption', 'Additional senior-staff time when a task is escalated'],
      ['ai_software_usd_per_month', 2400, 'USD per month', 'fictional assumption', 'Pilot tooling subscription for the pilot teams'],
      ['implementation_one_time_usd', 22000, 'USD one-time', 'fictional assumption', 'Integration and configuration cost'],
      ['training_one_time_usd', 7500, 'USD one-time', 'fictional assumption', 'Staff training cost'],
    ],
  );
  return { records, assumptions, summary: `ai-workflow: ${rows.length} task rows` };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../public/data');

function main(): void {
  const check = process.argv.includes('--check');
  const spend = generateSpend();
  const adoption = generateAdoption();
  const workflow = generateWorkflow();

  const files: Record<string, string> = {
    'ai-spend/usage_events.csv': spend.usage,
    'ai-spend/model_pricing.csv': spend.pricing,
    'ai-spend/department_budgets.csv': spend.budgets,
    'ai-adoption/license_assignments.csv': adoption.assignments,
    'ai-adoption/product_activity.csv': adoption.activity,
    'ai-adoption/department_eligibility.csv': adoption.eligibility,
    'ai-adoption/contracts.csv': adoption.contracts,
    'ai-workflow/workflow_records.csv': workflow.records,
    'ai-workflow/cost_assumptions.csv': workflow.assumptions,
  };

  if (check) {
    const stale: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      const path = resolve(dataDir, name);
      if (!existsSync(path) || readFileSync(path, 'utf8') !== content) stale.push(name);
    }
    if (stale.length > 0) {
      console.error(`Committed datasets differ from a fresh generation (seed ${SEED}):\n  ${stale.join('\n  ')}`);
      process.exit(1);
    }
    console.warn(`OK: ${Object.keys(files).length} datasets match a fresh generation (seed ${SEED}).`);
    return;
  }

  for (const [name, content] of Object.entries(files)) {
    const path = resolve(dataDir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }
  console.warn(`Seed ${SEED}. Wrote ${Object.keys(files).length} files to public/data.`);
  console.warn(spend.summary);
  console.warn(adoption.summary);
  console.warn(workflow.summary);
}

main();
