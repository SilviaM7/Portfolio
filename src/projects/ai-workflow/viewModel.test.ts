import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultValueParams, EMPTY_WORKFLOW_FILTERS, taskMinutes, type WorkflowFilters } from '@/analysis/workflow';
import { readDataset } from '@/test/readDataset';
import type { WorkflowDataset } from './load';
import { normalizeAssumptions, normalizeWorkflowRecords } from './schema';
import { buildScenarioView, buildWorkflowView, PAYBACK_HORIZON_MONTHS, scenarioBaseFor } from './viewModel';

function loadData(): WorkflowDataset {
  const rec = readDataset('ai-workflow/workflow_records.csv');
  const asm = readDataset('ai-workflow/cost_assumptions.csv');
  return { records: normalizeWorkflowRecords(rec.headers, rec.rows).rows, assumptions: normalizeAssumptions(asm.headers, asm.rows), reports: [] };
}

const data = loadData();
const f = (over: Partial<WorkflowFilters>): WorkflowFilters => ({ ...EMPTY_WORKFLOW_FILTERS, ...over });
const close = (a: number | null, b: number | null) => {
  assert.ok(a !== null && b !== null, `${a} vs ${b}`);
  assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
};

const CASES: [string, WorkflowFilters][] = [
  ['no filters', EMPTY_WORKFLOW_FILTERS],
  ['workflow', f({ workflow: 'Invoice exception review' })],
  ['complexity', f({ complexity: 'high' })],
  ['team', f({ team: 'Team A' })],
  ['range', f({ fromMonth: '2026-04', toMonth: '2026-06' })],
];

describe('workflow view model consistency', () => {
  for (const [name, filters] of CASES) {
    it(`${name}: KPIs, complexity chart, trend, and table reconcile`, () => {
      const v = buildWorkflowView(data, filters);
      const { baseline, ai } = v.comparison;
      assert.equal(baseline.tasks + ai.tasks, v.records.length); // KPIs = table rows
      assert.equal(v.complexity.reduce((n, c) => n + c.baselineTasks + c.aiTasks, 0), v.records.length);
      assert.equal(v.trend.reduce((n, t) => n + t.pilotTasks + t.comparisonTasks, 0), v.records.length);
      // Mean minutes = Σ minutes / Σ timed tasks over the same rows (not an average of monthly means).
      const timed = v.records.filter((r) => r.process === 'ai_assisted').map(taskMinutes).filter((m): m is number => m !== null);
      if (timed.length > 0) close(ai.meanMinutes, timed.reduce((n, m) => n + m, 0) / timed.length);
      for (const r of v.records) {
        if (filters.workflow !== null) assert.equal(r.workflow, filters.workflow);
        if (filters.complexity !== null) assert.equal(r.complexity, filters.complexity);
        if (filters.team !== null) assert.equal(r.team, filters.team);
      }
    });
  }

  it('a filtered view carries only its share of program cost', () => {
    const all = buildWorkflowView(data, EMPTY_WORKFLOW_FILTERS).comparison.allocatedProgramCostUsd;
    const part = buildWorkflowView(data, f({ team: 'Team A' })).comparison.allocatedProgramCostUsd;
    assert.ok(part > 0 && part < all);
  });

  it('a comparison-only team has no AI rows and returns nulls, not zeros', () => {
    const v = buildWorkflowView(data, f({ team: 'Team C' }));
    assert.equal(v.comparison.ai.tasks, 0);
    assert.equal(v.comparison.ai.passRate, null);
    assert.equal(v.comparison.minutesSavedRaw, null);
  });

  it('pilot start is the first AI-assisted month', () => {
    assert.equal(buildWorkflowView(data, EMPTY_WORKFLOW_FILTERS).pilotStart, '2026-04');
  });
});

describe('scenario view model', () => {
  const base = scenarioBaseFor(data);
  assert.ok(base !== null);
  const params = defaultValueParams(base);

  it('payback series starts at minus one-time cost and matches the monthly estimate', () => {
    const s = buildScenarioView(base, params);
    assert.equal(s.payback.length, PAYBACK_HORIZON_MONTHS + 1);
    close(s.payback[0]?.estimatedUsd ?? null, -s.estimate.oneTimeUsd);
    close((s.payback[1]?.estimatedUsd ?? 0) - (s.payback[0]?.estimatedUsd ?? 0), s.estimate.estimatedNetValueUsdPerMonth);
    close((s.payback[1]?.cashUsd ?? 0) - (s.payback[0]?.cashUsd ?? 0), s.estimate.cashNetUsdPerMonth);
    assert.equal(s.sensitivity.length, 19);
  });

  it('cash view never exceeds the estimated value view when nothing is converted to cash', () => {
    const s = buildScenarioView(base, { ...params, cashRealizationShare: 0 });
    assert.ok(s.estimate.cashNetUsdPerMonth <= s.estimate.estimatedNetValueUsdPerMonth);
  });

  it('full cash realization makes both views equal', () => {
    const s = buildScenarioView(base, { ...params, cashRealizationShare: 1 });
    close(s.estimate.cashNetUsdPerMonth, s.estimate.estimatedNetValueUsdPerMonth);
  });
});
