/**
 * AI Adoption & License Utilization: CSV schemas and normalization (the validation boundary).
 * Rows that cannot be used are dropped and counted; blank telemetry stays null and is never read as zero.
 */
import type { ActivityRow, Assignment, Contract, Eligibility } from '@/analysis/adoption';
import { IssueLog, type NormalizeResult } from '@/data/errors';
import { parseCount, parseIsoDate, parseNumber, parseText, requireColumns, requireRows, type RawRow } from '@/data/normalize';
import { utcMs } from '@/lib/dates';

export const ASSIGNMENTS_FILE = 'license_assignments.csv';
export const ACTIVITY_FILE = 'product_activity.csv';
export const ELIGIBILITY_FILE = 'department_eligibility.csv';
export const CONTRACTS_FILE = 'contracts.csv';

export const ASSIGNMENT_COLUMNS = ['assignment_id', 'employee_id', 'department', 'product', 'assigned_date', 'unassigned_date'] as const;
export const ACTIVITY_COLUMNS = ['employee_id', 'product', 'week_start', 'active_days', 'actions'] as const;
export const ELIGIBILITY_COLUMNS = ['department', 'product', 'department_headcount', 'eligible_employees'] as const;
export const CONTRACT_COLUMNS = [
  'product', 'seat_price_usd_per_month', 'committed_seats', 'term_start', 'renewal_date', 'notice_days', 'floor_seats_at_renewal', 'price_basis',
] as const;

export function normalizeAssignments(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<Assignment> {
  requireColumns(ASSIGNMENTS_FILE, headers, ASSIGNMENT_COLUMNS);
  const issues = new IssueLog();
  const rows: Assignment[] = [];
  const seenIds = new Set<string>();
  const seenSeats = new Set<string>();

  raw.forEach((r, index) => {
    const n = index + 1;
    const assignmentId = parseText(r['assignment_id']);
    const employeeId = parseText(r['employee_id']);
    const department = parseText(r['department']);
    const product = parseText(r['product']);
    const assignedDate = parseIsoDate(r['assigned_date']);
    const unassignedRaw = parseText(r['unassigned_date']);
    const unassignedDate = unassignedRaw === null ? null : parseIsoDate(unassignedRaw);

    if (assignmentId === null || employeeId === null || department === null || product === null) {
      return issues.add('missing_field', 'Row dropped: blank assignment_id, employee_id, department, or product', n);
    }
    if (assignedDate === null || (unassignedRaw !== null && unassignedDate === null)) {
      return issues.add('invalid_date', 'Row dropped: assigned_date or unassigned_date is not a valid YYYY-MM-DD date', n);
    }
    if (seenIds.has(assignmentId)) return issues.add('duplicate_assignment_id', 'Row dropped: duplicate assignment_id (first kept)', n);
    if (unassignedDate !== null && unassignedDate < assignedDate) {
      return issues.add('impossible_date_range', 'Row dropped: unassigned_date is before assigned_date', n);
    }
    // The same employee cannot hold the same product seat twice from the same date: overlapping duplicate.
    const seatKey = `${employeeId}|${product}|${assignedDate}`;
    if (seenSeats.has(seatKey)) return issues.add('overlapping_duplicate_seat', 'Row dropped: same employee, product, and assigned_date already present (first kept)', n);

    seenIds.add(assignmentId);
    seenSeats.add(seatKey);
    rows.push({ assignmentId, employeeId, department, product, assignedDate, unassignedDate });
  });

  requireRows(ASSIGNMENTS_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

const isMonday = (iso: string): boolean => new Date(utcMs(iso)).getUTCDay() === 1;

export function normalizeActivity(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<ActivityRow> {
  requireColumns(ACTIVITY_FILE, headers, ACTIVITY_COLUMNS);
  const issues = new IssueLog();
  const rows: ActivityRow[] = [];
  const seen = new Set<string>();

  raw.forEach((r, index) => {
    const n = index + 1;
    const employeeId = parseText(r['employee_id']);
    const product = parseText(r['product']);
    const weekStart = parseIsoDate(r['week_start']);
    if (employeeId === null || product === null) return issues.add('missing_field', 'Row dropped: blank employee_id or product', n);
    if (weekStart === null || !isMonday(weekStart)) return issues.add('invalid_week', 'Row dropped: week_start is not a valid Monday date', n);
    const key = `${employeeId}|${product}|${weekStart}`;
    if (seen.has(key)) return issues.add('duplicate_activity_row', 'Row dropped: duplicate employee, product, and week (first kept)', n);

    const daysRaw = parseText(r['active_days']);
    const actionsRaw = parseText(r['actions']);
    let activeDays: number | null = null;
    let actions: number | null = null;
    if (daysRaw === null && actionsRaw === null) {
      issues.add('blank_telemetry', 'Row kept: telemetry is blank (treated as not reported, never as zero active days)', n);
    } else {
      activeDays = parseCount(daysRaw);
      actions = parseCount(actionsRaw);
      if (activeDays === null || activeDays > 7 || actions === null) {
        return issues.add('invalid_activity_value', 'Row dropped: active_days (0-7) or actions is not a valid whole number', n);
      }
    }
    seen.add(key);
    rows.push({ employeeId, product, weekStart, activeDays, actions });
  });

  requireRows(ACTIVITY_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

export function normalizeEligibility(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<Eligibility> {
  requireColumns(ELIGIBILITY_FILE, headers, ELIGIBILITY_COLUMNS);
  const issues = new IssueLog();
  const rows: Eligibility[] = [];
  raw.forEach((r, index) => {
    const n = index + 1;
    const department = parseText(r['department']);
    const product = parseText(r['product']);
    const headcount = parseCount(r['department_headcount']);
    const eligible = parseCount(r['eligible_employees']);
    if (department === null || product === null || headcount === null || eligible === null) {
      return issues.add('invalid_eligibility_row', 'Row dropped: blank field or invalid count', n);
    }
    if (eligible > headcount) return issues.add('eligible_exceeds_headcount', 'Row dropped: eligible_employees is larger than department_headcount', n);
    rows.push({ department, product, headcount, eligible });
  });
  requireRows(ELIGIBILITY_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}

export function normalizeContracts(headers: readonly string[], raw: readonly RawRow[]): NormalizeResult<Contract> {
  requireColumns(CONTRACTS_FILE, headers, CONTRACT_COLUMNS);
  const issues = new IssueLog();
  const rows: Contract[] = [];
  raw.forEach((r, index) => {
    const n = index + 1;
    const product = parseText(r['product']);
    const price = parseNumber(r['seat_price_usd_per_month']);
    const committed = parseCount(r['committed_seats']);
    const termStart = parseIsoDate(r['term_start']);
    const renewal = parseIsoDate(r['renewal_date']);
    const notice = parseCount(r['notice_days']);
    const floor = parseCount(r['floor_seats_at_renewal']);
    if (product === null || price === null || price < 0 || committed === null || termStart === null || renewal === null || notice === null || floor === null) {
      return issues.add('invalid_contract_row', 'Contract dropped: blank or invalid field', n);
    }
    if (renewal <= termStart) return issues.add('invalid_contract_dates', 'Contract dropped: renewal_date is not after term_start', n);
    if (floor > committed) return issues.add('floor_exceeds_commitment', 'Contract dropped: floor_seats_at_renewal exceeds committed_seats', n);
    rows.push({ product, seatPriceUsdPerMonth: price, committedSeats: committed, termStart, renewalDate: renewal, noticeDays: notice, floorSeatsAtRenewal: floor });
  });
  requireRows(CONTRACTS_FILE, rows);
  return { rows, issues: issues.toArray(), totalRows: raw.length };
}
