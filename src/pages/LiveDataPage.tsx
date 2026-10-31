/**
 * Live-data demonstration: current reference exchange rates, fetched only when the visitor presses the button.
 * Kept separate from the synthetic project data: nothing here changes any project figure.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { Page, Section } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/dates';
import { BASE_CURRENCY, createLiveDataClient, DEFAULT_TTL_MS, LiveDataError, PROVIDER, QUOTE_CURRENCIES, type LoadResult } from '@/services/exchangeRates';
import { safeHttpsUrl } from '@/lib/url';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'success'; result: LoadResult } | { status: 'error'; message: string; kind: string };

const CURRENCY_NAMES: Record<string, string> = { EUR: 'Euro', GBP: 'British pound', JPY: 'Japanese yen' };

/** sessionStorage can be unavailable (privacy modes) or throw; caching is then simply skipped. */
function sessionStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    const s = window.sessionStorage;
    s.getItem('portfolio-storage-probe');
    return s;
  } catch {
    return null;
  }
}

function errorHelp(kind: string): string {
  switch (kind) {
    case 'timeout':
      return 'The provider did not answer in time. It may be busy; try again in a moment.';
    case 'network':
      return 'Your browser could not reach the provider. Check your connection, or the provider may be down or blocking this request.';
    case 'http':
      return 'The provider answered with an error. It may be rate-limiting requests; wait a little before retrying.';
    case 'invalid':
      return 'The provider answered, but not in the expected format, so no figures are shown rather than possibly wrong ones.';
    default:
      return 'The request did not complete.';
  }
}

function formatRate(rate: number): string {
  return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: rate >= 100 ? 2 : 5 });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function LiveDataPage() {
  const client = useMemo(() => createLiveDataClient({ storage: sessionStore() }), []);
  const [state, setState] = useState<State>({ status: 'idle' });
  useEffect(() => () => client.cancel(), [client]);

  const load = async (forceRefresh: boolean) => {
    setState({ status: 'loading' });
    try {
      const result = await client.load({ forceRefresh });
      setState({ status: 'success', result });
    } catch (error) {
      if (error instanceof LiveDataError && error.kind === 'cancelled') {
        setState({ status: 'idle' });
        return;
      }
      setState({ status: 'error', kind: error instanceof LiveDataError ? error.kind : 'unknown', message: error instanceof Error ? error.message : 'Unknown error.' });
    }
  };

  const providerUrl = safeHttpsUrl(PROVIDER.url);
  const cacheMinutes = Math.round(DEFAULT_TTL_MS / 60000);

  return (
    <Page
      title="Live data"
      narrow
      intro={
        <p>
          A small demonstration of working with a real external API: current reference exchange rates for the US dollar. Unlike the projects, which use synthetic data, these figures come live from a third-party provider, and only when you
          ask for them.
        </p>
      }
    >
      <Section title="Current reference rates">
        <p className="max-w-prose text-sm text-muted-foreground">
          Pressing the button sends {QUOTE_CURRENCIES.length} requests from your browser to {PROVIDER.name}. Nothing is requested when the page opens. Results are kept in this browser tab for {cacheMinutes} minutes to avoid repeated requests.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {state.status === 'loading' ? (
            <Button variant="outline" onClick={() => client.cancel()}>
              Cancel
            </Button>
          ) : state.status === 'success' ? (
            <Button variant="outline" onClick={() => void load(true)}>
              Refresh from provider
            </Button>
          ) : (
            <Button onClick={() => void load(false)}>{state.status === 'error' ? 'Try again' : 'Load current rates'}</Button>
          )}
        </div>

        <p className="sr-only" role="status">
          {state.status === 'loading'
            ? `Loading rates from ${PROVIDER.name}.`
            : state.status === 'success'
              ? `Loaded ${state.result.snapshot.rates.length} rates${state.result.fromCache ? ' from this tab’s cache' : ''}.`
              : ''}
        </p>
        <div className="mt-6" aria-busy={state.status === 'loading'}>
          {state.status === 'idle' && <p className="text-sm text-muted-foreground">No data loaded yet.</p>}
          {state.status === 'loading' && <p className="text-sm">Loading rates from {PROVIDER.name}…</p>}
          {state.status === 'error' && (
            <div role="alert" className="max-w-prose rounded-md border border-border bg-muted px-4 py-3 text-sm">
              <p className="font-medium">Could not load live rates.</p>
              <p className="mt-1">{state.message}</p>
              <p className="mt-1 text-muted-foreground">{errorHelp(state.kind)} The rest of the site is unaffected.</p>
            </div>
          )}
          {state.status === 'success' && <RatesResult result={state.result} />}
        </div>
      </Section>

      <Section title="About this data">
        <ul className="max-w-prose list-disc space-y-2 pl-5 text-sm">
          <li>
            Source:{' '}
            {providerUrl === null ? (
              PROVIDER.name
            ) : (
              <a href={providerUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {PROVIDER.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            , a free public API with no key. {PROVIDER.description}
          </li>
          <li>Reference rates are indicative mid-market figures, not prices at which you could exchange money. Each rate carries its own date, which can lag on weekends and holidays.</li>
          <li>These rates are not used anywhere else on the site. The project analyses keep their own synthetic data and fictional prices, so live figures never mix with historical assumptions.</li>
          <li>Privacy: the request goes straight from your browser to the provider, without cookies. This site has no server and no analytics.</li>
        </ul>
      </Section>
    </Page>
  );
}

function RatesResult({ result }: { result: LoadResult }) {
  const { snapshot, fromCache } = result;
  const [amountText, setAmountText] = useState('100');
  const amountId = useId();
  const errorId = useId();
  const amount = Number(amountText);
  const amountValid = amountText.trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000_000;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="px-3 py-2 text-left text-muted-foreground">
            Units of each currency per 1 {snapshot.base}. Received {formatTimestamp(snapshot.fetchedAt)}
            {fromCache ? ' (from this tab’s cache; no new request was sent)' : ''}.
          </caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Currency</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Per 1 {snapshot.base}</th>
              <th scope="col" className="px-3 py-2 font-medium">Rate date</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rates.map((r) => (
              <tr key={r.quote} className="border-t border-border">
                <th scope="row" className="px-3 py-2 font-medium">
                  {r.quote} <span className="font-normal text-muted-foreground">{CURRENCY_NAMES[r.quote] ?? ''}</span>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{formatRate(r.rate)}</td>
                <td className="px-3 py-2">{r.date === null ? 'Not reported' : formatDate(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 max-w-sm">
        <label htmlFor={amountId} className="text-sm font-medium">
          Convert an amount in {BASE_CURRENCY}
        </label>
        <input
          id={amountId}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          aria-invalid={!amountValid}
          aria-describedby={amountValid ? undefined : errorId}
          className="mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm"
        />
        {!amountValid && (
          <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-accent">
            Enter a positive number (up to one billion).
          </p>
        )}
      </div>
      {amountValid && (
        <ul className="mt-3 space-y-1 text-sm">
          {snapshot.rates.map((r) => (
            <li key={r.quote} className="tabular-nums">
              {amount.toLocaleString('en-US', { style: 'currency', currency: BASE_CURRENCY })} ≈ {(amount * r.rate).toLocaleString('en-US', { style: 'currency', currency: r.quote })}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Indicative only, at reference rates; real exchanges include spreads and fees.</p>
    </div>
  );
}
