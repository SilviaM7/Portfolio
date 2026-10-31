import type { FileReport } from '@/data/dataset';

/** What validation found in each CSV: rows read/used, dropped or flagged rows by cause, and parser warnings. */
export function QualityPanel({ reports, notes }: { reports: readonly FileReport[]; notes: readonly string[] }) {
  return (
    <div className="space-y-6">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      {reports.map((report) => (
        <div key={report.fileName}>
          <h3 className="font-medium">
            {report.fileName}: {report.rowsRead.toLocaleString('en-US')} rows read, {report.rowsUsed.toLocaleString('en-US')} used
          </h3>
          {report.issues.length === 0 && report.warnings.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No validation issues found.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {report.issues.map((issue) => (
                <li key={issue.code}>
                  <strong>{issue.count}×</strong> {issue.message} <span className="text-muted-foreground">(for example data rows {issue.sampleRows.join(', ')})</span>
                </li>
              ))}
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
