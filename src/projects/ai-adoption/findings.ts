/** Written findings for AI Adoption & License Utilization. Computed from the FULL dataset and the default observation window. */
import {
  adoptionByDimension,
  buildSeats,
  buildWindow,
  DEFAULT_RECLAIM_PARAMS,
  estimateReclaim,
  summarizeAdoption,
  type SeatRow,
  type ObservationWindow,
} from '@/analysis/adoption';
import { formatDate } from '@/lib/dates';
import { formatInteger, formatPercent, formatUsd, formatUsdCents } from '@/lib/format';
import type { Finding } from '../findings';
import type { AdoptionDataset } from './load';

export const DEFAULT_WINDOW_WEEKS = 8;

export function defaultSeats(data: AdoptionDataset, windowWeeks = DEFAULT_WINDOW_WEEKS): { window: ObservationWindow; seats: SeatRow[] } | null {
  const window = buildWindow(data.activity, windowWeeks);
  if (window === null) return null;
  return { window, seats: buildSeats(data.assignments, data.activity, window) };
}

export function buildAdoptionFindings(data: AdoptionDataset): Finding[] {
  const built = defaultSeats(data);
  if (built === null) return [];
  const { window, seats } = built;
  const summary = summarizeAdoption(seats, data.eligibility, data.contracts);
  const out: Finding[] = [];
  const windowText = `${formatDate(window.start)}–${formatDate(window.end)}`;

  out.push({
    kind: 'observed',
    title: 'Seat utilization in the observation window',
    text: `Full dataset, ${windowText} (${window.weeks.length}-week window): ${formatInteger(summary.assignedSeats)} seats held, ${formatInteger(summary.activeSeats)} active (${formatPercent(summary.utilization)} utilization), ${formatInteger(summary.inactiveSeats)} inactive. Inactive seats cost ${formatUsd(summary.inactiveSeatCostUsdPerMonth)} per month at list seat prices (fictional). Cost per active seat is ${formatUsdCents(summary.costPerActiveSeatUsdPerMonth)} per month versus the list price, because inactive seats are paid for too.`,
  });

  const cohorts = adoptionByDimension(seats, 'cohort').filter((c) => c.assigned >= 20);
  const lowestCohorts = [...cohorts].sort((a, b) => (a.utilization ?? 1) - (b.utilization ?? 1)).slice(0, 2);
  if (lowestCohorts.length === 2) {
    out.push({
      kind: 'observed',
      title: 'Utilization differs by assignment cohort',
      text: `The lowest-utilization cohorts (20+ seats) are those assigned in ${lowestCohorts.map((c) => `${c.key} (${formatPercent(c.utilization)} of ${c.assigned} seats active)`).join(' and ')}. In this dataset these are bulk assignment waves. The data shows association only: it cannot show whether enablement, role fit, or something else explains the gap.`,
    });
  }

  const departments = adoptionByDimension(seats, 'department').filter((d) => d.assigned >= 10);
  const lowestDept = [...departments].sort((a, b) => (a.utilization ?? 1) - (b.utilization ?? 1))[0];
  if (lowestDept !== undefined) {
    out.push({
      kind: 'observed',
      title: 'Departments differ in adoption',
      text: `${lowestDept.key} has the lowest utilization among departments with 10+ seats (${formatPercent(lowestDept.utilization)} of ${lowestDept.assigned} seats). ${summary.outsidePolicySeats > 0 ? `${summary.outsidePolicySeats} seats sit in department–product pairs with no eligible employees, a governance question rather than an adoption one.` : ''}`.trim(),
    });
  }

  const estimates = estimateReclaim(seats, data.eligibility, data.contracts, window.end, DEFAULT_RECLAIM_PARAMS);
  const open = estimates.filter((e) => e.noticeOpen && e.annualSavingsUsd > 0);
  const missed = estimates.filter((e) => !e.noticeOpen && e.deferredAnnualSavingsUsd > 0);
  const openTotal = open.reduce((n, e) => n + e.annualSavingsUsd, 0);
  out.push({
    kind: 'scenario',
    title: 'Reclaim scenario depends on contract terms',
    text: `With default assumptions (${formatPercent(DEFAULT_RECLAIM_PARAMS.reclaimShare, 0)} of inactive seats reclaimed, ${formatPercent(DEFAULT_RECLAIM_PARAMS.bufferShare, 0)} headroom): estimated annual savings of ${formatUsd(openTotal)} are available only where notice can still be given${open.length > 0 ? ` (${open.map((e) => `${e.product}: notice by ${formatDate(e.noticeDeadline)}`).join('; ')})` : ''}. ${missed.length > 0 ? `${missed.map((e) => `${e.product} (notice deadline ${formatDate(e.noticeDeadline)} has passed)`).join('; ')}: reductions would wait for the next term, so the ${formatUsd(missed.reduce((n, e) => n + e.deferredAnnualSavingsUsd, 0))} per year is deferred, not available now. ` : ''}Savings never go below each contract's seat floor, and nothing is realized until the renewal takes effect.`,
  });

  out.push({
    kind: 'recommendation',
    title: 'What to do next',
    text: [
      '1. Before reclaiming, ask the managers of inactive seats whether the seat serves an occasional but important task; activity is not value.',
      '2. Target enablement (training, use-case examples) at the lowest-utilization cohorts and departments before assigning new seats there.',
      '3. Prioritize the renewals whose notice deadline is still open; decide the seat count before the deadline, not after.',
      '4. Review seats held outside the eligibility policy, and reassign reclaimed seats to eligible employees without one before buying more.',
    ].join(' '),
  });
  return out;
}
