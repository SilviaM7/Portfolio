import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_RECLAIM_PARAMS, EMPTY_ADOPTION_FILTERS } from '@/analysis/adoption';
import { readDataset } from '@/test/readDataset';
import type { AdoptionDataset } from './load';
import { normalizeActivity, normalizeAssignments, normalizeContracts, normalizeEligibility } from './schema';
import { buildAdoptionView, windowChoices, type AdoptionViewFilters } from './viewModel';

function loadData(): AdoptionDataset {
  const read = <T,>(file: string, normalize: (h: readonly string[], r: ReturnType<typeof readDataset>['rows']) => { rows: T[] }) => {
    const csv = readDataset(`ai-adoption/${file}`);
    return normalize(csv.headers, csv.rows).rows;
  };
  return {
    assignments: read('license_assignments.csv', normalizeAssignments),
    activity: read('product_activity.csv', normalizeActivity),
    eligibility: read('department_eligibility.csv', normalizeEligibility),
    contracts: read('contracts.csv', normalizeContracts),
    reports: [],
  };
}

const data = loadData();
const f = (over: Partial<AdoptionViewFilters>): AdoptionViewFilters => ({ ...EMPTY_ADOPTION_FILTERS, windowWeeks: 8, ...over });
const view = (filters: AdoptionViewFilters) => {
  const v = buildAdoptionView(data, filters, DEFAULT_RECLAIM_PARAMS);
  assert.ok(v !== null, 'expected telemetry');
  return v;
};

const CASES: [string, AdoptionViewFilters][] = [
  ['no filters, 8 weeks', f({})],
  ['4-week window', f({ windowWeeks: 4 })],
  ['12-week window', f({ windowWeeks: 12 })],
  ['department', f({ department: 'Engineering' })],
  ['product', f({ product: 'Scribe Meetings' })],
  ['department + product', f({ department: 'Customer Support', product: 'Atlas Assistant' })],
];

describe('adoption view model consistency', () => {
  for (const [name, filters] of CASES) {
    it(`${name}: KPIs, grouped charts, and the seat table reconcile`, () => {
      const v = view(filters);
      const s = v.summary;
      assert.equal(s.assignedSeats, v.seats.length); // KPI = table rows
      assert.equal(s.activeSeats + s.inactiveSeats + s.newSeats + s.unknownSeats, s.assignedSeats); // statuses partition seats
      for (const groups of [v.byDepartment, v.byProduct, v.byCohort]) {
        assert.equal(groups.reduce((n, g) => n + g.assigned, 0), s.assignedSeats);
        assert.equal(groups.reduce((n, g) => n + g.active, 0), s.activeSeats);
        assert.equal(groups.reduce((n, g) => n + g.inactive, 0), s.inactiveSeats);
      }
      for (const seat of v.seats) {
        if (filters.department !== null) assert.equal(seat.department, filters.department);
        if (filters.product !== null) assert.equal(seat.product, filters.product);
      }
      assert.equal(v.window.weeks.length, Math.min(filters.windowWeeks, v.availableWeeks));
    });
  }

  it('utilization is a ratio of sums, not an average of group rates', () => {
    const v = view(f({}));
    assert.equal(v.summary.utilization, v.summary.activeSeats / v.summary.assignedSeats);
  });

  it('reclaim scenario uses company-wide seats even when a department is selected', () => {
    const all = view(f({}));
    const dept = view(f({ department: 'Engineering' }));
    assert.deepEqual(dept.reclaim, all.reclaim);
    assert.ok(all.reclaim.every((r) => r.proposedCommitment >= r.floorSeatsAtRenewal && r.proposedCommitment <= r.committedSeats));
  });

  it('reclaim scenario follows the product filter', () => {
    const v = view(f({ product: 'Forge Code' }));
    assert.deepEqual(v.reclaim.map((r) => r.product), ['Forge Code']);
  });

  it('a department with no matching seats yields an empty, not broken, view', () => {
    const v = view(f({ department: 'No such department' }));
    assert.equal(v.seats.length, 0);
    assert.equal(v.summary.utilization, null);
    assert.equal(v.summary.costPerActiveSeatUsdPerMonth, null);
  });

  it('returns null when there is no telemetry', () => {
    assert.equal(buildAdoptionView({ ...data, activity: [] }, f({}), DEFAULT_RECLAIM_PARAMS), null);
  });

  it('window choices never exceed the telemetry available', () => {
    assert.deepEqual(windowChoices(12), [4, 8, 12]);
    assert.deepEqual(windowChoices(6), [4, 6]);
    assert.deepEqual(windowChoices(3), [3]);
    assert.deepEqual(windowChoices(0), []);
  });
});
