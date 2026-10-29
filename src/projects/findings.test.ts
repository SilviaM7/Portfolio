import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { priceEvents } from '@/analysis/spend';
import { readDataset } from '@/test/readDataset';
import { normalizeActivity, normalizeAssignments, normalizeContracts, normalizeEligibility } from './ai-adoption/schema';
import { buildAdoptionFindings } from './ai-adoption/findings';
import { buildSpendFindings } from './ai-spend/findings';
import { normalizeBudgets, normalizePrices, normalizeUsageEvents } from './ai-spend/schema';
import { buildWorkflowFindings } from './ai-workflow/findings';
import { normalizeAssumptions, normalizeWorkflowRecords } from './ai-workflow/schema';
import type { Finding } from './findings';

function load<T>(path: string, normalize: (headers: readonly string[], rows: ReturnType<typeof readDataset>['rows']) => T): T {
  const csv = readDataset(path);
  return normalize(csv.headers, csv.rows);
}

const spendUsage = load('ai-spend/usage_events.csv', normalizeUsageEvents);
const spendPrices = load('ai-spend/model_pricing.csv', normalizePrices);
const spendBudgets = load('ai-spend/department_budgets.csv', normalizeBudgets);
const spend = buildSpendFindings({ events: priceEvents(spendUsage.rows, spendPrices.rows), prices: spendPrices.rows, budgets: spendBudgets.rows, reports: [] });

const adoption = buildAdoptionFindings({
  assignments: load('ai-adoption/license_assignments.csv', normalizeAssignments).rows,
  activity: load('ai-adoption/product_activity.csv', normalizeActivity).rows,
  eligibility: load('ai-adoption/department_eligibility.csv', normalizeEligibility).rows,
  contracts: load('ai-adoption/contracts.csv', normalizeContracts).rows,
  reports: [],
});

const workflow = buildWorkflowFindings({
  records: load('ai-workflow/workflow_records.csv', normalizeWorkflowRecords).rows,
  assumptions: load('ai-workflow/cost_assumptions.csv', normalizeAssumptions),
  reports: [],
});

const BAD = /NaN|undefined|null|Infinity|\[object/;

describe('generated findings', () => {
  for (const [name, findings] of [['spend', spend], ['adoption', adoption], ['workflow', workflow]] as [string, Finding[]][]) {
    it(`${name}: has observed, scenario, and recommendation statements with no broken numbers`, () => {
      const kinds = new Set(findings.map((f) => f.kind));
      assert.ok(kinds.has('observed') && kinds.has('scenario') && kinds.has('recommendation'));
      for (const f of findings) {
        assert.ok(f.title.length > 0 && f.text.length > 20);
        assert.ok(!BAD.test(f.text), `${name} "${f.title}": ${f.text}`);
      }
    });
  }
  it('labels full-dataset statements as such', () => {
    assert.ok(spend.some((f) => /Full dataset/.test(f.text)));
    assert.ok(adoption.some((f) => /Full dataset/.test(f.text)));
    assert.ok(workflow.some((f) => /Full dataset/.test(f.text)));
  });
  it('frames scenario statements as assumption-based estimates, not realized results', () => {
    for (const f of [...spend, ...adoption, ...workflow].filter((x) => x.kind === 'scenario')) {
      assert.ok(!/\bwill save\b|realized savings of|you will\b/i.test(f.text), f.text);
      assert.ok(/assum|estimate|scenario|if the|with default|At the observed|Labor value here/i.test(f.text), `no assumption framing: ${f.text}`);
    }
  });
});
