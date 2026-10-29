import type { ActivityRow, Assignment, Contract, Eligibility } from '@/analysis/adoption';
import { fetchAll, reportFor, type FileReport } from '@/data/dataset';
import {
  ACTIVITY_FILE,
  ASSIGNMENTS_FILE,
  CONTRACTS_FILE,
  ELIGIBILITY_FILE,
  normalizeActivity,
  normalizeAssignments,
  normalizeContracts,
  normalizeEligibility,
} from './schema';

export const ADOPTION_DIR = 'data/ai-adoption';

export interface AdoptionDataset {
  assignments: Assignment[];
  activity: ActivityRow[];
  eligibility: Eligibility[];
  contracts: Contract[];
  reports: FileReport[];
}

export async function loadAdoptionDataset(signal?: AbortSignal): Promise<AdoptionDataset> {
  const files = [ASSIGNMENTS_FILE, ACTIVITY_FILE, ELIGIBILITY_FILE, CONTRACTS_FILE];
  const [assignmentsCsv, activityCsv, eligibilityCsv, contractsCsv] = await fetchAll(files.map((f) => `${ADOPTION_DIR}/${f}`), signal);
  if (assignmentsCsv === undefined || activityCsv === undefined || eligibilityCsv === undefined || contractsCsv === undefined) {
    throw new Error('Dataset download returned fewer files than requested.');
  }
  const assignments = normalizeAssignments(assignmentsCsv.headers, assignmentsCsv.rows);
  const activity = normalizeActivity(activityCsv.headers, activityCsv.rows);
  const eligibility = normalizeEligibility(eligibilityCsv.headers, eligibilityCsv.rows);
  const contracts = normalizeContracts(contractsCsv.headers, contractsCsv.rows);
  return {
    assignments: assignments.rows,
    activity: activity.rows,
    eligibility: eligibility.rows,
    contracts: contracts.rows,
    reports: [
      reportFor(ASSIGNMENTS_FILE, assignments, assignmentsCsv),
      reportFor(ACTIVITY_FILE, activity, activityCsv),
      reportFor(ELIGIBILITY_FILE, eligibility, eligibilityCsv),
      reportFor(CONTRACTS_FILE, contracts, contractsCsv),
    ],
  };
}
