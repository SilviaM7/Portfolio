import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeBudgets, normalizePrices, normalizeUsageEvents } from '@/projects/ai-spend/schema';
import { readDataset } from '@/test/readDataset';
import {
  compareToBudget,
  detectAnomalies,
  EMPTY_SPEND_FILTERS,
  estimateScenarios,
  filterEvents,
  findPrice,
  monthlySpend,
  observedMonthlyGrowth,
  priceEvents,
  projectSpend,
  spendByDimension,
  spendFilterOptions,
  summarizeSpend,
  tokenCost,
  type PriceEntry,
  type PricedEvent,
  type UsageEvent,
} from './spend';

const PRICES: PriceEntry[] = [
  { model: 'big', provider: 'P', effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31', inputPerMtok: 6, cachedPerMtok: 0.6, outputPerMtok: 24 },
  { model: 'big', provider: 'P', effectiveFrom: '2026-04-01', effectiveTo: null, inputPerMtok: 4.8, cachedPerMtok: 0.48, outputPerMtok: 19.2 },
  { model: 'small', provider: 'P', effectiveFrom: '2026-01-01', effectiveTo: null, inputPerMtok: 0.5, cachedPerMtok: 0.05, outputPerMtok: 2 },
];

let counter = 0;
function event(overrides: Partial<UsageEvent> = {}): UsageEvent {
  counter += 1;
  const date = overrides.date ?? '2026-02-10';
  return {
    requestId: `R${counter}`,
    date,
    month: date.slice(0, 7),
    department: 'Dept A',
    useCase: 'Reply drafting',
    provider: 'P',
    model: 'big',
    inputTokens: 1000,
    outputTokens: 100,
    cachedTokens: 0,
    status: 'success',
    latencyMs: 1000,
    retryOf: null,
    taskId: `T${counter}`,
    taskOutcome: 'completed',
    ...overrides,
  };
}

const priced = (events: UsageEvent[], prices = PRICES): PricedEvent[] => priceEvents(events, prices);
const close = (actual: number | null, expected: number, epsilon = 1e-9) => {
  assert.ok(actual !== null && Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
};

describe('effective-dated pricing', () => {
  it('uses the price in force on the event date, inclusive at both ends', () => {
    assert.equal(findPrice(PRICES, 'big', '2026-03-31')?.inputPerMtok, 6);
    assert.equal(findPrice(PRICES, 'big', '2026-04-01')?.inputPerMtok, 4.8);
    assert.equal(findPrice(PRICES, 'big', '2025-12-31'), null); // before any price exists
    assert.equal(findPrice(PRICES, 'unknown', '2026-02-01'), null);
  });
});

describe('request cost', () => {
  it('bills uncached input, cached input, and output separately (cached tokens are not billed twice)', () => {
    const price = PRICES[0] as PriceEntry;
    // (6,000 uncached x $6 + 4,000 cached x $0.6 + 1,000 output x $24) / 1,000,000
    close(tokenCost(price, 10_000, 4_000, 1_000), 0.0624);
  });
  it('treats unpriceable or invalid rows as unpriced, never as $0', () => {
    const rows = priced([
      event({ model: 'mystery' }),
      event({ inputTokens: 100, cachedTokens: 500 }),
      event({ date: '2025-12-31' }),
      event(),
    ]);
    assert.deepEqual(rows.map((r) => r.costIssue), ['no_price', 'cached_exceeds_input', 'no_price', null]);
    assert.deepEqual(rows.map((r) => r.costUsd === null), [true, true, true, false]);
    const summary = summarizeSpend(rows);
    assert.equal(summary.unpricedRequests, 2);
    assert.equal(summary.invalidTokenRequests, 1);
    close(summary.spendUsd, (1000 * 6 + 100 * 24) / 1e6);
  });
});

describe('weighted aggregates', () => {
  it('computes cache hit rate as sum(cached) / sum(input), not an average of per-request rates', () => {
    const rows = priced([
      event({ inputTokens: 1000, cachedTokens: 1000 }), // 100%
      event({ inputTokens: 9000, cachedTokens: 0 }), // 0%
    ]);
    close(summarizeSpend(rows).cacheHitRate, 0.1);
  });
  it('computes blended $ per million tokens from totals', () => {
    const rows = priced([
      event({ model: 'small', inputTokens: 1_000_000, outputTokens: 0 }),
      event({ model: 'big', inputTokens: 1000, outputTokens: 0 }),
    ]);
    const [group] = spendByDimension(rows, 'provider');
    assert.ok(group);
    close(group.spendUsd, 0.5 + 6 / 1000);
    close(group.usdPerMillionTokens, ((0.5 + 0.006) / 1_001_000) * 1_000_000);
  });
});

describe('cost per successful task', () => {
  it('includes failed attempts, retries, and abandoned work, and excludes tasks with unpriced requests', () => {
    // Every request costs $1 or $2 so the arithmetic is easy to follow.
    const unit = (extra: Partial<UsageEvent>) => event({ model: 'small', inputTokens: 2_000_000, outputTokens: 0, ...extra }); // $1.00
    const rows = priced([
      // T1 completed: failed attempt ($1) then retry success ($1)
      unit({ taskId: 'T1', status: 'failed', taskOutcome: 'completed' }),
      unit({ taskId: 'T1', status: 'success', taskOutcome: 'completed', retryOf: 'x' }),
      // T2 abandoned: one failed attempt ($1)
      unit({ taskId: 'T2', status: 'failed', taskOutcome: 'abandoned' }),
      // T3 completed: single $2 request
      event({ taskId: 'T3', model: 'small', inputTokens: 4_000_000, outputTokens: 0 }),
      // T4 has an unpriced request, so the whole task is excluded from task metrics
      event({ taskId: 'T4', model: 'mystery' }),
      unit({ taskId: 'T4', status: 'success' }),
    ]);
    const s = summarizeSpend(rows);
    assert.equal(s.completedTasks, 3 - 1 + 0); // T1, T3 are completed; T4 excluded -> 2
    assert.equal(s.abandonedTasks, 1);
    assert.equal(s.costCompleteTasks, 3);
    close(s.completedTaskSpendUsd, 4); // T1 $2 + T3 $2
    close(s.abandonedTaskSpendUsd, 1);
    close(s.directCostPerSuccessfulTask, 4 / 2);
    close(s.costPerSuccessfulTask, 5 / 2);
    close(s.failedSpendUsd, 2); // two failed $1 requests
    close(s.spendUsd, 1 + 1 + 1 + 2 + 1); // T4's priced request still counts toward spend
  });
});

describe('filters and budgets', () => {
  const rows = priced([
    event({ department: 'A', month: '2026-01', date: '2026-01-05', model: 'small', inputTokens: 2_000_000, outputTokens: 0 }),
    event({ department: 'A', month: '2026-02', date: '2026-02-05', model: 'small', inputTokens: 2_000_000, outputTokens: 0 }),
    event({ department: 'B', month: '2026-02', date: '2026-02-06', model: 'small', inputTokens: 4_000_000, outputTokens: 0 }),
  ]);
  const budgets = [
    { month: '2026-01', department: 'A', budgetUsd: 10 },
    { month: '2026-02', department: 'A', budgetUsd: 10 },
    { month: '2026-02', department: 'B', budgetUsd: 20 },
  ];

  it('filters by month range and department together', () => {
    assert.equal(filterEvents(rows, { ...EMPTY_SPEND_FILTERS, fromMonth: '2026-02' }).length, 2);
    assert.equal(filterEvents(rows, { ...EMPTY_SPEND_FILTERS, department: 'A', toMonth: '2026-01' }).length, 1);
    assert.equal(filterEvents(rows, EMPTY_SPEND_FILTERS).length, 3);
  });
  it('compares actual to budget with the same department and month filters', () => {
    const all = compareToBudget(rows, budgets, EMPTY_SPEND_FILTERS, ['2026-01', '2026-02']);
    assert.ok(all);
    close(all.actualUsd, 1 + 1 + 2);
    close(all.budgetUsd, 40);
    close(all.variancePct, (4 - 40) / 40);

    const filters = { ...EMPTY_SPEND_FILTERS, department: 'A' };
    const deptA = compareToBudget(filterEvents(rows, filters), budgets, filters, ['2026-01', '2026-02']);
    assert.ok(deptA);
    close(deptA.actualUsd, 2);
    close(deptA.budgetUsd, 20);
  });
  it('refuses to compare against department budgets when model, provider, or use-case filters are active', () => {
    const filters = { ...EMPTY_SPEND_FILTERS, model: 'small' };
    assert.equal(compareToBudget(filterEvents(rows, filters), budgets, filters, ['2026-02']), null);
  });
  it('builds a monthly series including empty months', () => {
    const series = monthlySpend(rows, ['2026-01', '2026-02', '2026-03']);
    assert.deepEqual(series.map((r) => r.totalUsd), [1, 3, 0]);
    assert.equal(series[1]?.byDepartment['B'], 2);
  });
});

describe('anomaly detection', () => {
  function series(spikeDate: string | null): PricedEvent[] {
    const events: UsageEvent[] = [];
    // 42 days from Mon 2026-02-02. Weekdays ~ $10 with small variation, weekends ~ $1.
    for (let i = 0; i < 42; i++) {
      const date = new Date(Date.UTC(2026, 1, 2 + i)).toISOString().slice(0, 10);
      const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
      const base = weekend ? 1 : 10 + (i % 3) * 0.5;
      const dollars = date === spikeDate ? 60 : base;
      events.push(event({ date, model: 'small', inputTokens: Math.round((dollars / 0.5) * 1_000_000), outputTokens: 0, useCase: date === spikeDate ? 'Spike case' : 'Normal' }));
    }
    return priced(events);
  }
  it('flags a large weekday spike and names the largest contributor', () => {
    const found = detectAnomalies(series('2026-03-10'));
    assert.equal(found.length, 1);
    assert.equal(found[0]?.date, '2026-03-10');
    assert.equal(found[0]?.topUseCase, 'Spike case');
    assert.ok((found[0]?.ratio ?? 0) > 4);
  });
  it('does not flag ordinary weekend/weekday differences or normal variation', () => {
    assert.deepEqual(detectAnomalies(series(null)), []);
  });
});

describe('projection', () => {
  it('projects the baseline average forward at the stated growth and attaches budgets', () => {
    const monthly = [
      { month: '2026-07', totalUsd: 100 },
      { month: '2026-08', totalUsd: 200 },
      { month: '2026-09', totalUsd: 300 },
    ];
    const budgets = new Map([['2026-10', 250]]);
    const out = projectSpend(monthly, budgets, 0.1, 3);
    assert.deepEqual(out.map((m) => m.month), ['2026-10', '2026-11', '2026-12']);
    close(out[0]?.projectedUsd ?? null, 220);
    close(out[1]?.projectedUsd ?? null, 242);
    assert.equal(out[0]?.budgetUsd, 250);
    assert.equal(out[1]?.budgetUsd, null);
  });
  it('returns nothing when there are fewer months than the baseline needs', () => {
    assert.deepEqual(projectSpend([{ month: '2026-09', totalUsd: 1 }], null, 0), []);
  });
  it('recovers compound growth from an exponential series', () => {
    const monthly = [100, 110, 121, 133.1].map((totalUsd) => ({ totalUsd }));
    close(observedMonthlyGrowth(monthly), 0.1, 1e-9);
    assert.equal(observedMonthlyGrowth([{ totalUsd: 1 }, { totalUsd: 2 }]), null);
  });
});

describe('scenario estimates', () => {
  it('re-prices routable requests on the smaller model and applies share and quality haircut', () => {
    const prices: PriceEntry[] = [
      { model: 'alder-large', provider: 'P', effectiveFrom: '2026-01-01', effectiveTo: null, inputPerMtok: 6, cachedPerMtok: 0.6, outputPerMtok: 24 },
      { model: 'alder-small', provider: 'P', effectiveFrom: '2026-01-01', effectiveTo: null, inputPerMtok: 0.5, cachedPerMtok: 0.05, outputPerMtok: 2 },
    ];
    const rows = priced(
      [
        event({ model: 'alder-large', useCase: 'Reply drafting', inputTokens: 1_000_000, outputTokens: 100_000 }), // routable: $6 + $2.4
        event({ model: 'alder-large', useCase: 'Contract review', inputTokens: 1_000_000, outputTokens: 0 }), // not routable
      ],
      prices,
    );
    const result = estimateScenarios(rows, prices, { routingShare: 0.5, qualityHaircut: 0.2, cacheLift: 0, failureReduction: 0 });
    assert.equal(result.routing.eligibleRequests, 1);
    const current = 8.4;
    const repriced = 0.5 + 0.2;
    close(result.routing.grossSavingsUsd, (current - repriced) * 0.5);
    close(result.routing.netSavingsUsd, (current - repriced) * 0.5 * 0.8);
  });
  it('estimates caching savings only for long prompts in use cases that barely cache today', () => {
    const rows = priced(
      [
        event({ useCase: 'Cold', model: 'small', inputTokens: 20_000, cachedTokens: 0 }),
        event({ useCase: 'Cold', model: 'small', inputTokens: 1_000, cachedTokens: 0 }), // too short
        event({ useCase: 'Warm', model: 'small', inputTokens: 20_000, cachedTokens: 18_000 }), // already caches well
      ],
    );
    const result = estimateScenarios(rows, PRICES, { routingShare: 0, qualityHaircut: 0, cacheLift: 0.3, failureReduction: 0 });
    assert.equal(result.caching.candidateRequests, 1);
    assert.equal(result.caching.additionalCachedTokens, 6000);
    close(result.caching.savingsUsd, (6000 * (0.5 - 0.05)) / 1e6);
  });
  it('scales failure savings by the stated reduction', () => {
    const rows = priced([event({ model: 'small', inputTokens: 2_000_000, outputTokens: 0, status: 'failed' })]);
    const result = estimateScenarios(rows, PRICES, { routingShare: 0, qualityHaircut: 0, cacheLift: 0, failureReduction: 0.4 });
    close(result.failures.failedSpendUsd, 1);
    close(result.failures.savingsUsd, 0.4);
  });
});

describe('normalization of usage events', () => {
  const headers = ['request_id', 'event_date', 'department', 'use_case', 'provider', 'model', 'input_tokens', 'output_tokens', 'cached_input_tokens', 'status', 'latency_ms', 'retry_of_request_id', 'task_id', 'task_outcome'];
  const good = { request_id: 'R1', event_date: '2026-02-03', department: 'D', use_case: 'U', provider: 'P', model: 'm', input_tokens: '10', output_tokens: '2', cached_input_tokens: '0', status: 'success', latency_ms: '500', retry_of_request_id: '', task_id: 'T1', task_outcome: 'completed' };

  it('keeps valid rows and drops duplicates, bad dates, and bad token counts with counted reasons', () => {
    const result = normalizeUsageEvents(headers, [
      good,
      { ...good }, // duplicate request_id
      { ...good, request_id: 'R2', event_date: '2026-02-30' },
      { ...good, request_id: 'R3', input_tokens: '12.5' },
      { ...good, request_id: 'R4', status: 'unknown' },
    ]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.totalRows, 5);
    const codes = Object.fromEntries(result.issues.map((i) => [i.code, i.count]));
    assert.deepEqual(codes, { duplicate_request_id: 1, invalid_date: 1, invalid_tokens: 1, invalid_status: 1 });
  });
  it('keeps rows with blank latency as null and never as 0', () => {
    const result = normalizeUsageEvents(headers, [{ ...good, latency_ms: '' }, { ...good, request_id: 'R2', latency_ms: 'fast' }]);
    assert.deepEqual(result.rows.map((r) => r.latencyMs), [null, null]);
    assert.deepEqual(result.issues.map((i) => i.code).sort(), ['invalid_latency', 'missing_latency']);
  });
  it('throws a DataError when a required column is missing or when nothing is usable', () => {
    assert.throws(() => normalizeUsageEvents(headers.slice(1), [good]), /missing required column/);
    assert.throws(() => normalizeUsageEvents(headers, [{ ...good, event_date: 'x' }]), /no usable rows/);
  });
  it('validates price and budget rows', () => {
    const prices = normalizePrices(
      ['model', 'provider', 'effective_from', 'effective_to', 'input_usd_per_mtok', 'cached_input_usd_per_mtok', 'output_usd_per_mtok', 'price_basis'],
      [
        { model: 'm', provider: 'p', effective_from: '2026-01-01', effective_to: '', input_usd_per_mtok: '1', cached_input_usd_per_mtok: '0.1', output_usd_per_mtok: '2' },
        { model: 'm', provider: 'p', effective_from: '2026-02-01', effective_to: '2026-01-01', input_usd_per_mtok: '1', cached_input_usd_per_mtok: '0.1', output_usd_per_mtok: '2' },
        { model: 'm', provider: 'p', effective_from: '2026-03-01', effective_to: '', input_usd_per_mtok: '', cached_input_usd_per_mtok: '0.1', output_usd_per_mtok: '2' },
      ],
    );
    assert.equal(prices.rows.length, 1);
    assert.equal(prices.rows[0]?.effectiveTo, null);
    const budgets = normalizeBudgets(['month', 'department', 'budget_usd'], [
      { month: '2026-01', department: 'A', budget_usd: '100' },
      { month: '2026-13', department: 'A', budget_usd: '100' },
      { month: '2026-02', department: 'A', budget_usd: 'lots' },
    ]);
    assert.equal(budgets.rows.length, 1);
  });
});

describe('bundled AI spend dataset reconciles with an independent calculation', () => {
  const usageCsv = readDataset('ai-spend/usage_events.csv');
  const pricingCsv = readDataset('ai-spend/model_pricing.csv');
  const budgetCsv = readDataset('ai-spend/department_budgets.csv');
  const usage = normalizeUsageEvents(usageCsv.headers, usageCsv.rows);
  const prices = normalizePrices(pricingCsv.headers, pricingCsv.rows);
  const budgets = normalizeBudgets(budgetCsv.headers, budgetCsv.rows);
  const events = priceEvents(usage.rows, prices.rows);

  it('drops exactly the documented duplicate rows and flags the documented quality issues', () => {
    assert.equal(usage.totalRows - usage.rows.length, 8);
    const summary = summarizeSpend(events);
    assert.equal(summary.unpricedRequests, 9);
    assert.equal(summary.invalidTokenRequests, 6);
    assert.equal(usage.issues.find((i) => i.code === 'missing_latency')?.count, 14);
  });

  it('matches a from-scratch recomputation of total spend, straight from the raw CSV text', () => {
    const seen = new Set<string>();
    let expected = 0;
    for (const row of usageCsv.rows) {
      const id = row['request_id'] ?? '';
      if (seen.has(id)) continue;
      seen.add(id);
      const model = row['model'] ?? '';
      const date = row['event_date'] ?? '';
      const input = Number(row['input_tokens']);
      const cached = Number(row['cached_input_tokens']);
      const output = Number(row['output_tokens']);
      const price = pricingCsv.rows.find(
        (p) => p['model'] === model && (p['effective_from'] ?? '') <= date && ((p['effective_to'] ?? '') === '' || date <= (p['effective_to'] ?? '')),
      );
      if (!price || cached > input) continue;
      expected += ((input - cached) * Number(price['input_usd_per_mtok']) + cached * Number(price['cached_input_usd_per_mtok']) + output * Number(price['output_usd_per_mtok'])) / 1e6;
    }
    close(summarizeSpend(events).spendUsd, expected, 1e-6);
  });

  it('adds up consistently across every breakdown (no double counting of retries or cached tokens)', () => {
    const total = summarizeSpend(events).spendUsd;
    for (const dimension of ['department', 'provider', 'model', 'useCase'] as const) {
      close(spendByDimension(events, dimension).reduce((sum, g) => sum + g.spendUsd, 0), total, 1e-6);
    }
    const months = spendFilterOptions(events).months;
    close(monthlySpend(events, months).reduce((sum, m) => sum + m.totalUsd, 0), total, 1e-6);
  });

  it('keeps retry chains intact: every retry points at an earlier request in the same task', () => {
    const byId = new Map(events.map((e) => [e.requestId, e]));
    for (const e of events) {
      if (e.retryOf === null) continue;
      const parent = byId.get(e.retryOf);
      assert.ok(parent, `missing parent for ${e.requestId}`);
      assert.equal(parent.taskId, e.taskId);
      assert.equal(parent.status, 'failed');
    }
  });

  it('has a complete budget grid and spends in the same departments it budgets', () => {
    assert.equal(budgets.rows.length, 12 * 6);
    const budgetDepartments = new Set(budgets.rows.map((b) => b.department));
    for (const e of events) assert.ok(budgetDepartments.has(e.department), e.department);
  });

  it('finds the seeded anomalies (oversized prompt job and retry storm) and reports retries as the driver for the storm', () => {
    const found = detectAnomalies(events);
    const byDate = new Map(found.map((a) => [a.date, a]));
    assert.equal(byDate.get('2026-07-14')?.topUseCase, 'Code assistance');
    assert.equal(byDate.get('2026-07-14')?.driver, 'larger prompts');
    assert.equal(byDate.get('2026-05-12')?.driver, 'retries and failures');
  });
});
