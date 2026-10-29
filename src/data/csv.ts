import Papa from 'papaparse';
import { assetUrl } from '@/lib/url';
import { DataError } from './errors';
import type { RawRow } from './normalize';

export interface ParsedCsv {
  fileName: string;
  headers: string[];
  rows: RawRow[];
  /** Human-readable parse problems (for example lines with the wrong number of fields). */
  warnings: string[];
}

/** Parse CSV text. Pure and synchronous; the network is not involved. */
export function parseCsvText(text: string, fileName: string): ParsedCsv {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const fatal = result.errors.filter((e) => e.type === 'Quotes' || e.type === 'Delimiter');
  if (fatal.length > 0) {
    throw new DataError(`${fileName} is not valid CSV.`, fatal.slice(0, 3).map((e) => `${e.message} (row ${(e.row ?? 0) + 1})`));
  }
  const fieldErrors = result.errors.filter((e) => e.type === 'FieldMismatch');
  const warnings = fieldErrors.length > 0 ? [`${fieldErrors.length} line(s) in ${fileName} have the wrong number of fields.`] : [];

  return { fileName, headers: result.meta.fields ?? [], rows: result.data, warnings };
}

/**
 * Download and parse a bundled CSV from /public. `path` is relative to the site base,
 * e.g. "data/ai-spend/usage_events.csv". Throws DataError with a visitor-friendly message on failure.
 */
export async function fetchCsv(path: string, signal?: AbortSignal): Promise<ParsedCsv> {
  const fileName = path.split('/').pop() ?? path;
  let response: Response;
  try {
    response = await fetch(assetUrl(path), { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new DataError(`Could not download ${fileName}.`, ['Check your connection and reload the page.']);
  }
  if (!response.ok) {
    throw new DataError(`Could not download ${fileName} (HTTP ${response.status}).`, [
      'The dataset file may be missing from the deployed site. Confirm it exists under public/data/.',
    ]);
  }
  const text = await response.text();
  if (text.trim() === '') throw new DataError(`${fileName} is empty.`);
  return parseCsvText(text, fileName);
}
