import type { WorkflowAssumptions, WorkflowRecord } from '@/analysis/workflow';
import { fetchAll, reportFor, type FileReport } from '@/data/dataset';
import { ASSUMPTIONS_FILE, normalizeAssumptions, normalizeWorkflowRecords, RECORDS_FILE } from './schema';

export const WORKFLOW_DIR = 'data/ai-workflow';

export interface WorkflowDataset {
  records: WorkflowRecord[];
  assumptions: WorkflowAssumptions;
  reports: FileReport[];
}

export async function loadWorkflowDataset(signal?: AbortSignal): Promise<WorkflowDataset> {
  const [recordsCsv, assumptionsCsv] = await fetchAll([`${WORKFLOW_DIR}/${RECORDS_FILE}`, `${WORKFLOW_DIR}/${ASSUMPTIONS_FILE}`], signal);
  if (recordsCsv === undefined || assumptionsCsv === undefined) throw new Error('Dataset download returned fewer files than requested.');
  const records = normalizeWorkflowRecords(recordsCsv.headers, recordsCsv.rows);
  const assumptions = normalizeAssumptions(assumptionsCsv.headers, assumptionsCsv.rows);
  return {
    records: records.rows,
    assumptions,
    reports: [
      reportFor(RECORDS_FILE, records, recordsCsv),
      { fileName: ASSUMPTIONS_FILE, rowsRead: assumptionsCsv.rows.length, rowsUsed: assumptionsCsv.rows.length, issues: [], warnings: assumptionsCsv.warnings },
    ],
  };
}
