import { useId, useMemo, useState } from 'react';
import { COMPLEXITIES, defaultValueParams, EMPTY_WORKFLOW_FILTERS, isWorkflowFiltered, taskMinutes, type Complexity, type ScenarioBase, type SensitivityRow, type ValueParams, type WorkflowFilters, type WorkflowRecord } from '@/analysis/workflow';
import { AsyncState, EmptyState } from '@/components/project/AsyncState';
import { DataTable, type Column } from '@/components/project/DataTable';
import { FilterBar, SelectField } from '@/components/project/FilterBar';
import { FindingsPanel } from '@/components/project/FindingsPanel';
import { KpiCard, KpiGrid } from '@/components/project/KpiCard';
import { DatasetDownloads, JumpNav, ProjectHeader, ProjectSection } from '@/components/project/ProjectFrame';
import { QualityPanel } from '@/components/project/QualityPanel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDataset } from '@/hooks/useDataset';
import { formatMonth } from '@/lib/dates';
import { formatDecimal, formatInteger, formatPercent, formatUsd, formatUsdCents } from '@/lib/format';
import { findProject } from '@/projects/registry';
import { WORKFLOW_DEFINITIONS, WORKFLOW_FIELDS, WORKFLOW_FILES, WORKFLOW_LIMITATIONS, WORKFLOW_METHOD_NOTES, WORKFLOW_QUALITY_NOTES, WORKFLOW_SOURCE_TEXT } from './content';
import { buildWorkflowExecutiveSummary, buildWorkflowFindings } from './findings';
import { loadWorkflowDataset, type WorkflowDataset } from './load';
import { ComplexityChart, PaybackChart, TrendChart } from './WorkflowCharts';
import { buildScenarioView, buildWorkflowView, scenarioBaseFor } from './viewModel';

const JUMP = [
  { id: 'summary', label: 'Summary' },
  { id: 'dataset', label: 'Dataset & method' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'scenario', label: 'Value scenario' },
  { id: 'findings', label: 'Findings' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'limitations', label: 'Limitations' },
];

const MAX_VOLUME = 100_000;

export default function WorkflowView() {
  const { state, reload } = useDataset(loadWorkflowDataset);
  const project = findProject('ai-workflow');
  if (project === undefined) return null;
  return (
    <>
      <ProjectHeader project={project} />
      <JumpNav items={JUMP} />
      <div className="mt-10">
        <AsyncState state={state} onRetry={reload}>
          {(data) => <WorkflowAnalysis data={data} />}
        </AsyncState>
      </div>
    </>
  );
}

function filterSummary(filters: WorkflowFilters): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (filters.fromMonth !== null) out.push({ label: 'From', value: formatMonth(filters.fromMonth) });
  if (filters.toMonth !== null) out.push({ label: 'To', value: formatMonth(filters.toMonth) });
  if (filters.workflow !== null) out.push({ label: 'Workflow', value: filters.workflow });
  if (filters.complexity !== null) out.push({ label: 'Complexity', value: filters.complexity });
  if (filters.team !== null) out.push({ label: 'Team', value: filters.team });
  return out;
}

const isComplexity = (v: string | null): v is Complexity => v !== null && (COMPLEXITIES as readonly string[]).includes(v);
const points = (v: number | null) => (v === null ? 'n/a' : `${v >= 0 ? '+' : '−'}${formatDecimal(Math.abs(v * 100))} pts`);
const minutesText = (v: number | null) => (v === null ? 'n/a' : `${formatDecimal(v)} min`);
const signedMinutes = (v: number | null) => (v === null ? 'n/a' : `${v >= 0 ? '−' : '+'}${formatDecimal(Math.abs(v))} min`);

const recordColumns: Column<WorkflowRecord>[] = [
  { key: 'taskId', header: 'Task', value: (r) => r.taskId },
  { key: 'month', header: 'Month', value: (r) => r.month, render: (r) => formatMonth(r.month) },
  { key: 'workflow', header: 'Workflow', value: (r) => r.workflow },
  { key: 'complexity', header: 'Complexity', value: (r) => r.complexity },
  { key: 'team', header: 'Team', value: (r) => r.team },
  { key: 'process', header: 'Process', value: (r) => (r.process === 'ai_assisted' ? 'AI-assisted' : 'Baseline') },
  { key: 'handling', header: 'Handling (min)', align: 'right', value: (r) => r.handlingMinutes, render: (r) => formatDecimal(r.handlingMinutes) },
  { key: 'review', header: 'Review (min)', align: 'right', value: (r) => r.reviewMinutes, render: (r) => formatDecimal(r.reviewMinutes) },
  { key: 'rework', header: 'Rework (min)', align: 'right', value: (r) => r.reworkMinutes, render: (r) => (r.reworkMinutes === null ? 'Not recorded' : formatDecimal(r.reworkMinutes)) },
  { key: 'total', header: 'Total (min)', align: 'right', value: (r) => taskMinutes(r), render: (r) => { const m = taskMinutes(r); return m === null ? '—' : formatDecimal(m); } },
  { key: 'quality', header: 'Quality', value: (r) => r.quality, render: (r) => (r.quality === null ? 'Not audited' : r.quality) },
  { key: 'escalated', header: 'Escalated', value: (r) => (r.escalated ? 'yes' : 'no') },
];

function WorkflowAnalysis({ data }: { data: WorkflowDataset }) {
  const [filters, setFilters] = useState<WorkflowFilters>(EMPTY_WORKFLOW_FILTERS);
  const view = useMemo(() => buildWorkflowView(data, filters), [data, filters]);
  const base = useMemo(() => scenarioBaseFor(data), [data]);
  const findings = useMemo(() => buildWorkflowFindings(data), [data]);
  const summaryText = useMemo(() => buildWorkflowExecutiveSummary(data), [data]);

  const active = filterSummary(filters);
  const set = (change: Partial<WorkflowFilters>) => setFilters((current) => ({ ...current, ...change }));
  const reset = () => setFilters(EMPTY_WORKFLOW_FILTERS);
  const rangeInvalid = filters.fromMonth !== null && filters.toMonth !== null && filters.fromMonth > filters.toMonth;
  const scope = isWorkflowFiltered(filters) ? `for the current selection (${active.map((a) => `${a.label}: ${a.value}`).join(', ')})` : 'for the full dataset';
  const monthOptions = view.options.months.map((m) => ({ value: m, label: formatMonth(m) }));
  const c = view.comparison;
  const noAi = c.ai.tasks === 0;
  const noBaseline = c.baseline.tasks === 0;

  return (
    <>
      <ProjectSection id="summary" title="Executive summary">
        <p className="max-w-prose">{summaryText}</p>
      </ProjectSection>

      <ProjectSection id="dataset" title="Dataset, assumptions, and method" intro="What the data is, how every metric is defined, and which assumptions the value scenario relies on.">
        <p className="max-w-prose text-sm">{WORKFLOW_SOURCE_TEXT}</p>
        <div className="mt-4">
          <DatasetDownloads files={WORKFLOW_FILES} />
        </div>
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="px-3 py-2 text-left font-medium">Cost assumptions (all fictional)</caption>
            <tbody>
              {[
                ['Labor rate (fully loaded)', `${formatUsd(data.assumptions.laborRateUsdPerHour)} per hour`],
                ['AI usage cost', `${formatUsdCents(data.assumptions.aiVariableCostUsdPerTask)} per AI-assisted task`],
                ['Escalation cost', `${formatUsd(data.assumptions.escalationCostUsdPerTask)} per escalated task`],
                ['Software subscription', `${formatUsd(data.assumptions.softwareUsdPerMonth)} per month`],
                ['Implementation (one-time)', formatUsd(data.assumptions.implementationOneTimeUsd)],
                ['Training (one-time)', formatUsd(data.assumptions.trainingOneTimeUsd)],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 font-medium">{k}</th>
                  <td className="px-3 py-2 tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Accordion className="mt-6" multiple>
          <AccordionItem value="fields">
            <AccordionTrigger>Field descriptions</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
                {WORKFLOW_FIELDS.map((f) => (
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
                {WORKFLOW_DEFINITIONS.map((d) => (
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
                {WORKFLOW_METHOD_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ProjectSection>

      <ProjectSection id="analysis" title="Analysis" intro="Filters apply to every KPI, chart, and table in this section. The value scenario below and the findings always use the full dataset.">
        <FilterBar activeFilters={active} onReset={reset} resultText={`${formatInteger(view.records.length)} of ${formatInteger(data.records.length)} tasks match`}>
          <SelectField label="From month" value={filters.fromMonth} onChange={(v) => set({ fromMonth: v })} options={monthOptions} allLabel="Start of data" />
          <SelectField label="To month" value={filters.toMonth} onChange={(v) => set({ toMonth: v })} options={monthOptions} allLabel="End of data" />
          <SelectField label="Workflow" value={filters.workflow} onChange={(v) => set({ workflow: v })} options={view.options.workflows.map((w) => ({ value: w, label: w }))} />
          <SelectField label="Complexity" value={filters.complexity} onChange={(v) => set({ complexity: isComplexity(v) ? v : null })} options={COMPLEXITIES.map((x) => ({ value: x, label: x }))} />
          <SelectField label="Team" value={filters.team} onChange={(v) => set({ team: v })} options={view.options.teams.map((t) => ({ value: t, label: view.pilotTeams.includes(t) ? `${t} (pilot)` : `${t} (comparison)` }))} />
        </FilterBar>
        {rangeInvalid && (
          <p role="alert" className="mt-3 text-sm font-medium text-accent">
            The start month is after the end month, so no data matches. Choose an earlier start or a later end.
          </p>
        )}

        {view.records.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No tasks match these filters" message="Widen the date range or clear one of the filters." onReset={reset} />
          </div>
        ) : (
          <>
            {(noAi || noBaseline) && (
              <p className="mt-4 max-w-prose rounded-md border border-border bg-muted px-3 py-2 text-sm">
                The selection contains only {noAi ? 'baseline' : 'AI-assisted'} tasks, so baseline-versus-AI comparisons show n/a. {noAi ? 'The pilot started in April 2026, and the comparison team never used AI assistance.' : ''}
              </p>
            )}
            <div className="mt-6">
              <KpiGrid label="Key metrics for the current selection">
                <KpiCard label="Tasks" value={formatInteger(view.records.length)} definition="Task rows in the selection." note={`${formatInteger(c.baseline.tasks)} baseline, ${formatInteger(c.ai.tasks)} AI-assisted`} />
                <KpiCard label="Minutes per task (AI-assisted)" value={minutesText(c.ai.meanMinutes)} definition="Handling + review + rework, tasks with rework recorded." note={`Baseline: ${minutesText(c.baseline.meanMinutes)}`} />
                <KpiCard label="Time difference, mix-adjusted" value={signedMinutes(c.minutesSavedStandardized)} definition="AI-assisted minus baseline minutes, with the baseline reweighted to the AI-assisted complexity mix. Negative = AI-assisted faster." note={`Unadjusted: ${signedMinutes(c.minutesSavedRaw)}`} />
                <KpiCard label="Pass rate (AI-assisted)" value={formatPercent(c.ai.passRate)} definition="Passed ÷ audited tasks." note={`Baseline ${formatPercent(c.baseline.passRate)}; difference ${points(c.passRateDelta)}`} />
                <KpiCard label="Escalation rate (AI-assisted)" value={formatPercent(c.ai.escalationRate)} definition="Escalated ÷ all tasks." note={`Baseline ${formatPercent(c.baseline.escalationRate)}`} />
                <KpiCard label="Cost per successful task (baseline)" value={formatUsdCents(c.baseline.costPerSuccessfulTaskUsd)} definition="Operating cost of timed, audited tasks (passed and failed) ÷ passed tasks, USD." />
                <KpiCard label="Cost per successful task (AI-assisted)" value={formatUsdCents(c.ai.costPerSuccessfulTaskUsd)} definition="Same definition, including AI usage cost, before program costs." note={`With program costs: ${formatUsdCents(c.aiCostPerSuccessWithProgramUsd)}`} />
                <KpiCard label="Program cost allocated" value={formatUsd(c.allocatedProgramCostUsd)} definition="Software for the pilot months + implementation + training, in proportion to the AI-assisted tasks in view." />
              </KpiGrid>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <ComplexityChart rows={view.complexity} scope={scope} />
              <TrendChart rows={view.trend} pilotStart={view.pilotStart} pilotTeams={view.pilotTeams} scope={scope} />
            </div>

            <div className="mt-10">
              <h3 className="text-xl font-semibold">Tasks in the current selection</h3>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">Sortable and paginated. Blank rework and quality values are shown as not recorded or not audited, never as zero.</p>
              <DataTable caption="Tasks matching the current filters" columns={recordColumns} rows={view.records} rowKey={(r) => r.taskId} pageSize={10} initialSort={{ key: 'month', direction: 'desc' }} />
            </div>
          </>
        )}
      </ProjectSection>

      <ProjectSection id="scenario" title="Value scenario: break-even, payback, and sensitivity" intro="Estimates from the full dataset, measured within each complexity level. Change the assumptions to see what the pilot needs in order to pay for itself. Released time is valued separately from cash.">
        {base === null ? <EmptyState title="Scenario unavailable" message="The data has no complexity level with both baseline and AI-assisted tasks, so no scenario can be estimated." /> : <ScenarioPanel base={base} />}
      </ProjectSection>

      <ProjectSection id="findings" title="Findings">
        <FindingsPanel findings={findings.filter((f) => f.kind !== 'recommendation')} />
      </ProjectSection>

      <ProjectSection id="recommendation" title="Recommendation">
        <FindingsPanel findings={findings.filter((f) => f.kind === 'recommendation')} />
      </ProjectSection>

      <ProjectSection id="limitations" title="Limitations and data quality">
        <ul className="list-disc space-y-2 pl-5">
          {WORKFLOW_LIMITATIONS.map((item) => (
            <li key={item} className="max-w-prose">
              {item}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-xl font-semibold">Data-quality notes</h3>
        <div className="mt-3">
          <QualityPanel reports={data.reports} notes={WORKFLOW_QUALITY_NOTES} />
        </div>
      </ProjectSection>
    </>
  );
}

const SLIDERS: { key: 'adoptionShare' | 'timeSavingsFactor' | 'passRateShift' | 'laborRateFactor' | 'cashRealizationShare'; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
  { key: 'adoptionShare', label: 'Share of volume using the AI-assisted process', min: 0, max: 1, step: 0.05, format: (v) => formatPercent(v, 0) },
  { key: 'timeSavingsFactor', label: 'Time savings compared with observed', min: 0, max: 1.5, step: 0.05, format: (v) => formatPercent(v, 0) },
  { key: 'passRateShift', label: 'Change in AI-assisted pass rate', min: -0.1, max: 0.1, step: 0.01, format: (v) => `${v >= 0 ? '+' : '−'}${formatDecimal(Math.abs(v * 100), 0)} pts` },
  { key: 'laborRateFactor', label: 'Labor rate compared with assumption', min: 0.5, max: 1.5, step: 0.05, format: (v) => formatPercent(v, 0) },
  { key: 'cashRealizationShare', label: 'Share of released time turned into cash savings', min: 0, max: 1, step: 0.05, format: (v) => formatPercent(v, 0) },
];

function ScenarioPanel({ base }: { base: ScenarioBase }) {
  const defaults = useMemo(() => defaultValueParams(base), [base]);
  const [params, setParams] = useState<ValueParams>(defaults);
  const [volumeText, setVolumeText] = useState(String(defaults.monthlyVolume));
  const scenario = useMemo(() => buildScenarioView(base, params), [base, params]);
  const e = scenario.estimate;
  const volumeId = useId();
  const volumeErrorId = useId();
  const volumeNumber = Number(volumeText);
  const volumeInvalid = volumeText.trim() === '' || !Number.isFinite(volumeNumber) || volumeNumber < 0 || volumeNumber > MAX_VOLUME;

  const onVolume = (text: string) => {
    setVolumeText(text);
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_VOLUME) setParams((p) => ({ ...p, monthlyVolume: Math.round(n) }));
  };
  const toggleLevel = (level: Complexity, on: boolean) => setParams((p) => ({ ...p, complexities: COMPLEXITIES.filter((x) => (x === level ? on : p.complexities.includes(x))) }));
  const resetScenario = () => {
    setParams(defaults);
    setVolumeText(String(defaults.monthlyVolume));
  };
  const payback = (m: number | null) => (m === null ? 'Does not pay back' : `${formatDecimal(m, 1)} months`);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={volumeId} className="text-sm font-medium">
            Tasks per month in the workflow
          </label>
          <input
            id={volumeId}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_VOLUME}
            step={1}
            value={volumeText}
            onChange={(event) => onVolume(event.target.value)}
            aria-invalid={volumeInvalid}
            aria-describedby={volumeInvalid ? volumeErrorId : undefined}
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Observed: about {formatInteger(base.observedAiTasksPerMonth)} AI-assisted tasks per pilot month.</p>
          {volumeInvalid && (
            <p id={volumeErrorId} role="alert" className="mt-1 text-sm font-medium text-accent">
              Enter a whole number from 0 to {formatInteger(MAX_VOLUME)}. The results still use {formatInteger(params.monthlyVolume)}.
            </p>
          )}
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Complexity levels routed to AI assistance</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {COMPLEXITIES.map((level) => (
              <label key={level} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={params.complexities.includes(level)} onChange={(event) => toggleLevel(level, event.target.checked)} />
                {level}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Levels left unchecked stay on the baseline process.</p>
        </fieldset>
        {SLIDERS.map((s) => (
          <SliderField key={s.key} label={s.label} value={params[s.key]} min={s.min} max={s.max} step={s.step} format={s.format} onChange={(v) => setParams((p) => ({ ...p, [s.key]: v }))} />
        ))}
      </div>
      <button type="button" onClick={resetScenario} className="mt-4 min-h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
        Reset scenario assumptions
      </button>

      <div className="mt-6" aria-live="polite">
        <KpiGrid label="Scenario results">
          <KpiCard label="AI-routed tasks" value={`${formatInteger(e.aiRoutedTasksPerMonth)}/mo`} definition="Volume × adoption share, limited to the selected complexity levels." />
          <KpiCard label="Capacity released" value={`${formatDecimal(e.capacityHoursPerMonth)} h/mo`} definition="Staff hours freed per month. Capacity, not cash." />
          <KpiCard label="Estimated value of time" value={`${formatUsd(e.estimatedGrossValueUsdPerMonth)}/mo`} definition="Labor value per successful task (baseline − AI-assisted) × tasks, minus AI usage cost." />
          <KpiCard label="Estimated net value" value={`${formatUsd(e.estimatedNetValueUsdPerMonth)}/mo`} definition="Estimated value of time minus software. Not realized savings." />
          <KpiCard label="Cash view" value={`${formatUsd(e.cashNetUsdPerMonth)}/mo`} definition="Cash realization share × labor value − AI usage cost − software." />
          <KpiCard label="Break-even volume" value={e.breakEvenAiTasksPerMonth === null ? 'Not reachable' : `${formatInteger(e.breakEvenAiTasksPerMonth)}/mo`} definition="AI-routed tasks per month at which estimated net value is zero." />
          <KpiCard label="Payback, estimated value" value={payback(e.paybackMonthsEstimated)} definition={`One-time costs (${formatUsd(e.oneTimeUsd)}) ÷ estimated net value per month.`} />
          <KpiCard label="Payback, cash view" value={payback(e.paybackMonthsCash)} definition="One-time costs ÷ cash view per month." />
        </KpiGrid>
      </div>

      <div className="mt-8">
        <PaybackChart scenario={scenario} />
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold">Sensitivity: one assumption at a time</h3>
        <p className="mt-1 mb-4 max-w-prose text-sm text-muted-foreground">Each row changes exactly one input from your current settings. Rows are not additive.</p>
        <DataTable<SensitivityRow & { id: string }>
          caption="One-at-a-time sensitivity of estimated net value and payback"
          columns={[
            { key: 'parameter', header: 'Assumption', value: (r) => r.parameter },
            { key: 'setting', header: 'Setting', value: (r) => r.setting },
            { key: 'net', header: 'Estimated net value (USD/month)', align: 'right', value: (r) => r.estimatedNetValueUsdPerMonth, render: (r) => formatUsd(r.estimatedNetValueUsdPerMonth) },
            { key: 'payback', header: 'Payback (estimated value)', align: 'right', value: (r) => r.paybackMonthsEstimated, render: (r) => payback(r.paybackMonthsEstimated) },
          ]}
          rows={scenario.sensitivity.map((r, i) => ({ ...r, id: `s${i}` }))}
          rowKey={(r) => r.id}
          pageSize={20}
        />
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}: <output htmlFor={id}>{format(value)}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full accent-[var(--accent)]" />
    </div>
  );
}
