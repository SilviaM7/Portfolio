/**
 * Everything the AI Adoption view shows, derived from (dataset, filters, window) in one pure function, so KPIs,
 * charts, and the seat table can never disagree: they all read the same classified, filtered seats.
 *
 * One deliberate exception: the reclaim scenario ignores the department filter. Seat contracts are company-wide
 * (one committed count per product), so a department slice of a contract has no renewal terms of its own.
 */
import {
  adoptionByDimension,
  adoptionFilterOptions,
  buildSeats,
  buildWindow,
  countPreAssignmentActivity,
  estimateReclaim,
  filterEligibility,
  filterSeats,
  summarizeAdoption,
  weeklyAdoption,
  type AdoptionFilters,
  type AdoptionGroup,
  type AdoptionSummary,
  type ObservationWindow,
  type ReclaimEstimate,
  type ReclaimParams,
  type SeatRow,
  type WeeklyAdoptionPoint,
} from '@/analysis/adoption';
import { uniqueSorted } from '@/analysis/common';
import type { AdoptionDataset } from './load';

export interface AdoptionViewFilters extends AdoptionFilters {
  /** Number of most recent telemetry weeks in the observation window. */
  windowWeeks: number;
}

export interface AdoptionViewModel {
  window: ObservationWindow;
  /** Seats held on the as-of date that match the department and product filters. */
  seats: SeatRow[];
  /** Seats held on the as-of date before filtering (for "x of y" text). */
  allSeatCount: number;
  summary: AdoptionSummary;
  byDepartment: AdoptionGroup[];
  byProduct: AdoptionGroup[];
  byCohort: AdoptionGroup[];
  /** Weekly active rate over all telemetry weeks for the filtered assignments. */
  weekly: WeeklyAdoptionPoint[];
  /** One row per contract matching the product filter (department filter not applied, see file comment). */
  reclaim: ReclaimEstimate[];
  options: { departments: string[]; products: string[] };
  /** Distinct telemetry weeks in the data (upper bound for the window selector). */
  availableWeeks: number;
  /** Activity rows dated before the seat was assigned (trial use), excluded from seat status. */
  preAssignmentActivityRows: number;
}

/** Window lengths offered to visitors, limited to what the telemetry covers. */
export function windowChoices(availableWeeks: number): number[] {
  const choices = [4, 8, 12].filter((w) => w <= availableWeeks);
  if (availableWeeks > 0 && !choices.includes(availableWeeks)) choices.push(availableWeeks);
  return choices;
}

/** Null when there is no telemetry at all (the view shows an explanatory empty state). */
export function buildAdoptionView(data: AdoptionDataset, filters: AdoptionViewFilters, reclaimParams: ReclaimParams): AdoptionViewModel | null {
  const window = buildWindow(data.activity, filters.windowWeeks);
  if (window === null) return null;
  const allSeats = buildSeats(data.assignments, data.activity, window);
  const seats = filterSeats(allSeats, filters);
  const productOnly: AdoptionFilters = { department: null, product: filters.product };
  const reclaim = estimateReclaim(filterSeats(allSeats, productOnly), filterEligibility(data.eligibility, productOnly), data.contracts, window.end, reclaimParams).filter(
    (r) => filters.product === null || r.product === filters.product,
  );

  return {
    window,
    seats,
    allSeatCount: allSeats.length,
    summary: summarizeAdoption(seats, filterEligibility(data.eligibility, filters), data.contracts),
    byDepartment: adoptionByDimension(seats, 'department'),
    byProduct: adoptionByDimension(seats, 'product'),
    byCohort: adoptionByDimension(seats, 'cohort'),
    weekly: weeklyAdoption(data.assignments, data.activity, filters),
    reclaim,
    options: adoptionFilterOptions(allSeats, data.eligibility),
    availableWeeks: uniqueSorted(data.activity.map((a) => a.weekStart)).length,
    preAssignmentActivityRows: countPreAssignmentActivity(data.assignments, data.activity),
  };
}
