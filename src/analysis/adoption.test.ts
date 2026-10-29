import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeActivity, normalizeAssignments, normalizeContracts, normalizeEligibility } from '@/projects/ai-adoption/schema';
import { readDataset } from '@/test/readDataset';
import {
  adoptionByDimension,
  buildSeats,
  buildWindow,
  countPreAssignmentActivity,
  estimateReclaim,
  filterSeats,
  heldInWeek,
  summarizeAdoption,
  weeklyAdoption,
  type ActivityRow,
  type Assignment,
  type Contract,
  type Eligibility,
} from './adoption';

// Mondays: 2026-08-03, 08-10, 08-17, 08-24 (window of 4 weeks ends Sunday 2026-08-30).
const WEEKS = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'];

function seat(id: string, overrides: Partial<Assignment> = {}): Assignment {
  return { assignmentId: `A-${id}`, employeeId: id, department: 'Ops', product: 'Atlas', assignedDate: '2026-01-05', unassignedDate: null, ...overrides };
}
function act(employeeId: string, weekStart: string, activeDays: number | null, product = 'Atlas'): ActivityRow {
  return { employeeId, product, weekStart, activeDays, actions: activeDays === null ? null : activeDays * 3 };
}
/** Telemetry rows for every window week with the same active-day count. */
const allWeeks = (employeeId: string, days: number | null, product = 'Atlas') => WEEKS.map((w) => act(employeeId, w, days, product));

const CONTRACT: Contract = {
  product: 'Atlas', seatPriceUsdPerMonth: 30, committedSeats: 10, termStart: '2026-01-01', renewalDate: '2026-12-31', noticeDays: 60, floorSeatsAtRenewal: 6,
};

describe('held-seat rules', () => {
  it('treats assignment and unassignment days as held (inclusive week overlap)', () => {
    const a = { assignedDate: '2026-08-09', unassignedDate: '2026-08-10' };
    assert.equal(heldInWeek(a, '2026-08-03'), true); // assigned on the Sunday of that week
    assert.equal(heldInWeek(a, '2026-08-10'), true); // unassigned on the Monday of that week
    assert.equal(heldInWeek(a, '2026-08-17'), false);
    assert.equal(heldInWeek(a, '2026-07-27'), false);
  });
});

describe('observation window', () => {
  it('uses the last N telemetry weeks and ends on the Sunday of the last week', () => {
    const window = buildWindow([...allWeeks('E1', 1)], 2);
    assert.deepEqual(window?.weeks, ['2026-08-17', '2026-08-24']);
    assert.equal(window?.start, '2026-08-17');
    assert.equal(window?.end, '2026-08-30');
  });
  it('returns null without telemetry', () => assert.equal(buildWindow([], 4), null));
});

describe('seat status', () => {
  const assignments: Assignment[] = [
    seat('ACTIVE'),
    seat('INACTIVE'),
    seat('BLANK'),
    seat('NEW', { assignedDate: '2026-08-10' }), // held 20 days at window end: inside the grace period
    seat('REMOVED', { unassignedDate: '2026-08-01' }), // not held at the as-of date
    seat('LATE_ACTIVE', { assignedDate: '2026-08-12' }), // new but already active
  ];
  const activity: ActivityRow[] = [
    ...allWeeks('ACTIVE', 0).slice(0, 3),
    act('ACTIVE', '2026-08-24', 2),
    ...allWeeks('INACTIVE', 0),
    ...allWeeks('BLANK', null),
    act('NEW', '2026-08-17', 0),
    act('NEW', '2026-08-24', 0),
    act('LATE_ACTIVE', '2026-08-17', 1),
    ...allWeeks('REMOVED', 3),
  ];
  const window = buildWindow(activity, 4);
  assert.ok(window);
  const seats = buildSeats(assignments, activity, window);
  const statusOf = (id: string) => seats.find((s) => s.employeeId === id)?.status;

  it('classifies seats by activity in the weeks they were held', () => {
    assert.equal(statusOf('ACTIVE'), 'active');
    assert.equal(statusOf('INACTIVE'), 'inactive');
    assert.equal(statusOf('NEW'), 'new');
    assert.equal(statusOf('LATE_ACTIVE'), 'active');
  });
  it('treats blank telemetry as unknown, never as inactive (not zero)', () => assert.equal(statusOf('BLANK'), 'unknown'));
  it('excludes seats not held on the as-of date', () => assert.equal(statusOf('REMOVED'), undefined));

  it('summarizes with weighted ratios and cost per active seat', () => {
    const eligibility: Eligibility[] = [{ department: 'Ops', product: 'Atlas', headcount: 20, eligible: 10 }];
    const s = summarizeAdoption(seats, eligibility, [CONTRACT]);
    assert.equal(s.assignedSeats, 5);
    assert.equal(s.activeSeats, 2);
    assert.equal(s.inactiveSeats, 1);
    assert.equal(s.newSeats, 1);
    assert.equal(s.unknownSeats, 1);
    assert.equal(s.utilization, 2 / 5);
    assert.equal(s.coverage, 5 / 10);
    assert.equal(s.assignedSeatCostUsdPerMonth, 150);
    assert.equal(s.costPerActiveSeatUsdPerMonth, 75);
    assert.equal(s.inactiveSeatCostUsdPerMonth, 30);
  });

  it('computes utilization per group from sums, not by averaging group percentages', () => {
    const grouped = adoptionByDimension(
      [
        ...Array.from({ length: 9 }, (_, i) => ({ ...(seats[0] as (typeof seats)[number]), employeeId: `X${i}`, department: 'Big', status: 'active' as const })),
        { ...(seats[0] as (typeof seats)[number]), employeeId: 'Y', department: 'Big', status: 'inactive' as const },
        { ...(seats[0] as (typeof seats)[number]), employeeId: 'Z', department: 'Small', status: 'inactive' as const },
      ],
      'department',
    );
    assert.equal(grouped.find((g) => g.key === 'Big')?.utilization, 0.9);
    assert.equal(grouped.find((g) => g.key === 'Small')?.utilization, 0);
  });

  it('filters seats by department and product', () => {
    assert.equal(filterSeats(seats, { department: 'Ops', product: null }).length, seats.length);
    assert.equal(filterSeats(seats, { department: 'Nope', product: null }).length, 0);
    assert.equal(filterSeats(seats, { department: null, product: 'Other' }).length, 0);
  });
});

describe('pre-assignment (trial) activity', () => {
  it('is excluded from seat status and counted separately', () => {
    const assignments = [seat('T1', { assignedDate: '2026-08-20' })];
    const activity = [act('T1', '2026-08-03', 3), act('T1', '2026-08-17', 0), act('T1', '2026-08-24', 0)];
    assert.equal(countPreAssignmentActivity(assignments, activity), 1);
    const window = buildWindow(activity, 4);
    assert.ok(window);
    assert.equal(buildSeats(assignments, activity, window)[0]?.status, 'new'); // the trial week did not make it "active"
  });
});

describe('weekly adoption trend', () => {
  it('uses reported seats as the denominator and returns null for a week with no reports', () => {
    const assignments = [seat('W1'), seat('W2')];
    const activity = [act('W1', '2026-08-03', 2), act('W2', '2026-08-03', 0), act('W1', '2026-08-10', null), act('W2', '2026-08-10', null)];
    const points = weeklyAdoption(assignments, activity, { department: null, product: null });
    assert.equal(points[0]?.activeRate, 0.5);
    assert.equal(points[1]?.heldSeats, 2);
    assert.equal(points[1]?.activeRate, null);
  });
});

describe('reclaim scenario and contract terms', () => {
  const mkSeats = (active: number, inactive: number) =>
    buildSeatsFor([...Array.from({ length: active }, (_, i) => `A${i}`), ...Array.from({ length: inactive }, (_, i) => `I${i}`)], active);

  function buildSeatsFor(ids: string[], activeCount: number) {
    const assignments = ids.map((id) => seat(id));
    const activity = ids.flatMap((id, i) => allWeeks(id, i < activeCount ? 2 : 0));
    const window = buildWindow(activity, 4);
    assert.ok(window);
    return buildSeats(assignments, activity, window);
  }

  it('never proposes fewer seats than the contract floor and credits savings when notice is open', () => {
    const [e] = estimateReclaim(mkSeats(5, 5), [], [CONTRACT], '2026-08-30', { reclaimShare: 1, bufferShare: 0 });
    assert.ok(e);
    assert.equal(e.heldSeats, 10);
    assert.equal(e.inactiveSeats, 5);
    assert.equal(e.reclaimedSeats, 5);
    assert.equal(e.proposedCommitment, 6); // target 5 is below the floor of 6
    assert.equal(e.noticeDeadline, '2026-11-01'); // 60 days before 2026-12-31
    assert.equal(e.noticeOpen, true);
    assert.equal(e.annualSavingsUsd, (10 - 6) * 30 * 12);
    assert.equal(e.deferredAnnualSavingsUsd, 0);
  });

  it('credits no savings once the notice deadline has passed and reports the deferred amount', () => {
    const [e] = estimateReclaim(mkSeats(5, 5), [], [CONTRACT], '2026-11-02', { reclaimShare: 1, bufferShare: 0 });
    assert.ok(e);
    assert.equal(e.noticeOpen, false);
    assert.equal(e.annualSavingsUsd, 0);
    assert.equal(e.deferredAnnualSavingsUsd, 4 * 30 * 12);
    assert.ok(e.daysToNoticeDeadline < 0);
  });

  it('never proposes more seats than currently committed', () => {
    const [e] = estimateReclaim(mkSeats(10, 0), [], [CONTRACT], '2026-08-30', { reclaimShare: 0.5, bufferShare: 0.5 });
    assert.equal(e?.proposedCommitment, 10);
    assert.equal(e?.annualSavingsUsd, 0);
  });
});

describe('bundled dataset: normalization and reconciliation', () => {
  const assignmentsCsv = readDataset('ai-adoption/license_assignments.csv');
  const activityCsv = readDataset('ai-adoption/product_activity.csv');
  const eligibilityCsv = readDataset('ai-adoption/department_eligibility.csv');
  const contractsCsv = readDataset('ai-adoption/contracts.csv');
  const assignments = normalizeAssignments(assignmentsCsv.headers, assignmentsCsv.rows);
  const activity = normalizeActivity(activityCsv.headers, activityCsv.rows);
  const eligibility = normalizeEligibility(eligibilityCsv.headers, eligibilityCsv.rows);
  const contracts = normalizeContracts(contractsCsv.headers, contractsCsv.rows);

  it('reports the seeded data-quality issues instead of hiding them', () => {
    const count = (code: string) => assignments.issues.find((i) => i.code === code)?.count ?? 0;
    assert.equal(count('overlapping_duplicate_seat'), 4);
    assert.ok(count('impossible_date_range') >= 1 && count('impossible_date_range') <= 3);
    assert.ok((activity.issues.find((i) => i.code === 'blank_telemetry')?.count ?? 0) > 0);
    assert.equal(assignments.rows.length + assignments.issues.reduce((n, i) => n + i.count, 0), assignments.totalRows);
  });

  it('keeps blank telemetry as null, not zero', () => {
    const blank = activity.rows.filter((r) => r.activeDays === null);
    assert.ok(blank.length > 0);
    assert.ok(blank.every((r) => r.actions === null));
  });

  it('keeps foreign keys valid (every activity row and seat product has a contract)', () => {
    const products = new Set(contracts.rows.map((c) => c.product));
    assert.ok(assignments.rows.every((a) => products.has(a.product)));
    assert.ok(activity.rows.every((r) => products.has(r.product)));
    assert.ok(eligibility.rows.every((e) => products.has(e.product)));
  });

  it('reconciles seat counts with an independent count of held assignments', () => {
    const window = buildWindow(activity.rows, 8);
    assert.ok(window);
    const seats = buildSeats(assignments.rows, activity.rows, window);
    const independent = assignments.rows.filter((a) => a.assignedDate <= window.end && (a.unassignedDate === null || a.unassignedDate >= window.end)).length;
    assert.equal(seats.length, independent);
    const s = summarizeAdoption(seats, eligibility.rows, contracts.rows);
    assert.equal(s.activeSeats + s.inactiveSeats + s.newSeats + s.unknownSeats, s.assignedSeats);
    const byProduct = adoptionByDimension(seats, 'product');
    assert.equal(byProduct.reduce((n, g) => n + g.assigned, 0), s.assignedSeats);
    const byDept = adoptionByDimension(seats, 'department');
    assert.equal(byDept.reduce((n, g) => n + g.active, 0), s.activeSeats);
    // cost reconciles with seats x price per product
    const cost = byProduct.reduce((n, g) => n + g.assigned * (contracts.rows.find((c) => c.product === g.key)?.seatPriceUsdPerMonth ?? 0), 0);
    assert.equal(s.assignedSeatCostUsdPerMonth, cost);
  });

  it('flags the seeded trial-use rows and the Forge Code notice deadline already passed', () => {
    assert.ok(countPreAssignmentActivity(assignments.rows, activity.rows) >= 1);
    const window = buildWindow(activity.rows, 8);
    assert.ok(window);
    const seats = buildSeats(assignments.rows, activity.rows, window);
    const forge = estimateReclaim(seats, eligibility.rows, contracts.rows, window.end, { reclaimShare: 0.6, bufferShare: 0.05 }).find((e) => e.product === 'Forge Code');
    assert.equal(forge?.noticeOpen, false);
    assert.equal(forge?.annualSavingsUsd, 0);
  });
});
