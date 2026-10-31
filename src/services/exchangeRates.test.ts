import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataError } from '@/data/errors';
import { CACHE_KEY, createLiveDataClient, LiveDataError, parseRateResponse, QUOTE_CURRENCIES, type LiveDataClientOptions } from './exchangeRates';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake fetch that records calls and answers like the provider's single-pair endpoint. */
function fakeFetch(handler: (url: string, signal: AbortSignal | undefined) => Promise<Response>) {
  const calls: string[] = [];
  const fn = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init?.signal ?? undefined);
  }) as typeof fetch;
  return { fn, calls };
}

const okHandler = async (url: string) => json({ date: '2026-09-25', base: 'USD', quote: url.split('/').pop(), rate: 0.9 });

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function client(overrides: LiveDataClientOptions & { handler?: Parameters<typeof fakeFetch>[0] } = {}) {
  const { handler = okHandler, ...rest } = overrides;
  const f = fakeFetch(handler);
  return { ...f, client: createLiveDataClient({ fetchFn: f.fn, timeoutMs: 1000, ...rest }) };
}

describe('parseRateResponse (validate before display)', () => {
  it('accepts a positive numeric rate and an optional ISO date', () => {
    assert.deepEqual(parseRateResponse({ rate: 0.92, date: '2026-09-25' }, 'EUR'), { quote: 'EUR', rate: 0.92, date: '2026-09-25' });
    assert.equal(parseRateResponse({ rate: 150.2 }, 'JPY').date, null);
  });
  it('rejects missing, non-numeric, non-positive, non-finite, or absurd rates', () => {
    for (const bad of [{}, { rate: '0.9' }, { rate: 0 }, { rate: -1 }, { rate: null }, { rate: Number.NaN }, { rate: 1e9 }]) {
      assert.throws(() => parseRateResponse(bad, 'EUR'), DataError, JSON.stringify(bad));
    }
  });
  it('rejects non-objects and malformed dates', () => {
    for (const bad of [null, 'text', 5, [1], undefined]) assert.throws(() => parseRateResponse(bad, 'EUR'), DataError);
    assert.throws(() => parseRateResponse({ rate: 1, date: '25/09/2026' }, 'EUR'), DataError);
    assert.throws(() => parseRateResponse({ rate: 1, date: 20260925 }, 'EUR'), DataError);
  });
});

describe('createLiveDataClient', () => {
  it('requests each currency pair over HTTPS and builds a timestamped snapshot', async () => {
    const { client: c, calls } = client({ now: () => Date.parse('2026-10-01T12:00:00Z') });
    const result = await c.load();
    assert.equal(result.fromCache, false);
    assert.equal(result.snapshot.fetchedAt, '2026-10-01T12:00:00.000Z');
    assert.deepEqual(result.snapshot.rates.map((r) => r.quote), [...QUOTE_CURRENCIES]);
    assert.equal(calls.length, QUOTE_CURRENCIES.length);
    assert.ok(calls.every((u) => u.startsWith('https://')));
  });

  it('protects against duplicate requests: concurrent loads share one in-flight request', async () => {
    const { client: c, calls } = client();
    const [a, b] = await Promise.all([c.load(), c.load()]);
    assert.equal(a, b);
    assert.equal(calls.length, QUOTE_CURRENCIES.length);
    assert.equal(c.isLoading(), false);
  });

  it('serves a fresh cached copy without a network call, and refresh bypasses the cache', async () => {
    const storage = new MemoryStorage();
    let t = Date.parse('2026-10-01T12:00:00Z');
    const { client: c, calls } = client({ storage, now: () => t, ttlMs: 60_000 });
    await c.load();
    t += 30_000;
    const cached = await c.load();
    assert.equal(cached.fromCache, true);
    assert.equal(calls.length, QUOTE_CURRENCIES.length);
    const refreshed = await c.load({ forceRefresh: true });
    assert.equal(refreshed.fromCache, false);
    assert.equal(calls.length, QUOTE_CURRENCIES.length * 2);
  });

  it('does not use an expired or corrupted cache', async () => {
    const storage = new MemoryStorage();
    let t = Date.parse('2026-10-01T12:00:00Z');
    const { client: c, calls } = client({ storage, now: () => t, ttlMs: 1000 });
    await c.load();
    t += 5000;
    assert.equal((await c.load()).fromCache, false);
    storage.setItem(CACHE_KEY, '{not json');
    assert.equal((await c.load()).fromCache, false);
    storage.setItem(CACHE_KEY, JSON.stringify({ base: 'USD', fetchedAt: 'nonsense', rates: [] }));
    assert.equal((await c.load()).fromCache, false);
    assert.equal(calls.length, QUOTE_CURRENCIES.length * 4); // first load, expired reload, corrupted reload, invalid-snapshot reload
  });

  it('reports HTTP errors with a clear kind', async () => {
    const { client: c } = client({ handler: async () => json({ message: 'nope' }, 503) });
    await assert.rejects(c.load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'http' && /503/.test(e.message));
  });

  it('reports network failures (including CORS blocks) as network errors', async () => {
    const { client: c } = client({ handler: async () => Promise.reject(new TypeError('Failed to fetch')) });
    await assert.rejects(c.load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'network');
  });

  it('reports invalid payloads instead of displaying them', async () => {
    const { client: c } = client({ handler: async () => json({ rate: 'high' }) });
    await assert.rejects(c.load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'invalid');
    const { client: d } = client({ handler: async () => new Response('<html>', { status: 200 }) });
    await assert.rejects(d.load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'invalid');
  });

  it('fails the whole load if any pair fails, so partial data is never shown as complete', async () => {
    const { client: c } = client({ handler: async (url) => (url.endsWith('/JPY') ? json({}, 500) : okHandler(url)) });
    await assert.rejects(c.load(), LiveDataError);
  });

  it('times out a stalled request and aborts it', async () => {
    let aborted = false;
    const { client: c } = client({
      timeoutMs: 25,
      handler: (_url, signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    });
    await assert.rejects(c.load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'timeout');
    assert.equal(aborted, true);
    assert.equal(c.isLoading(), false);
  });

  it('cancels an in-flight request on demand', async () => {
    const { client: c } = client({
      handler: (_url, signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    });
    const pending = c.load();
    c.cancel();
    await assert.rejects(pending, (e: unknown) => e instanceof LiveDataError && e.kind === 'cancelled');
  });

  it('allows a retry after a failure (no stuck loading state)', async () => {
    let fail = true;
    const { client: c } = client({ handler: async (url) => (fail ? json({}, 500) : okHandler(url)) });
    await assert.rejects(c.load(), LiveDataError);
    fail = false;
    assert.equal((await c.load()).snapshot.rates.length, QUOTE_CURRENCIES.length);
  });

  it('does not send credentials or secrets with the request', async () => {
    const seen: RequestInit[] = [];
    const fn = ((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init) seen.push(init);
      return Promise.resolve(json({ rate: 1 }));
    }) as typeof fetch;
    await createLiveDataClient({ fetchFn: fn }).load();
    assert.ok(seen.length > 0);
    assert.ok(seen.every((i) => i.credentials === 'omit' && !('Authorization' in (i.headers as Record<string, string>))));
  });
});

describe('real provider response (captured 2026-10-31 in a browser)', () => {
  it('parses the exact body returned by GET /v2/rate/USD/EUR', () => {
    const body: unknown = JSON.parse('{"base":"USD","date":"2026-10-31","quote":"EUR","rate":0.89485}');
    assert.deepEqual(parseRateResponse(body, 'EUR'), { quote: 'EUR', rate: 0.89485, date: '2026-10-31' });
  });

  it('treats the provider error body for an unknown currency (HTTP 422) as an http error, not data', async () => {
    const fn = (async () => new Response('{"status":422,"message":"invalid currency: XXX"}', { status: 422, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    await assert.rejects(createLiveDataClient({ fetchFn: fn }).load(), (e: unknown) => e instanceof LiveDataError && e.kind === 'http');
  });
});
