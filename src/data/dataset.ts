import type { DataIssue, NormalizeResult } from './errors';
import { fetchCsv, type ParsedCsv } from './csv';

/** What happened to one CSV file while loading, shown in the data-quality panel. */
export interface FileReport {
  fileName: string;
  rowsRead: number;
  rowsUsed: number;
  issues: DataIssue[];
  /** Parser-level warnings, e.g. rows with the wrong number of fields. */
  warnings: string[];
}

export function reportFor<T>(fileName: string, result: NormalizeResult<T>, parsed: ParsedCsv): FileReport {
  return { fileName, rowsRead: result.totalRows, rowsUsed: result.rows.length, issues: result.issues, warnings: parsed.warnings };
}

/** Download several bundled CSVs together; the first failure rejects with a visitor-friendly DataError. */
export function fetchAll(paths: readonly string[], signal?: AbortSignal): Promise<ParsedCsv[]> {
  return Promise.all(paths.map((path) => fetchCsv(path, signal)));
}
