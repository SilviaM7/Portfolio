/**
 * AI Adoption & License Utilization: pure calculations. No React, no network.
 *
 * Definitions (also shown to visitors in the methodology panel):
 *   - SEAT: one employee-product license assignment (employee_id + product). Everything here counts seats,
 *     so an employee holding two products counts once per product.
 *   - HELD seat in a week: assigned_date <= week end AND (not unassigned OR unassigned_date >= week start).
 *   - OBSERVATION WINDOW: the last N telemetry weeks. "As of" is the last day of the last telemetry week.
 *   - Seats IN SCOPE: held on the as-of date (the paid seats at that moment).
 *   - Seat status in scope:
 *       active   = at least one active day in a week the seat was held (inside the window)
 *       inactive = held >= NEW_SEAT_GRACE_DAYS, has telemetry, and zero active days in every held window week
 *       new      = held < NEW_SEAT_GRACE_DAYS and no activity yet (too early to judge)
 *       unknown  = no telemetry at all for the held window weeks (blank telemetry is NOT treated as zero)
 *   - Activity in weeks BEFORE the seat was assigned (trial use) is excluded from active counts.
 *   - Utilization = active seats / seats in scope (a weighted ratio, never an average of percentages).
 *   Activity-based measures describe usage, not business value: an inactive seat may serve an occasional but
 *   important task, and an active seat may deliver little value.
 */
import { addDays, daysBetween } from '@/lib/dates';
import { clamp, groupBy, safeDivide, sum, uniqueSorted } from './common';

export const NEW_SEAT_GRACE_DAYS = 28;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Assignment {
  assignmentId: string;
  employeeId: string;
  department: string;
  product: string;
  assignedDate: string;
  unassignedDate: string | null;
}

/** One seat-week of telemetry. Null counts mean "not reported" (never zero). */
export interface ActivityRow {
  employeeId: string;
  product: string;
  weekStart: string;
  activeDays: number | null;
  actions: number | null;
}

export interface Eligibility {
  department: string;
  product: string;
  headcount: number;
  eligible: number;
}

export interface Contract {
  product: string;
  seatPriceUsdPerMonth: number;
  committedSeats: number;
  termStart: string;
  renewalDate: string;
  noticeDays: number;
  floorSeatsAtRenewal: number;
}

export type SeatStatus = 'active' | 'inactive' | 'new' | 'unknown';

export interface ObservationWindow {
  weeks: string[];
  start: string;
  /** Last day of the last week (the "as of" date). */
  end: string;
}

export interface SeatRow {
  assignmentId: string;
  employeeId: string;
  department: string;
  product: string;
  assignedDate: string;
  /** "YYYY-MM" of assigned_date. */
  cohort: string;
  status: SeatStatus;
  /** Held weeks in the window with reported telemetry. */
  reportedWeeks: number;
  activeWeeks: number;
  actionsInWindow: number;
  lastActiveWeek: string | null;
  daysHeld: number;
}

// ---------------------------------------------------------------------------
// Window and seats
// ---------------------------------------------------------------------------

/** Last `windowWeeks` distinct telemetry weeks. Null when there is no telemetry. */
export function buildWindow(activity: readonly ActivityRow[], windowWeeks: number): ObservationWindow | null {
  const weeks = uniqueSorted(activity.map((a) => a.weekStart));
  if (weeks.length === 0) return null;
  const chosen = weeks.slice(-Math.max(1, Math.floor(windowWeeks)));
  const first = chosen[0];
  const last = chosen[chosen.length - 1];
  if (first === undefined || last === undefined) return null;
  return { weeks: chosen, start: first, end: addDays(last, 6) };
}

export function heldInWeek(a: Pick<Assignment, 'assignedDate' | 'unassignedDate'>, weekStart: string): boolean {
  return a.assignedDate <= addDays(weekStart, 6) && (a.unassignedDate === null || a.unassignedDate >= weekStart);
}

export function heldOnDate(a: Pick<Assignment, 'assignedDate' | 'unassignedDate'>, date: string): boolean {
  return a.assignedDate <= date && (a.unassignedDate === null || a.unassignedDate >= date);
}

function activityKey(employeeId: string, product: string): string {
  return `${employeeId}|${product}`;
}

/** Classify every seat held on the as-of date. */
export function buildSeats(assignments: readonly Assignment[], activity: readonly ActivityRow[], window: ObservationWindow): SeatRow[] {
  const byKey = groupBy(activity, (a) => activityKey(a.employeeId, a.product));
  const windowWeeks = new Set(window.weeks);
  const seats: SeatRow[] = [];

  for (const a of assignments) {
    if (!heldOnDate(a, window.end)) continue;
    const rows = (byKey.get(activityKey(a.employeeId, a.product)) ?? []).filter((r) => windowWeeks.has(r.weekStart) && heldInWeek(a, r.weekStart));
    const reported = rows.filter((r) => r.activeDays !== null);
    const activeRows = reported.filter((r) => (r.activeDays ?? 0) > 0);
    const daysHeld = daysBetween(a.assignedDate, window.end);
    const actionsInWindow = sum(rows.map((r) => r.actions ?? 0));
    const lastActive = activeRows.map((r) => r.weekStart).sort().pop() ?? null;

    let status: SeatStatus;
    if (activeRows.length > 0) status = 'active';
    else if (reported.length === 0) status = 'unknown';
    else if (daysHeld < NEW_SEAT_GRACE_DAYS) status = 'new';
    else status = 'inactive';

    seats.push({
      assignmentId: a.assignmentId,
      employeeId: a.employeeId,
      department: a.department,
      product: a.product,
      assignedDate: a.assignedDate,
      cohort: a.assignedDate.slice(0, 7),
      status,
      reportedWeeks: reported.length,
      activeWeeks: activeRows.length,
      actionsInWindow,
      lastActiveWeek: lastActive,
      daysHeld,
    });
  }
  return seats;
}

/** Number of activity rows dated before the seat's assignment (trial use). They are excluded from seat status. */
export function countPreAssignmentActivity(assignments: readonly Assignment[], activity: readonly ActivityRow[]): number {
  const byKey = groupBy(assignments, (a) => activityKey(a.employeeId, a.product));
  let count = 0;
  for (const row of activity) {
    if (row.activeDays === null || row.activeDays === 0) continue;
    const seats = byKey.get(activityKey(row.employeeId, row.product)) ?? [];
    if (seats.length > 0 && seats.every((s) => !heldInWeek(s, row.weekStart))) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface AdoptionFilters {
  department: string | null;
  product: string | null;
}

export const EMPTY_ADOPTION_FILTERS: AdoptionFilters = { department: null, product: null };

export function isAdoptionFiltered(f: AdoptionFilters): boolean {
  return f.department !== null || f.product !== null;
}

export function filterSeats(seats: readonly SeatRow[], f: AdoptionFilters): SeatRow[] {
  return seats.filter((s) => (f.department === null || s.department === f.department) && (f.product === null || s.product === f.product));
}

export function filterEligibility(rows: readonly Eligibility[], f: AdoptionFilters): Eligibility[] {
  return rows.filter((r) => (f.department === null || r.department === f.department) && (f.product === null || r.product === f.product));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface AdoptionSummary {
  eligibleSeats: number;
  assignedSeats: number;
  activeSeats: number;
  inactiveSeats: number;
  newSeats: number;
  unknownSeats: number;
  /** assigned / eligible. Can exceed 1 when seats are held outside the eligibility policy. */
  coverage: number | null;
  /** active / assigned. */
  utilization: number | null;
  /** Seats held in a department-product pair that has zero eligible employees. */
  outsidePolicySeats: number;
  /** assigned seats x seat price x 1 month (USD per month). */
  assignedSeatCostUsdPerMonth: number;
  /** Cost of inactive seats (USD per month). */
  inactiveSeatCostUsdPerMonth: number;
  /** assigned-seat cost / active seats (USD per active seat per month). */
  costPerActiveSeatUsdPerMonth: number | null;
}

export function summarizeAdoption(seats: readonly SeatRow[], eligibility: readonly Eligibility[], contracts: readonly Contract[]): AdoptionSummary {
  const price = new Map(contracts.map((c) => [c.product, c.seatPriceUsdPerMonth]));
  const seatCost = (s: SeatRow) => price.get(s.product) ?? 0;
  const eligibleKeys = new Map(eligibility.map((e) => [`${e.department}|${e.product}`, e.eligible]));

  const active = seats.filter((s) => s.status === 'active');
  const inactive = seats.filter((s) => s.status === 'inactive');
  const eligibleSeats = sum(eligibility.map((e) => e.eligible));
  const assignedCost = sum(seats.map(seatCost));
  return {
    eligibleSeats,
    assignedSeats: seats.length,
    activeSeats: active.length,
    inactiveSeats: inactive.length,
    newSeats: seats.filter((s) => s.status === 'new').length,
    unknownSeats: seats.filter((s) => s.status === 'unknown').length,
    coverage: safeDivide(seats.length, eligibleSeats),
    utilization: safeDivide(active.length, seats.length),
    outsidePolicySeats: seats.filter((s) => (eligibleKeys.get(`${s.department}|${s.product}`) ?? 0) === 0).length,
    assignedSeatCostUsdPerMonth: assignedCost,
    inactiveSeatCostUsdPerMonth: sum(inactive.map(seatCost)),
    costPerActiveSeatUsdPerMonth: safeDivide(assignedCost, active.length),
  };
}

// ---------------------------------------------------------------------------
// Grouped views
// ---------------------------------------------------------------------------

export type AdoptionDimension = 'department' | 'product' | 'cohort';

export interface AdoptionGroup {
  key: string;
  assigned: number;
  active: number;
  inactive: number;
  newSeats: number;
  unknown: number;
  utilization: number | null;
}

export function adoptionByDimension(seats: readonly SeatRow[], dimension: AdoptionDimension): AdoptionGroup[] {
  const groups = [...groupBy(seats, (s) => s[dimension]).entries()].map(([key, rows]) => {
    const active = rows.filter((r) => r.status === 'active').length;
    return {
      key,
      assigned: rows.length,
      active,
      inactive: rows.filter((r) => r.status === 'inactive').length,
      newSeats: rows.filter((r) => r.status === 'new').length,
      unknown: rows.filter((r) => r.status === 'unknown').length,
      utilization: safeDivide(active, rows.length),
    };
  });
  return dimension === 'cohort' ? groups.sort((a, b) => a.key.localeCompare(b.key)) : groups.sort((a, b) => b.assigned - a.assigned);
}

export interface WeeklyAdoptionPoint {
  weekStart: string;
  heldSeats: number;
  /** Held seats with reported telemetry that week (the denominator). */
  reportedSeats: number;
  activeSeats: number;
  /** active / reported (null when the whole week is missing, e.g. a telemetry outage). */
  activeRate: number | null;
}

/** Weekly active rate across ALL telemetry weeks for the filtered assignments (a trend, not the window summary). */
export function weeklyAdoption(assignments: readonly Assignment[], activity: readonly ActivityRow[], f: AdoptionFilters): WeeklyAdoptionPoint[] {
  const scoped = assignments.filter((a) => (f.department === null || a.department === f.department) && (f.product === null || a.product === f.product));
  const rowsByWeek = groupBy(activity, (r) => r.weekStart);
  const lookup = new Map<string, ActivityRow>();
  for (const r of activity) lookup.set(`${activityKey(r.employeeId, r.product)}|${r.weekStart}`, r);

  return uniqueSorted([...rowsByWeek.keys()]).map((weekStart) => {
    let held = 0;
    let reported = 0;
    let active = 0;
    for (const a of scoped) {
      if (!heldInWeek(a, weekStart)) continue;
      held += 1;
      const row = lookup.get(`${activityKey(a.employeeId, a.product)}|${weekStart}`);
      if (row === undefined || row.activeDays === null) continue;
      reported += 1;
      if (row.activeDays > 0) active += 1;
    }
    return { weekStart, heldSeats: held, reportedSeats: reported, activeSeats: active, activeRate: safeDivide(active, reported) };
  });
}

// ---------------------------------------------------------------------------
// Reclaim scenario (an estimate, not realized savings)
// ---------------------------------------------------------------------------

export interface ReclaimParams {
  /** Share (0-1) of inactive seats actually reclaimed after outreach. */
  reclaimShare: number;
  /** Extra seats kept as headroom, as a share (0-1) of remaining seats. */
  bufferShare: number;
}

export const DEFAULT_RECLAIM_PARAMS: ReclaimParams = { reclaimShare: 0.6, bufferShare: 0.05 };

export interface ReclaimEstimate {
  product: string;
  seatPriceUsdPerMonth: number;
  committedSeats: number;
  floorSeatsAtRenewal: number;
  heldSeats: number;
  inactiveSeats: number;
  reclaimedSeats: number;
  /** Committed seats nobody holds today (paid, unassigned). */
  unassignedCommittedSeats: number;
  proposedCommitment: number;
  renewalDate: string;
  noticeDeadline: string;
  /** Days from the as-of date to the notice deadline (negative = deadline already passed). */
  daysToNoticeDeadline: number;
  noticeOpen: boolean;
  /** Annual USD saved by the lower commitment from the renewal date, if notice is given in time. Zero otherwise. */
  annualSavingsUsd: number;
  /** What the same reduction would be worth if notice were still open (shown when the deadline was missed). */
  deferredAnnualSavingsUsd: number;
  /** Eligible employees without a seat, a candidate pool for reassigning reclaimed seats. */
  eligibleWithoutSeat: number;
}

/**
 * Savings come only from lowering the COMMITTED seat count at renewal, never below the contract floor,
 * and only if notice is given before the notice deadline. Reclaiming a seat mid-term saves nothing
 * unless the contract allows reductions (it is assumed not to). Reclaimed seats can alternatively be
 * reassigned to eligible employees without a seat.
 */
export function estimateReclaim(
  seats: readonly SeatRow[],
  eligibility: readonly Eligibility[],
  contracts: readonly Contract[],
  asOf: string,
  params: ReclaimParams,
): ReclaimEstimate[] {
  const reclaimShare = clamp(params.reclaimShare, 0, 1);
  const bufferShare = clamp(params.bufferShare, 0, 1);
  return contracts.map((c) => {
    const productSeats = seats.filter((s) => s.product === c.product);
    const held = productSeats.length;
    const inactive = productSeats.filter((s) => s.status === 'inactive').length;
    const reclaimed = Math.round(inactive * reclaimShare);
    const remaining = held - reclaimed;
    const target = Math.ceil(remaining * (1 + bufferShare));
    const proposed = clamp(Math.max(c.floorSeatsAtRenewal, target), c.floorSeatsAtRenewal, c.committedSeats);
    const noticeDeadline = addDays(c.renewalDate, -c.noticeDays);
    const daysToNotice = daysBetween(asOf, noticeDeadline);
    const noticeOpen = daysToNotice >= 0;
    const potential = (c.committedSeats - proposed) * c.seatPriceUsdPerMonth * 12;
    const eligibleTotal = sum(eligibility.filter((e) => e.product === c.product).map((e) => e.eligible));
    return {
      product: c.product,
      seatPriceUsdPerMonth: c.seatPriceUsdPerMonth,
      committedSeats: c.committedSeats,
      floorSeatsAtRenewal: c.floorSeatsAtRenewal,
      heldSeats: held,
      inactiveSeats: inactive,
      reclaimedSeats: reclaimed,
      unassignedCommittedSeats: Math.max(0, c.committedSeats - held),
      proposedCommitment: proposed,
      renewalDate: c.renewalDate,
      noticeDeadline,
      daysToNoticeDeadline: daysToNotice,
      noticeOpen,
      annualSavingsUsd: noticeOpen ? potential : 0,
      deferredAnnualSavingsUsd: noticeOpen ? 0 : potential,
      eligibleWithoutSeat: Math.max(0, eligibleTotal - held),
    };
  });
}

export function adoptionFilterOptions(seats: readonly SeatRow[], eligibility: readonly Eligibility[]): { departments: string[]; products: string[] } {
  return {
    departments: uniqueSorted([...seats.map((s) => s.department), ...eligibility.map((e) => e.department)]),
    products: uniqueSorted([...seats.map((s) => s.product), ...eligibility.map((e) => e.product)]),
  };
}
