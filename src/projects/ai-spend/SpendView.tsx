import { useId, useMemo, useState } from 'react';
import {
  DEFAULT_SCENARIO_PARAMS,
  EMPTY_SPEND_FILTERS,
  estimateScenarios,
  isFiltered,
  spendByDimension,
  type DailyAnomaly,
  type PricedEvent,
  type ScenarioParams,
  type SpendDimension,
  type SpendFilters,
} from '@/analysis/spend';
import { AsyncState, EmptyState } from '@/components/project/AsyncState';
import { DataTable, type Column } from '@/components/project/DataTable';
import { FilterBar, SelectField } from '@/components/project/FilterBar';
import { FindingsPanel } from '@/components/project/FindingsPanel';
import { KpiCard, KpiGrid } from '@/components/project/KpiCard';
import { DatasetDownloads, JumpNav, ProjectHeader, ProjectSection } from '@/components/project/ProjectFrame';
import { QualityPanel } from '@/components/project/QualityPanel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataset } from '@/hooks/useDataset';
import { formatDate, formatMonth } from '@/lib/dates';
import { formatDecimal, formatInteger, formatPercent, formatSignedPercent, formatUsd, formatUsdCents, formatUsdPrecise } from '@/lib/format';
import { findProject } from '@/projects/registry';
import { SPEND_DEFINITIONS, SPEND_FIELDS, SPEND_FILES, SPEND_LIMITATIONS, SPEND_METHOD_NOTES, SPEND_QUALITY_NOTES, SPEND_SOURCE_TEXT } from './content';
import { buildSpendExecutiveSummary, buildSpendFindings } from './findings';
import { loadSpendDataset, type SpendDataset } from './load';
import { DailySpendChart, MonthlyBudgetChart, SpendByDimensionChart } from './SpendCharts';
import { buildSpendView } from './viewModel';

const DIMENSIONS: { value: SpendDimension; label: string }[] = [
  { value: 'department', label: 'department' },
  { value: 'model', label: 'model' },
  { value: 'provider', label: 'provider' },
  { value: 'useCase', label: 'use case' },
];

const JUMP = [
  { id: 'summary', label: 'Summary' },
  { id: 'dataset', label: 'Dataset & method' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'findings', label: 'Findings' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'limitations', label: 'Limitations' },
];

export default function SpendView() {
  const { state, reload } = useDataset(loadSpendDataset);
  const project = findProject('ai-spend');
  if (project === undefined) return null;
  return (
    <>
      <ProjectHeader project={project} />
      <JumpNav items={JUMP} />
      <div className="mt-10">
        <AsyncState state={state} onRetry={reload}>
          {(data) => <SpendAnalysis data={data} />}
        </AsyncState>
      </div>
    </>
  );
}

function filterSummary(filters: SpendFilters): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (filters.fromMonth !== null) out.push({ label: 'From', value: formatMonth(filters.fromMonth) });
  if (filters.toMonth !== null) out.push({ label: 'To', value: formatMonth(filters.toMonth) });
  if (filters.department !== null) out.push({ label: 'Department', value: filters.department });
  if (filters.provider !== null) out.push({ label: 'Provider', value: filters.provider });
  if (filters.model !== null) out.push({ label: 'Model', value: filters.model });
  if (filters.useCase !== null) out.push({ label: 'Use case', value: filters.useCase });
  return out;
}

const eventColumns: Column<PricedEvent>[] = [
  { key: 'date', header: 'Date', value: (e) => e.date, render: (e) => formatDate(e.date) },
  { key: 'requestId', header: 'Request', value: (e) => e.requestId },
  { key: 'department', header: 'Department', value: (e) => e.department },
  { key: 'useCase', header: 'Use case', value: (e) => e.useCase },
  { key: 'model', header: 'Model', value: (e) => e.model },
  { key: 'status', header: 'Status', value: (e) => (e.isRetry ? `${e.status} (retry)` : e.status) },
  { key: 'input', header: 'Input tokens', align: 'right', value: (e) => e.inputTokens, render: (e) => formatInteger(e.inputTokens) },
  { key: 'cached', header: 'Cached tokens', align: 'right', value: (e) => e.cachedTokens, render: (e) => formatInteger(e.cachedTokens) },
  { key: 'output', header: 'Output tokens', align: 'right', value: (e) => e.outputTokens, render: (e) => formatInteger(e.outputTokens) },
  { key: 'cost', header: 'Cost (USD)', align: 'right', value: (e) => e.costUsd, render: (e) => (e.costUsd === null ? (e.costIssue === 'no_price' ? 'No price' : 'Invalid tokens') : formatUsdPrecise(e.costUsd)) },
  { key: 'latency', header: 'Latency (ms)', align: 'right', value: (e) => e.latencyMs, render: (e) => (e.latencyMs === null ? 'Not recorded' : formatInteger(e.latencyMs)) },
];

type AnomalyRow = DailyAnomaly & { id: string };

const anomalyColumns: Column<AnomalyRow>[] = [
  { key: 'id', header: 'ID', value: (a) => a.id },
  { key: 'date', header: 'Date', value: (a) => a.date, render: (a) => formatDate(a.date) },
  { key: 'spend', header: 'Spend', align: 'right', value: (a) => a.spendUsd, render: (a) => formatUsdCents(a.spendUsd) },
  { key: 'typical', header: 'Typical day', align: 'right', value: (a) => a.typicalUsd, render: (a) => formatUsdCents(a.typicalUsd) },
  { key: 'ratio', header: 'Multiple', align: 'right', value: (a) => a.ratio, render: (a) => `${formatDecimal(a.ratio)}×` },
  { key: 'driver', header: 'Largest measured change', value: (a) => a.driver },
  { key: 'where', header: 'Largest contributor', value: (a) => a.topUseCase },
  { key: 'why', header: 'Detail', value: (a) => a.explanation, render: (a) => <span className="block min-w-72 whitespace-normal text-muted-foreground">{a.explanation}</span> },
];

function SpendAnalysis({ data }: { data: SpendDataset }) {
  const [filters, setFilters] = useState<SpendFilters>(EMPTY_SPEND_FILTERS);
  const [dimension, setDimension] = useState<SpendDimension>('department');
  const [scenario, setScenario] = useState<ScenarioParams>(DEFAULT_SCENARIO_PARAMS);

  const view = useMemo(() => buildSpendView(data, filters), [data, filters]);
  const findings = useMemo(() => buildSpendFindings(data), [data]);
  const summaryText = useMemo(() => buildSpendExecutiveSummary(data), [data]);
  const scenarioResult = useMemo(() => estimateScenarios(view.events, data.prices, scenario), [view.events, data.prices, scenario]);
  const groups = useMemo(() => spendByDimension(view.events, dimension), [view.events, dimension]);

  const active = filterSummary(filters);
  const monthOptions = view.options.months.map((m) => ({ value: m, label: formatMonth(m) }));
  const rangeInvalid = filters.fromMonth !== null && filters.toMonth !== null && filters.fromMonth > filters.toMonth;
  const set = (change: Partial<SpendFilters>) => setFilters((current) => ({ ...current, ...change }));
  const reset = () => setFilters(EMPTY_SPEND_FILTERS);
  const scope = isFiltered(filters) ? `for the current selection (${active.map((f) => `${f.label}: ${f.value}`).join(', ')})` : 'for the full dataset';
  const dimensionLabel = DIMENSIONS.find((d) => d.value === dimension)?.label ?? 'department';
  const s = view.summary;
  const anomalyRows: AnomalyRow[] = view.anomalies.map((a, i) => ({ ...a, id: `A${i + 1}` }));
  const recommendation = findings.filter((f) => f.kind === 'recommendation');
  const otherFindings = findings.filter((f) => f.kind !== 'recommendation');
  const budgetVariance = view.budget?.variancePct ?? null;

  return (
    <>
      <ProjectSection id="summary" title="Executive summary">
        <p className="max-w-prose">{summaryText}</p>
      </ProjectSection>

      <ProjectSection id="dataset" title="Dataset, assumptions, and method" intro="What the data is, how every metric is defined, and which assumptions the estimates rely on.">
        <p className="max-w-prose text-sm">{SPEND_SOURCE_TEXT}</p>
        <div className="mt-4">
          <DatasetDownloads files={SPEND_FILES} />
        </div>
        <Accordion className="mt-6" multiple>
          <AccordionItem value="fields">
            <AccordionTrigger>Field descriptions</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
                {SPEND_FIELDS.map((f) => (
                  <div key={f.name} className="contents">
                    <dt className="font-mono text-xs">{f.name}</dt>
                    <dd className="text-muted-foreground">{f.meaning}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="definitions">
            <AccordionTrigger>Metric definitions (units, period, denominator)</AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-3">
                {SPEND_DEFINITIONS.map((d) => (
                  <div key={d.name}>
                    <dt className="font-medium">{d.name}</dt>
                    <dd className="text-muted-foreground">{d.formula}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="method">
            <AccordionTrigger>Methodology and scenario assumptions</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                {SPEND_METHOD_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ProjectSection>

      <ProjectSection id="analysis" title="Analysis" intro="Filters apply to every KPI, chart, and table in this section. The findings further down always describe the full dataset.">
        <FilterBar
          activeFilters={active}
          onReset={reset}
          resultText={`${formatInteger(view.events.length)} of ${formatInteger(data.events.length)} requests match`}
        >
          <SelectField label="From month" value={filters.fromMonth} onChange={(v) => set({ fromMonth: v })} options={monthOptions} allLabel="Start of data" />
          <SelectField label="To month" value={filters.toMonth} onChange={(v) => set({ toMonth: v })} options={monthOptions} allLabel="End of data" />
          <SelectField label="Department" value={filters.department} onChange={(v) => set({ department: v })} options={view.options.departments.map((d) => ({ value: d, label: d }))} />
          <SelectField label="Provider" value={filters.provider} onChange={(v) => set({ provider: v })} options={view.options.providers.map((d) => ({ value: d, label: d }))} />
          <SelectField label="Model" value={filters.model} onChange={(v) => set({ model: v })} options={view.options.models.map((d) => ({ value: d, label: d }))} />
          <SelectField label="Use case" value={filters.useCase} onChange={(v) => set({ useCase: v })} options={view.options.useCases.map((d) => ({ value: d, label: d }))} />
        </FilterBar>
        {rangeInvalid && (
          <p role="alert" className="mt-3 text-sm font-medium text-accent">
            The start month is after the end month, so no data matches. Choose an earlier start or a later end.
          </p>
        )}

        {view.events.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No requests match these filters" message="Widen the date range or clear one of the filters." onReset={reset} />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <KpiGrid label="Key metrics for the current selection">
                <KpiCard label="Priced spend" value={formatUsd(s.spendUsd)} definition="Sum of request costs (USD) in the selected months." note={s.unpricedRequests + s.invalidTokenRequests > 0 ? `Excludes ${s.unpricedRequests + s.invalidTokenRequests} request(s) that could not be priced.` : undefined} />
                <KpiCard label="Requests" value={formatInteger(s.requests)} definition="Count of request rows; retries count as separate requests." note={`${formatInteger(s.tasks)} tasks, ${formatInteger(s.retryRequests)} retries`} />
                <KpiCard label="Success rate" value={formatPercent(s.successRate)} definition="Successful requests ÷ all requests." />
                <KpiCard label="Cost per completed task" value={formatUsdPrecise(s.costPerSuccessfulTask)} definition="(Completed + abandoned task spend) ÷ completed tasks, in USD." note={`Completed-task spend only: ${formatUsdPrecise(s.directCostPerSuccessfulTask)}`} />
                <KpiCard label="Failed-request spend" value={formatPercent(s.failedSpendShare)} definition="Spend on failed requests ÷ priced spend." note={formatUsd(s.failedSpendUsd)} />
                <KpiCard label="Cache hit rate" value={formatPercent(s.cacheHitRate)} definition="Σ cached tokens ÷ Σ input tokens (weighted)." />
                <KpiCard label="Median latency" value={s.medianLatencyMs === null ? '—' : `${formatInteger(s.medianLatencyMs)} ms`} definition="Median of successful requests with a recorded latency." />
                <KpiCard
                  label="Budget variance"
                  value={budgetVariance === null ? 'n/a' : formatSignedPercent(budgetVariance)}
                  definition="(Actual − budget) ÷ budget for the selected months and departments. Positive = over budget."
                  note={view.budget === null ? 'Not available while a provider, model, or use-case filter is active.' : `${formatUsd(view.budget.actualUsd)} actual vs ${formatUsd(view.budget.budgetUsd)} budget`}
                />
              </KpiGrid>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 max-w-xs">
                  <DimensionSelect value={dimension} onChange={setDimension} />
                </div>
                <SpendByDimensionChart groups={groups} dimensionLabel={dimensionLabel} scope={scope} />
              </div>
              <div className="lg:mt-[4.25rem]">
                <MonthlyBudgetChart view={view} scope={scope} />
              </div>
            </div>
            <div className="mt-6">
              <DailySpendChart view={view} scope={scope} />
            </div>

            <Tabs defaultValue="anomalies" className="mt-10">
              <TabsList aria-label="Anomalies, projection, and savings scenarios">
                <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
                <TabsTrigger value="projection">Projection</TabsTrigger>
                <TabsTrigger value="scenarios">Savings scenarios</TabsTrigger>
              </TabsList>
              <TabsContent value="anomalies">
                <p className="mb-4 max-w-prose text-sm text-muted-foreground">Days with unusually high spend compared with similar earlier days, with the measured pattern that moved most. Descriptive only: confirm with the department before acting.</p>
                {anomalyRows.length === 0 ? <EmptyState title="No anomalies flagged" message="No day in the current selection met the anomaly rule." /> : <DataTable caption="Flagged anomaly days" columns={anomalyColumns} rows={anomalyRows} rowKey={(a) => a.id} pageSize={5} initialSort={{ key: 'ratio', direction: 'desc' }} />}
              </TabsContent>
              <TabsContent value="projection">
                <p className="max-w-prose text-sm text-muted-foreground">Illustrative projection, not a forecast. It extends the recent compound monthly trend and assumes no change in prices, mix, or policy.</p>
                {view.projection.length === 0 ? (
                  <p className="mt-4 text-sm">No projection is shown for this selection: it needs at least three recent months with spend and a date range that reaches the latest month with data.</p>
                ) : (
                  <div className="mt-4">
                    <p className="mb-3 text-sm">Recent monthly growth used: <strong>{formatSignedPercent(view.growth)}</strong> per month (log-linear fit over the last 6 months). Baseline: average of the last 3 months.</p>
                    <DataTable
                      caption="Projected monthly spend"
                      columns={[
                        { key: 'month', header: 'Month', value: (p) => p.month, render: (p) => formatMonth(p.month) },
                        { key: 'projected', header: 'Projected spend (USD)', align: 'right', value: (p) => p.projectedUsd, render: (p) => formatUsd(p.projectedUsd) },
                        { key: 'budget', header: 'Budget (USD)', align: 'right', value: (p) => p.budgetUsd, render: (p) => (p.budgetUsd === null ? 'n/a' : formatUsd(p.budgetUsd)) },
                      ]}
                      rows={view.projection}
                      rowKey={(p) => p.month}
                      pageSize={5}
                    />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="scenarios">
                <ScenarioPanel params={scenario} onChange={setScenario} result={scenarioResult} />
              </TabsContent>
            </Tabs>

            <div className="mt-10">
              <h3 className="text-xl font-semibold">Requests in the current selection</h3>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">Sortable and paginated. Costs are recomputed from tokens and the effective-dated price, so each row can be checked by hand.</p>
              <DataTable caption="Requests matching the current filters" columns={eventColumns} rows={view.events} rowKey={(e) => e.requestId} pageSize={10} initialSort={{ key: 'date', direction: 'desc' }} />
            </div>
          </>
        )}
      </ProjectSection>

      <ProjectSection id="findings" title="Findings">
        <FindingsPanel findings={otherFindings} />
      </ProjectSection>

      <ProjectSection id="recommendation" title="Recommendation">
        <FindingsPanel findings={recommendation} />
      </ProjectSection>

      <ProjectSection id="limitations" title="Limitations and data quality">
        <ul className="list-disc space-y-2 pl-5">
          {SPEND_LIMITATIONS.map((item) => (
            <li key={item} className="max-w-prose">
              {item}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-xl font-semibold">Data-quality notes</h3>
        <div className="mt-3">
          <QualityPanel reports={data.reports} notes={SPEND_QUALITY_NOTES} />
        </div>
      </ProjectSection>
    </>
  );
}

function DimensionSelect({ value, onChange }: { value: SpendDimension; onChange: (value: SpendDimension) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        Break spend down by
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as SpendDimension)} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm">
        {DIMENSIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label[0]?.toUpperCase()}
            {d.label.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

const SLIDERS: { key: keyof ScenarioParams; label: string; help: string }[] = [
  { key: 'routingShare', label: 'Share of eligible requests moved to the smaller model', help: 'Routing lever.' },
  { key: 'qualityHaircut', label: 'Share of routing savings lost to quality problems or rework', help: 'Reduces the routing estimate.' },
  { key: 'cacheLift', label: 'Extra share of input tokens served from cache on long prompts', help: 'Caching lever.' },
  { key: 'failureReduction', label: 'Share of failed-request spend removed by fixing root causes', help: 'Failure lever.' },
];

function ScenarioPanel({ params, onChange, result }: { params: ScenarioParams; onChange: (p: ScenarioParams) => void; result: ReturnType<typeof estimateScenarios> }) {
  return (
    <div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Estimates for the current selection, not guaranteed savings. Change the assumptions to see how sensitive the result is. The levers overlap, so do not add them together.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {SLIDERS.map((slider) => (
          <SliderField key={slider.key} label={slider.label} value={params[slider.key]} onChange={(value) => onChange({ ...params, [slider.key]: value })} />
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Estimated savings by lever</caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Lever</th>
              <th scope="col" className="px-3 py-2 font-medium">Basis (current selection)</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Estimated savings (USD, whole period)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 font-medium">Route low-risk use cases to a smaller model</th>
              <td className="px-3 py-2">{formatInteger(result.routing.eligibleRequests)} eligible requests, {formatUsd(result.routing.eligibleSpendUsd)} of spend. Gross {formatUsd(result.routing.grossSavingsUsd)} before the quality haircut.</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatUsd(result.routing.netSavingsUsd)}</td>
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 font-medium">Cache more of long prompts</th>
              <td className="px-3 py-2">{formatInteger(result.caching.candidateRequests)} candidate requests, {formatInteger(result.caching.additionalCachedTokens)} additional cached tokens.</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatUsd(result.caching.savingsUsd)}</td>
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 font-medium">Fix root causes of failed requests</th>
              <td className="px-3 py-2">{formatUsd(result.failures.failedSpendUsd)} spent on failed requests.</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatUsd(result.failures.savingsUsd)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}: <output htmlFor={id}>{formatPercent(value, 0)}</output>
      </label>
      <input id={id} type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full accent-[var(--accent)]" />
    </div>
  );
}
