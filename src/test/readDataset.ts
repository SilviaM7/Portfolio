/**
 * Test-only helper: reads a bundled CSV from public/data using a deliberately tiny RFC 4180 parser.
 * The app itself parses with Papa Parse (src/data/csv.ts). Tests use this instead so the calculation
 * and normalization tests run on Node alone and stay independent of the production parser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RawRow } from '@/data/normalize';

export interface TestCsv {
  headers: string[];
  rows: RawRow[];
}

export function parseCsvForTest(text: string): TestCsv {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      field = '';
      if (record.length > 1 || record[0] !== '') records.push(record);
      record = [];
    } else field += ch;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const headers = records[0] ?? [];
  const rows = records.slice(1).map((values) => {
    const row: RawRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
  return { headers, rows };
}

/** Read e.g. readDataset("ai-spend/usage_events.csv"). */
export function readDataset(relativePath: string): TestCsv {
  const url = new URL(`../../public/data/${relativePath}`, import.meta.url);
  return parseCsvForTest(readFileSync(fileURLToPath(url), 'utf8'));
}
