/** Raised at data boundaries (CSV/API) when input cannot be used. `details` are shown to the visitor. */
export class DataError extends Error {
  readonly details: readonly string[];

  constructor(message: string, details: readonly string[] = []) {
    super(message);
    this.name = 'DataError';
    this.details = details;
  }
}

/** A class of problem found while normalizing a dataset, with a few example row numbers. */
export interface DataIssue {
  code: string;
  message: string;
  count: number;
  /** 1-based data-row numbers (header excluded), capped for display. */
  sampleRows: number[];
}

/** Collects counts of data problems by code while rows are normalized. */
export class IssueLog {
  private readonly entries = new Map<string, DataIssue>();

  add(code: string, message: string, rowNumber: number): void {
    const existing = this.entries.get(code);
    if (existing) {
      existing.count += 1;
      if (existing.sampleRows.length < 5) existing.sampleRows.push(rowNumber);
    } else {
      this.entries.set(code, { code, message, count: 1, sampleRows: [rowNumber] });
    }
  }

  toArray(): DataIssue[] {
    return [...this.entries.values()].sort((a, b) => b.count - a.count);
  }
}

/** Result of normalizing one CSV: clean rows plus what was dropped or flagged. */
export interface NormalizeResult<T> {
  rows: T[];
  issues: DataIssue[];
  /** Rows read from the file (excluding the header). */
  totalRows: number;
}
