import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_SPEND_FILTERS, priceEvents, spendByDimension, type SpendFilters } from '@/analysis/spend';
import { readDataset } from '@/test/readDataset';
import type { SpendDataset } from './load';
import { normalizeBudgets, normalizePrices, normalizeUsageEvents } from './schema';
import { actualMonths, buildSpendView } from './viewModel';

function loadData(): SpendDataset {
  const read = <T,>(file: string, normalize: (h: readonly string[], r: ReturnType<typeof readDataset>['rows']) => { rows: T[] }) => {
    const csv = readDataset(`ai-spend/${file}`);
    return normalize(csv.headers, csv.rows).rows;
  };
  const prices = read('model_pricing.csv', normalizePrices);
  return { events: priceEvents(read('usage_events.csv', normalizeUsageEvents), prices), prices, budgets: read('department_budgets.csv', normalizeBudgets), reports: [] };
}

const data = loadData();
const f = (over: Partial<SpendFilters>): SpendFilters => ({ ...EMPTY_SPEND_FILTERS, ...over });

const CASES: [string, SpendFilters][] = [
  ['no filters', EMPTY_SPEND_FILTERS],
  ['department', f({ department: 'Engineering' })],
  ['provider + model', f({ provider: 'Alder AI', model: 'alder-large' })],
  ['use case', f({ useCase: 'Reply drafting' })],
  ['date range', f({ fromMonth: '2026-03', toMonth: '2026-06' })],
  ['department + range', f({ department: 'Legal', fromMonth: '2026-05' })],
];

describe('view model consistency across filters', () => {
  for (const [name, filters] of CASES) {
    it(`${name}: KPIs, chart series, grouped totals, and table rows all reconcile`, () => {
      const v = buildSpendView(data, filters);
      const rowCost = v.events.reduce((n, e) => n + (e.costUsd ?? 0), 0);
      const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
      assert.equal(v.summary.requests, v.events.length); // KPI = table row count
      close(v.summary.spendUsd, rowCost);
      close(v.monthly.reduce((n, m) => n + m.totalUsd, 0), v.summary.spendUsd); // monthly chart = KPI
      close(v.daily.reduce((n, d) => n + d.spendUsd, 0), v.summary.spendUsd); // daily chart = KPI
      for (const dim of ['department', 'provider', 'model', 'useCase'] as const) {
        close(spendByDimension(v.events, dim).reduce((n, g) => n + g.spendUsd, 0), v.summary.spendUsd); // grouped bar = KPI
      }
      if (v.budget !== null) close(v.budget.actualUsd, v.summary.spendUsd); // budget actuals = KPI
    });
  }

  it('every filtered event satisfies every active filter', () => {
    const v = buildSpendView(data, f({ department: 'Engineering', provider: 'Alder AI', fromMonth: '2026-02', toMonth: '2026-04' }));
    assert.ok(v.events.length > 0);
    assert.ok(v.events.every((e) => e.department === 'Engineering' && e.provider === 'Alder AI' && e.month >= '2026-02' && e.month <= '2026-04'));
    assert.deepEqual(v.months, ['2026-02', '2026-03', '2026-04']);
  });

  it('an impossible combination yields an empty, non-crashing view', () => {
    const v = buildSpendView(data, f({ department: 'Legal', useCase: 'Reply drafting' }));
    assert.equal(v.events.length, 0);
    assert.equal(v.summary.spendUsd, 0);
    assert.equal(v.summary.successRate, null); // no denominator: null, not 0 or NaN
    assert.equal(v.summary.costPerSuccessfulTask, null);
    assert.equal(v.anomalies.length, 0);
    assert.equal(v.daily.length, 0);
  });

  it('an inverted date range is empty rather than an error', () => {
    const v = buildSpendView(data, f({ fromMonth: '2026-08', toMonth: '2026-02' }));
    assert.equal(v.events.length, 0);
    assert.equal(v.months.length, 0);
    assert.deepEqual(v.projection, []);
  });

  it('shows no budget comparison when provider, model, or use-case filters are active', () => {
    assert.equal(buildSpendView(data, f({ model: 'alder-large' })).budget, null);
    assert.ok(buildSpendView(data, f({ department: 'Finance' })).budget !== null);
  });

  it('projects only when the range reaches the latest month with data', () => {
    const full = buildSpendView(data, EMPTY_SPEND_FILTERS);
    assert.equal(full.projection.length, 3);
    const last = actualMonths(data).at(-1);
    assert.ok(full.projection.every((p) => last !== undefined && p.month > last));
    assert.deepEqual(buildSpendView(data, f({ toMonth: '2026-06' })).projection, []);
  });

  it('only months with usage appear on the monthly axis (budgeted future months are not compared)', () => {
    const v = buildSpendView(data, EMPTY_SPEND_FILTERS);
    assert.deepEqual(v.months, actualMonths(data));
    assert.ok(v.months.every((m) => m <= '2026-09'));
  });
});
