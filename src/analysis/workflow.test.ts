import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataError } from '@/data/errors';
import { normalizeAssumptions, normalizeWorkflowRecords } from '@/projects/ai-workflow/schema';
import { readDataset } from '@/test/readDataset';
import {
  buildScenarioBase,
  byComplexity,
  compareProcesses,
  complexityMix,
  cumulativeValue,
  defaultValueParams,
  estimateValue,
  filterRecords,
  monthlyTrend,
  pilotTeams,
  programCostUsd,
  sensitivity,
  standardizedMean,
  summarizeProcess,
  taskCostUsd,
  taskMinutes,
  EMPTY_WORKFLOW_FILTERS,
  type ScenarioBase,
  type WorkflowAssumptions,
  type WorkflowRecord,
} from './workflow';

// $60/hour makes one minute cost exactly $1, so expected values are easy to verify by hand.
const A: WorkflowAssumptions = {
  laborRateUsdPerHour: 60,
  aiVariableCostUsdPerTask: 2,
  escalationCostUsdPerTask: 10,
  softwareUsdPerMonth: 100,
  implementationOneTimeUsd: 1000,
  trainingOneTimeUsd: 500,
};

let counter = 0;
function rec(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  counter += 1;
  return {
    taskId: `T${counter}`, month: '2026-02', workflow: 'W1', complexity: 'low', team: 'Team A', process: 'baseline',
    handlingMinutes: 10, reviewMinutes: 2, reworkMinutes: 3, quality: 'pass', escalated: false, ...overrides,
  };
}

describe('task-level calculations', () => {
  it('adds handling, review, and rework minutes', () => assert.equal(taskMinutes(rec()), 15));
  it('returns null (not zero) when rework is not recorded', () => {
    assert.equal(taskMinutes(rec({ reworkMinutes: null })), null);
    assert.equal(taskCostUsd(rec({ reworkMinutes: null }), A), null);
  });
  it('prices labor, AI variable cost only for AI-assisted tasks, and escalation only when escalated', () => {
    assert.equal(taskCostUsd(rec(), A), 15);
    assert.equal(taskCostUsd(rec({ process: 'ai_assisted' }), A), 17);
    assert.equal(taskCostUsd(rec({ process: 'ai_assisted', escalated: true }), A), 27);
  });
});

describe('summarizeProcess', () => {
  const rows = [
    rec(), // 15 min, pass
    rec({ handlingMinutes: 20, reviewMinutes: 2, reworkMinutes: 0, quality: 'fail' }), // 22 min, fail
    rec({ handlingMinutes: 10, reviewMinutes: 1, reworkMinutes: 0, quality: null }), // 11 min, not audited
    rec({ reworkMinutes: null }), // time unknown, pass
  ];
  const s = summarizeProcess(rows, A);

  it('excludes unrecorded rework from time metrics and unaudited rows from quality metrics', () => {
    assert.equal(s.tasks, 4);
    assert.equal(s.timeTasks, 3);
    assert.equal(s.meanMinutes, (15 + 22 + 11) / 3);
    assert.equal(s.auditedTasks, 3);
    assert.equal(s.passedTasks, 2);
    assert.equal(s.passRate, 2 / 3);
  });
  it('charges failed work to the cost of each success', () => {
    assert.equal(s.analyzableTasks, 2); // only rows with BOTH rework recorded and quality audited
    assert.equal(s.analyzableOperatingCostUsd, 37);
    assert.equal(s.successfulTasks, 1);
    assert.equal(s.costPerSuccessfulTaskUsd, 37);
  });
  it('returns null rates for empty input', () => {
    const empty = summarizeProcess([], A);
    assert.equal(empty.meanMinutes, null);
    assert.equal(empty.passRate, null);
    assert.equal(empty.costPerSuccessfulTaskUsd, null);
  });
});

describe('complexity standardization', () => {
  const baseline = [
    ...Array.from({ length: 3 }, () => rec({ handlingMinutes: 20, reviewMinutes: 0, reworkMinutes: 0 })),
    rec({ complexity: 'high', handlingMinutes: 60, reviewMinutes: 0, reworkMinutes: 0 }),
  ];
  it('reweights to a target mix so a different task mix is not read as a process effect', () => {
    const raw = summarizeProcess(baseline, A).meanMinutes;
    assert.equal(raw, 30); // (20*3 + 60) / 4
    const standardized = standardizedMean(baseline, { low: 0.5, medium: 0, high: 0.5 }, taskMinutes);
    assert.equal(standardized, 40); // 0.5*20 + 0.5*60
  });
  it('computes mix shares and drops levels with no data', () => {
    const mix = complexityMix(baseline);
    assert.equal(mix.low, 0.75);
    assert.equal(mix.high, 0.25);
    assert.equal(standardizedMean(baseline, { low: 0.5, medium: 0.5, high: 0 }, taskMinutes), 20); // medium has no rows
  });
});

describe('program cost allocation and comparison', () => {
  const all = [
    rec({ month: '2026-01' }),
    rec({ month: '2026-02', process: 'ai_assisted', team: 'Team A', workflow: 'W1' }),
    rec({ month: '2026-02', process: 'ai_assisted', team: 'Team A', workflow: 'W2' }),
    rec({ month: '2026-03', process: 'ai_assisted', team: 'Team A', workflow: 'W1' }),
    rec({ month: '2026-03', process: 'ai_assisted', team: 'Team A', workflow: 'W2' }),
  ];
  it('adds software for each pilot month plus one-time costs', () => {
    assert.equal(programCostUsd(all, A), 2 * 100 + 1000 + 500);
  });
  it('allocates program cost by the share of AI tasks in the filtered view', () => {
    const view = filterRecords(all, { ...EMPTY_WORKFLOW_FILTERS, workflow: 'W1' });
    const c = compareProcesses(view, all, A);
    assert.equal(c.ai.tasks, 2);
    assert.equal(c.allocatedProgramCostUsd, 1700 * (2 / 4));
  });
  it('reports a raw and a standardized difference in minutes', () => {
    const c = compareProcesses(all, all, A);
    assert.equal(c.baseline.meanMinutes, 15);
    assert.equal(c.minutesSavedRaw, 0); // identical durations in this fixture
    assert.equal(c.minutesSavedStandardized, 0);
  });
});

describe('filtering', () => {
  const rows = [rec({ month: '2026-01' }), rec({ month: '2026-02', team: 'Team B' }), rec({ month: '2026-03', complexity: 'high' })];
  it('applies every filter together and an empty filter set returns all rows', () => {
    assert.equal(filterRecords(rows, EMPTY_WORKFLOW_FILTERS).length, 3);
    assert.equal(filterRecords(rows, { ...EMPTY_WORKFLOW_FILTERS, fromMonth: '2026-02' }).length, 2);
    assert.equal(filterRecords(rows, { ...EMPTY_WORKFLOW_FILTERS, fromMonth: '2026-02', team: 'Team B' }).length, 1);
    assert.equal(filterRecords(rows, { ...EMPTY_WORKFLOW_FILTERS, complexity: 'high', team: 'Team B' }).length, 0);
  });
});

describe('value estimates, break-even, and payback', () => {
  // Baseline 40 min, AI 30 min, both pass 100%, no escalation, $1/min labor, $2 AI cost per task.
  const base: ScenarioBase = {
    levels: [{ complexity: 'low', share: 1, baselineMinutes: 40, aiMinutes: 30, baselinePassRate: 1, aiPassRate: 1, baselineEscalationRate: 0, aiEscalationRate: 0 }],
    observedAiTasksPerMonth: 100,
    assumptions: A,
  };
  const params = { ...defaultValueParams(base) };

  it('uses the observed monthly AI volume as the default', () => assert.equal(params.monthlyVolume, 100));

  it('values released capacity, then subtracts AI variable and software cost', () => {
    const e = estimateValue(base, params);
    assert.equal(e.valuePerSuccessfulTaskUsd, 8); // 10 min saved - $2 AI cost
    assert.equal(e.capacityHoursPerMonth, (100 * 10) / 60);
    assert.equal(e.estimatedGrossValueUsdPerMonth, 800);
    assert.equal(e.estimatedNetValueUsdPerMonth, 700);
    assert.equal(e.breakEvenAiTasksPerMonth, 12.5); // $100 software / $8 per task
    assert.equal(e.oneTimeUsd, 1500);
    assert.equal(e.paybackMonthsEstimated, 1500 / 700);
  });

  it('shows no cash savings unless a share of capacity is explicitly converted to cash', () => {
    const none = estimateValue(base, { ...params, cashRealizationShare: 0 });
    assert.equal(none.cashNetUsdPerMonth, -300); // $200 AI cost + $100 software, no cash offset
    assert.equal(none.paybackMonthsCash, null);
    const all = estimateValue(base, { ...params, cashRealizationShare: 1 });
    assert.equal(all.cashNetUsdPerMonth, 700);
    assert.equal(all.paybackMonthsCash, 1500 / 700);
  });

  it('scales with adoption, time savings, labor rate, and pass-rate shifts', () => {
    assert.equal(estimateValue(base, { ...params, adoptionShare: 0.5 }).estimatedGrossValueUsdPerMonth, 400);
    assert.equal(estimateValue(base, { ...params, timeSavingsFactor: 0.5 }).valuePerSuccessfulTaskUsd, 3); // 5 min saved - $2
    assert.equal(estimateValue(base, { ...params, laborRateFactor: 2 }).valuePerSuccessfulTaskUsd, 18); // 20 - 2
    // AI pass rate 50%: cost per success 30/0.5 = 60 > baseline 40, so AI is more expensive per success.
    const worse = estimateValue(base, { ...params, passRateShift: -0.5 });
    assert.ok(worse.valuePerSuccessfulTaskUsd < 0);
    assert.equal(worse.breakEvenAiTasksPerMonth, null);
    assert.equal(worse.paybackMonthsEstimated, null);
  });

  it('never goes below zero adoption or above full adoption', () => {
    assert.equal(estimateValue(base, { ...params, adoptionShare: 5 }).estimatedGrossValueUsdPerMonth, 800);
    assert.equal(estimateValue(base, { ...params, adoptionShare: -1 }).estimatedGrossValueUsdPerMonth, 0);
  });

  it('builds a cumulative payback line starting at minus the one-time cost', () => {
    const line = cumulativeValue(700, 1500, 3);
    assert.deepEqual(line.map((p) => p.cumulativeUsd), [-1500, -800, -100, 600]);
  });

  it('lets routing only some complexity levels to AI change the result', () => {
    const twoLevels: ScenarioBase = {
      ...base,
      levels: [
        { complexity: 'low', share: 0.5, baselineMinutes: 40, aiMinutes: 30, baselinePassRate: 1, aiPassRate: 1, baselineEscalationRate: 0, aiEscalationRate: 0 },
        { complexity: 'high', share: 0.5, baselineMinutes: 40, aiMinutes: 50, baselinePassRate: 1, aiPassRate: 1, baselineEscalationRate: 0, aiEscalationRate: 0 },
      ],
    };
    const all = estimateValue(twoLevels, params);
    // low: 50 tasks x (10 - 2) = 400; high: 50 tasks x (-10 - 2) = -600
    assert.equal(all.estimatedGrossValueUsdPerMonth, -200);
    assert.equal(all.aiRoutedTasksPerMonth, 100);
    const lowOnly = estimateValue(twoLevels, { ...params, complexities: ['low'] });
    assert.equal(lowOnly.estimatedGrossValueUsdPerMonth, 400);
    assert.equal(lowOnly.aiRoutedTasksPerMonth, 50);
    assert.equal(lowOnly.valuePerSuccessfulTaskUsd, 8);
    assert.equal(estimateValue(twoLevels, { ...params, complexities: [] }).estimatedGrossValueUsdPerMonth, 0);
  });

  it('sensitivity rows each change one input and the unchanged setting reproduces the base case', () => {
    const rows = sensitivity(base, params);
    assert.equal(rows.length, 19);
    const baseNet = estimateValue(base, params).estimatedNetValueUsdPerMonth;
    const unchanged = ['100%', '+0 pts', '100% of volume', '100% of assumption', '1× current volume', 'All complexities'];
    for (const r of rows.filter((x) => unchanged.includes(x.setting))) {
      assert.equal(r.estimatedNetValueUsdPerMonth, baseNet, `${r.parameter} ${r.setting}`);
    }
  });
});

describe('bundled dataset: normalization, reconciliation, and scenario base', () => {
  const recordsCsv = readDataset('ai-workflow/workflow_records.csv');
  const assumptionsCsv = readDataset('ai-workflow/cost_assumptions.csv');
  const normalized = normalizeWorkflowRecords(recordsCsv.headers, recordsCsv.rows);
  const assumptions = normalizeAssumptions(assumptionsCsv.headers, assumptionsCsv.rows);
  const records = normalized.rows;

  it('reports the seeded data-quality issues and keeps those rows with null values', () => {
    const count = (code: string) => normalized.issues.find((i) => i.code === code)?.count ?? 0;
    assert.equal(count('missing_quality'), 11);
    assert.equal(count('missing_rework'), 5);
    assert.equal(records.filter((r) => r.quality === null).length, 11);
    assert.equal(records.filter((r) => r.reworkMinutes === null).length, 5);
    assert.equal(records.length, normalized.totalRows);
  });

  it('parses every cost assumption', () => {
    assert.equal(assumptions.laborRateUsdPerHour, 38);
    assert.equal(assumptions.implementationOneTimeUsd + assumptions.trainingOneTimeUsd, 29500);
  });

  it('reconciles process counts and an independently computed mean for AI-assisted minutes', () => {
    const c = compareProcesses(records, records, assumptions);
    assert.equal(c.baseline.tasks + c.ai.tasks, records.length);
    let total = 0;
    let n = 0;
    for (const r of records) {
      if (r.process !== 'ai_assisted' || r.reworkMinutes === null) continue;
      total += r.handlingMinutes + r.reviewMinutes + r.reworkMinutes;
      n += 1;
    }
    assert.ok(Math.abs((c.ai.meanMinutes ?? 0) - total / n) < 1e-9);
    assert.equal(c.ai.timeTasks, n);
  });

  it('only pilot teams have AI-assisted work, starting in the pilot period', () => {
    const ai = records.filter((r) => r.process === 'ai_assisted');
    assert.ok(ai.length > 0);
    assert.ok(ai.every((r) => r.month >= '2026-04'));
    assert.deepEqual([...pilotTeams(records)].sort(), ['Team A', 'Team B']);
  });

  it('breaks results out by complexity without losing tasks', () => {
    const rows = byComplexity(records, assumptions);
    assert.equal(rows.reduce((n, r) => n + r.baselineTasks + r.aiTasks, 0), records.length);
  });

  it('produces a monthly pilot vs comparison trend covering every task', () => {
    const months = [...new Set(records.map((r) => r.month))].sort();
    const trend = monthlyTrend(records, months, pilotTeams(records), assumptions);
    assert.equal(trend.reduce((n, t) => n + t.pilotTasks + t.comparisonTasks, 0), records.length);
  });

  it('builds a scenario base from the full dataset', () => {
    const base = buildScenarioBase(records, assumptions);
    assert.ok(base);
    assert.equal(base.levels.length, 3);
    assert.ok(Math.abs(base.levels.reduce((n, l) => n + l.share, 0) - 1) < 1e-9);
    assert.ok(base.levels.every((l) => l.baselineMinutes > 0 && l.aiMinutes > 0));
    assert.ok(base.observedAiTasksPerMonth > 0);
    const e = estimateValue(base, defaultValueParams(base));
    assert.ok(Number.isFinite(e.estimatedNetValueUsdPerMonth));
  });

  it('rejects an assumptions file with a missing parameter instead of defaulting to zero', () => {
    const incomplete = assumptionsCsv.rows.filter((r) => r['parameter'] !== 'labor_rate_usd_per_hour');
    assert.throws(() => normalizeAssumptions(assumptionsCsv.headers, incomplete), DataError);
  });

  it('rejects a records file with missing columns', () => {
    assert.throws(() => normalizeWorkflowRecords(['task_id', 'month'], []), DataError);
  });
});
