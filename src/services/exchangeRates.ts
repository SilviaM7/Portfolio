/**
 * On-demand "Live data" service. This is the ONLY module that knows which provider is used, so replacing the
 * provider means editing this file (and its test) only.
 *
 * Provider: Frankfurter (https://frankfurter.dev). Public HTTPS API, no API key. Reference exchange rates
 * compiled from official sources (originally the European Central Bank), updated daily.
 * Endpoint used: GET https://api.frankfurter.dev/v2/rate/USD/{QUOTE}  -> JSON with a numeric `rate`.
 *
 * Verified from the provider's documentation: base URL, the single-pair endpoint, the `rate` field, no key required.
 * NOT verified from this build environment: browser CORS behavior and the full response body (only `rate` is relied on;
 * `date` is read when present). A failure for any reason is shown honestly to the visitor. See README "Live data".
 *
 * Security: no secrets here, and none may be added. Frontend code and VITE_* variables are public.
 */
import { DataError } from '@/data/errors';

export const PROVIDER = {
  name: 'Frankfurter',
  url: 'https://frankfurter.dev',
  baseUrl: 'https://api.frankfurter.dev',
  description: 'Reference exchange rates compiled from official sources, updated daily on business days.',
} as const;

export const BASE_CURRENCY = 'USD';
export const QUOTE_CURRENCIES = ['EUR', 'GBP', 'JPY'] as const;
export const CACHE_KEY = 'portfolio-live-rates-v1';
export const DEFAULT_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_TIMEOUT_MS = 8000;

export interface LiveRate {
  quote: string;
  /** Units of the quote currency per 1 USD. */
  rate: number;
  /** Rate date as reported by the provider (YYYY-MM-DD), or null if the response did not include one. */
  date: string | null;
}

export interface LiveSnapshot {
  base: typeof BASE_CURRENCY;
  rates: LiveRate[];
  /** When this browser received the data (ISO timestamp). */
  fetchedAt: string;
}

export type LiveErrorKind = 'timeout' | 'network' | 'http' | 'invalid' | 'cancelled';

export class LiveDataError extends Error {
  readonly kind: LiveErrorKind;
  constructor(kind: LiveErrorKind, message: string) {
    super(message);
    this.name = 'LiveDataError';
    this.kind = kind;
  }
}

/** Validate one provider response. Throws DataError when it is not what we expect. */
export function parseRateResponse(body: unknown, quote: string): LiveRate {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new DataError(`Unexpected response for ${quote}: not a JSON object.`);
  const record = body as Record<string, unknown>;
  const rate = record['rate'];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
    throw new DataError(`Unexpected response for ${quote}: "rate" is missing or not a plausible positive number.`);
  }
  const rawDate = record['date'];
  let date: string | null = null;
  if (rawDate !== undefined) {
    if (typeof rawDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) throw new DataError(`Unexpected response for ${quote}: "date" is not a YYYY-MM-DD string.`);
    date = rawDate;
  }
  return { quote, rate, date };
}

export interface LiveDataClientOptions {
  fetchFn?: typeof fetch;
  /** sessionStorage-like object. Omit to disable caching. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
  timeoutMs?: number;
  ttlMs?: number;
}

export interface LoadResult {
  snapshot: LiveSnapshot;
  /** True when served from this session's cache without a network request. */
  fromCache: boolean;
}

function isSnapshot(value: unknown): value is LiveSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['base'] !== BASE_CURRENCY || typeof v['fetchedAt'] !== 'string' || Number.isNaN(Date.parse(v['fetchedAt'])) || !Array.isArray(v['rates'])) return false;
  return v['rates'].every((r) => {
    if (typeof r !== 'object' || r === null) return false;
    const rr = r as Record<string, unknown>;
    return typeof rr['quote'] === 'string' && typeof rr['rate'] === 'number' && Number.isFinite(rr['rate']) && (rr['date'] === null || typeof rr['date'] === 'string');
  });
}

export interface LiveDataClient {
  /** Fetch (or serve a fresh cached copy). Concurrent calls share ONE in-flight request. */
  load(options?: { forceRefresh?: boolean }): Promise<LoadResult>;
  /** Abort the in-flight request, if any. */
  cancel(): void;
  isLoading(): boolean;
}

export function createLiveDataClient(options: LiveDataClientOptions = {}): LiveDataClient {
  const fetchFn = options.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const storage = options.storage ?? null;
  const now = options.now ?? (() => Date.now());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  let inFlight: Promise<LoadResult> | null = null;
  let controller: AbortController | null = null;
  /** True when the current request was aborted by the timeout rather than by cancel(). */
  let timedOut = false;

  function readCache(): LiveSnapshot | null {
    if (storage === null) return null;
    try {
      const text = storage.getItem(CACHE_KEY);
      if (text === null) return null;
      const parsed: unknown = JSON.parse(text);
      if (!isSnapshot(parsed)) return null;
      const age = now() - Date.parse(parsed.fetchedAt);
      return age >= 0 && age <= ttlMs ? parsed : null;
    } catch {
      return null; // unreadable or corrupted cache is ignored, never trusted
    }
  }

  function writeCache(snapshot: LiveSnapshot): void {
    if (storage === null) return;
    try {
      storage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      /* caching is best-effort */
    }
  }

  async function fetchQuote(quote: string, signal: AbortSignal): Promise<LiveRate> {
    let response: Response;
    try {
      response = await fetchFn(`${PROVIDER.baseUrl}/v2/rate/${BASE_CURRENCY}/${quote}`, { signal, headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store' });
    } catch {
      if (signal.aborted) throw new LiveDataError(timedOut ? 'timeout' : 'cancelled', timedOut ? `No response within ${Math.round(timeoutMs / 1000)} seconds.` : 'Request cancelled.');
      throw new LiveDataError('network', `Could not reach ${PROVIDER.name}. This can be a network problem or the provider blocking browser requests (CORS).`);
    }
    if (!response.ok) throw new LiveDataError('http', `${PROVIDER.name} answered with HTTP ${response.status}.`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LiveDataError('invalid', `${PROVIDER.name} returned a response that is not valid JSON.`);
    }
    try {
      return parseRateResponse(body, quote);
    } catch (error) {
      throw new LiveDataError('invalid', error instanceof DataError ? error.message : 'Unexpected response format.');
    }
  }

  async function request(): Promise<LoadResult> {
    const own = new AbortController();
    controller = own;
    timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      own.abort();
    }, timeoutMs);
    try {
      const rates = await Promise.all(QUOTE_CURRENCIES.map((q) => fetchQuote(q, own.signal)));
      const snapshot: LiveSnapshot = { base: BASE_CURRENCY, rates, fetchedAt: new Date(now()).toISOString() };
      writeCache(snapshot);
      return { snapshot, fromCache: false };
    } catch (error) {
      // One failed pair fails the whole load, so partial data is never shown as complete.
      own.abort();
      throw error;
    } finally {
      clearTimeout(timer);
      if (controller === own) controller = null;
    }
  }

  return {
    load({ forceRefresh = false } = {}) {
      if (inFlight !== null) return inFlight;
      if (!forceRefresh) {
        const cached = readCache();
        if (cached !== null) return Promise.resolve({ snapshot: cached, fromCache: true });
      }
      const promise = request().finally(() => {
        inFlight = null;
      });
      inFlight = promise;
      return promise;
    },
    cancel() {
      controller?.abort();
    },
    isLoading() {
      return inFlight !== null;
    },
  };
}
