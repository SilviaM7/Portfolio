import { useId, useMemo, useState } from 'react';
import { DEFAULT_RECLAIM_PARAMS, EMPTY_ADOPTION_FILTERS, isAdoptionFiltered, type AdoptionDimension, type ReclaimEstimate, type ReclaimParams, type SeatRow, type SeatStatus } from '@/analysis/adoption';
import { AsyncState, EmptyState } from '@/components/project/AsyncState';
import { DataTable, type Column } from '@/components/project/DataTable';
import { FilterBar, SelectField } from '@/components/project/FilterBar';
import { FindingsPanel } from '@/components/project/FindingsPanel';
import { KpiCard, KpiGrid } from '@/components/project/KpiCard';
import { DatasetDownloads, JumpNav, ProjectHeader, ProjectSection } from '@/components/project/ProjectFrame';
import { QualityPanel } from '@/components/project/QualityPanel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDataset } from '@/hooks/useDataset';
import { formatDate } from '@/lib/dates';
import { formatInteger, formatPercent, formatUsd, formatUsdCents } from '@/lib/format';
import { findProject } from '@/projects/registry';
import { SeatStatusChart, WeeklyActiveChart } from './AdoptionCharts';
import { ADOPTION_DEFINITIONS, ADOPTION_FIELDS, ADOPTION_FILES, ADOPTION_LIMITATIONS, ADOPTION_METHOD_NOTES, ADOPTION_QUALITY_NOTES, ADOPTION_SOURCE_TEXT } from './content';
import { buildAdoptionExecutiveSummary, buildAdoptionFindings, DEFAULT_WINDOW_WEEKS } from './findings';
import { loadAdoptionDataset, type AdoptionDataset } from './load';
import { buildAdoptionView, windowChoices, type AdoptionViewFilters } from './viewModel';

const DIMENSIONS: { value: AdoptionDimension; label: string }[] = [
  { value: 'department', label: 'department' },
  { value: 'product', label: 'product' },
  { value: 'cohort', label: 'assignment cohort' },
];

const JUMP = [
  { id: 'summary', label: 'Summary' },
  { id: 'dataset', label: 'Dataset & method' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'findings', label: 'Findings' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'limitations', label: 'Limitations' },
];

const DEFAULT_FILTERS: AdoptionViewFilters = { ...EMPTY_ADOPTION_FILTERS, windowWeeks: DEFAULT_WINDOW_WEEKS };

const STATUS_TEXT: Record<SeatStatus, string> = { active: 'Active', inactive: 'Inactive', new: 'New (too early)', unknown: 'Unknown (no telemetry)' };

export default function AdoptionView() {
  const { state, reload } = useDataset(loadAdoptionDataset);
  const project = findProject('ai-adoption');
  if (project === undefined) return null;
  return (
    <>
      <ProjectHeader project={project} />
      <JumpNav items={JUMP} />
      <div className="mt-10">
        <AsyncState state={state} onRetry={reload}>
          {(data) => <AdoptionAnalysis data={data} />}
        </AsyncState>
      </div>
    </>
  );
}

function filterSummary(filters: AdoptionViewFilters): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (filters.windowWeeks !== DEFAULT_WINDOW_WEEKS) out.push({ label: 'Window', value: `${filters.windowWeeks} weeks` });
  if (filters.department !== null) out.push({ label: 'Department', value: filters.department });
  if (filters.product !== null) out.push({ label: 'Product', value: filters.product });
  return out;
}

const seatColumns: Column<SeatRow>[] = [
  { key: 'assignmentId', header: 'Assignment', value: (s) => s.assignmentId },
  { key: 'employeeId', header: 'Employee (pseudonym)', value: (s) => s.employeeId },
  { key: 'department', header: 'Department', value: (s) => s.department },
  { key: 'product', header: 'Product', value: (s) => s.product },
  { key: 'assigned', header: 'Assigned', value: (s) => s.assignedDate, render: (s) => formatDate(s.assignedDate) },
  { key: 'status', header: 'Status', value: (s) => STATUS_TEXT[s.status] },
  { key: 'activeWeeks', header: 'Active weeks / weeks with telemetry', align: 'right', value: (s) => s.activeWeeks, render: (s) => `${s.activeWeeks} / ${s.reportedWeeks}` },
  { key: 'actions', header: 'Actions in window', align: 'right', value: (s) => s.actionsInWindow, render: (s) => formatInteger(s.actionsInWindow) },
  { key: 'lastActive', header: 'Last active week', value: (s) => s.lastActiveWeek, render: (s) => (s.lastActiveWeek === null ? 'None in window' : formatDate(s.lastActiveWeek)) },
  { key: 'daysHeld', header: 'Days held', align: 'right', value: (s) => s.daysHeld, render: (s) => formatInteger(s.daysHeld) },
];

function AdoptionAnalysis({ data }: { data: AdoptionDataset }) {
  const [filters, setFilters] = useState<AdoptionViewFilters>(DEFAULT_FILTERS);
  const [dimension, setDimension] = useState<AdoptionDimension>('department');
  const [reclaimParams, setReclaimParams] = useState<ReclaimParams>(DEFAULT_RECLAIM_PARAMS);

  const view = useMemo(() => buildAdoptionView(data, filters, reclaimParams), [data, filters, reclaimParams]);
  const findings = useMemo(() => buildAdoptionFindings(data), [data]);
  const summaryText = useMemo(() => buildAdoptionExecutiveSummary(data), [data]);

  const recommendation = findings.filter((f) => f.kind === 'recommendation');
  const otherFindings = findings.filter((f) => f.kind !== 'recommendation');
  const set = (change: Partial<AdoptionViewFilters>) => setFilters((current) => ({ ...current, ...change }));
  const reset = () => setFilters(DEFAULT_FILTERS);
  const active = filterSummary(filters);

  return (
    <>
      <ProjectSection id="summary" title="Executive summary">
        <p className="max-w-prose">{summaryText}</p>
      </ProjectSection>

      <ProjectSection id="dataset" title="Dataset, assumptions, and method" intro="What the data is, how every metric is defined, and which assumptions the reclaim estimate relies on.">
        <p className="max-w-prose text-sm">{ADOPTION_SOURCE_TEXT}</p>
        <div className="mt-4">
          <DatasetDownloads files={ADOPTION_FILES} />
        </div>
        <Accordion className="mt-6" multiple>
          <AccordionItem value="fields">
            <AccordionTrigger>Field descriptions</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
                {ADOPTION_FIELDS.map((f) => (
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
                {ADOPTION_DEFINITIONS.map((d) => (
                  <div key={d.name}>
                    <dt className="font-medium">{d.name}</dt>
                    <dd className="text-muted-foreground">{d.formula}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="method">
            <AccordionTrigger>Reclaim scenario assumptions</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                {ADOPTION_METHOD_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ProjectSection>

      <ProjectSection id="analysis" title="Analysis" intro="Filters apply to every KPI, chart, and table in this section (the reclaim scenario uses the product filter only, because contracts are company-wide). The findings further down always describe the full dataset with the default 8-week window.">
        {view === null ? (
          <EmptyState title="No telemetry available" message="The activity file has no usable weeks, so seats cannot be classified. Check the data-quality table below." />
        ) : (
          <>
            <FilterBar activeFilters={active} onReset={reset} resultText={`${formatInteger(view.seats.length)} of ${formatInteger(view.allSeatCount)} seats held on ${formatDate(view.window.end)} match`}>
              <WindowSelect value={filters.windowWeeks} choices={windowChoices(view.availableWeeks)} onChange={(w) => set({ windowWeeks: w })} />
              <SelectField label="Department" value={filters.department} onChange={(v) => set({ department: v })} options={view.options.departments.map((d) => ({ value: d, label: d }))} />
              <SelectField label="Product" value={filters.product} onChange={(v) => set({ product: v })} options={view.options.products.map((d) => ({ value: d, label: d }))} />
            </FilterBar>
            <p className="mt-3 text-sm text-muted-foreground">
              Observation window: {formatDate(view.window.start)} – {formatDate(view.window.end)} ({view.window.weeks.length} weeks). As of {formatDate(view.window.end)}, the last day of the data, not today.
            </p>

            {view.seats.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="No seats match these filters" message="This department and product combination holds no seats on the as-of date. Clear one of the filters." onReset={reset} />
              </div>
            ) : (
              <SelectionResults view={view} filters={filters} dimension={dimension} onDimension={setDimension} reclaimParams={reclaimParams} onReclaim={setReclaimParams} />
            )}
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
          {ADOPTION_LIMITATIONS.map((item) => (
            <li key={item} className="max-w-prose">
              {item}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-xl font-semibold">Data-quality notes</h3>
        <div className="mt-3">
          <QualityPanel reports={data.reports} notes={ADOPTION_QUALITY_NOTES} />
        </div>
      </ProjectSection>
    </>
  );
}

type View = NonNullable<ReturnType<typeof buildAdoptionView>>;

function SelectionResults({
  view,
  filters,
  dimension,
  onDimension,
  reclaimParams,
  onReclaim,
}: {
  view: View;
  filters: AdoptionViewFilters;
  dimension: AdoptionDimension;
  onDimension: (d: AdoptionDimension) => void;
  reclaimParams: ReclaimParams;
  onReclaim: (p: ReclaimParams) => void;
}) {
  const s = view.summary;
  const active = filterSummary(filters);
  const scope = isAdoptionFiltered(filters) ? `for the current selection (${active.filter((a) => a.label !== 'Window').map((a) => `${a.label}: ${a.value}`).join(', ')})` : 'for all departments and products';
  const groups = dimension === 'department' ? view.byDepartment : dimension === 'product' ? view.byProduct : view.byCohort;
  const dimensionLabel = DIMENSIONS.find((d) => d.value === dimension)?.label ?? 'department';

  return (
    <>
      <div className="mt-6">
        <KpiGrid label="Key metrics for the current selection">
          <KpiCard label="Eligible seats" value={formatInteger(s.eligibleSeats)} definition="Σ policy-eligible employees for the selected departments and products." />
          <KpiCard label="Seats held" value={formatInteger(s.assignedSeats)} definition="Paid seats held on the as-of date." note={s.outsidePolicySeats > 0 ? `${formatInteger(s.outsidePolicySeats)} held outside the eligibility policy` : undefined} />
          <KpiCard label="Coverage" value={formatPercent(s.coverage)} definition="Seats held ÷ eligible seats. Can exceed 100%." />
          <KpiCard label="Utilization" value={formatPercent(s.utilization)} definition="Active seats ÷ seats held, in the observation window." note={`${formatInteger(s.activeSeats)} active seats`} />
          <KpiCard label="Inactive seats" value={formatInteger(s.inactiveSeats)} definition={`Held 28+ days with telemetry and no active day in the window.`} />
          <KpiCard label="Inactive-seat cost" value={`${formatUsd(s.inactiveSeatCostUsdPerMonth)}/mo`} definition="Monthly list price of inactive seats (fictional prices). A cost being paid, not a saving available now." />
          <KpiCard label="Cost per active seat" value={`${formatUsdCents(s.costPerActiveSeatUsdPerMonth)}/mo`} definition="Monthly list cost of all seats held ÷ active seats." note={`${formatUsd(s.assignedSeatCostUsdPerMonth)} per month for all seats held`} />
          <KpiCard label="Not yet classifiable" value={formatInteger(s.newSeats + s.unknownSeats)} definition="New seats (held under 28 days, no activity yet) plus seats with no telemetry. Still counted in seats held and in cost." note={`${formatInteger(s.newSeats)} new, ${formatInteger(s.unknownSeats)} unknown`} />
        </KpiGrid>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 max-w-xs">
            <PlainSelect label="Break seats down by" value={dimension} options={DIMENSIONS.map((d) => ({ value: d.value, label: d.label[0]?.toUpperCase() + d.label.slice(1) }))} onChange={(v) => onDimension(v as AdoptionDimension)} />
          </div>
          <SeatStatusChart groups={groups} dimensionLabel={dimensionLabel} scope={scope} />
        </div>
        <div className="lg:mt-[4.25rem]">
          <WeeklyActiveChart weekly={view.weekly} window={view.window} scope={scope} />
        </div>
      </div>

      <div className="mt-10">
        <ReclaimPanel rows={view.reclaim} params={reclaimParams} onChange={onReclaim} departmentFiltered={filters.department !== null} />
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-semibold">Seats in the current selection</h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Sortable and paginated. Each status can be checked against the activity file for the window weeks. {view.preAssignmentActivityRows > 0 ? `${formatInteger(view.preAssignmentActivityRows)} activity row(s) dated before the seat was assigned are excluded from status.` : ''}
        </p>
        <DataTable caption="Seats matching the current filters" columns={seatColumns} rows={view.seats} rowKey={(r) => r.assignmentId} pageSize={10} initialSort={{ key: 'daysHeld', direction: 'desc' }} />
      </div>
    </>
  );
}

const RECLAIM_SLIDERS: { key: keyof ReclaimParams; label: string }[] = [
  { key: 'reclaimShare', label: 'Share of inactive seats reclaimed after manager review' },
  { key: 'bufferShare', label: 'Headroom kept above remaining seats' },
];

function ReclaimPanel({ rows, params, onChange, departmentFiltered }: { rows: ReclaimEstimate[]; params: ReclaimParams; onChange: (p: ReclaimParams) => void; departmentFiltered: boolean }) {
  const available = rows.reduce((n, r) => n + r.annualSavingsUsd, 0);
  const deferred = rows.reduce((n, r) => n + r.deferredAnnualSavingsUsd, 0);
  return (
    <section aria-labelledby="reclaim-heading">
      <h3 id="reclaim-heading" className="text-xl font-semibold">
        Reclaim and renewal scenario
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        An estimate, not realized savings. Savings come only from lowering the committed seat count at renewal, never below the contract floor, and only if notice is given by the deadline. Ask managers before reclaiming: an inactive seat may still serve an occasional, important task.
        {departmentFiltered ? ' The department filter does not apply here, because each contract covers the whole company.' : ''}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {RECLAIM_SLIDERS.map((slider) => (
          <SliderField key={slider.key} label={slider.label} value={params[slider.key]} max={slider.key === 'bufferShare' ? 0.3 : 1} onChange={(value) => onChange({ ...params, [slider.key]: value })} />
        ))}
      </div>
      <p className="mt-4 text-sm" aria-live="polite">
        Estimated annual savings available with notice still open: <strong>{formatUsd(available)}</strong>.{deferred > 0 ? ` A further ${formatUsd(deferred)} per year is deferred to the following term because the notice deadline has passed.` : ''}
      </p>
      <div className="mt-4">
        <DataTable
          caption="Reclaim estimate by product contract"
          columns={[
            { key: 'product', header: 'Product', value: (r) => r.product },
            { key: 'committed', header: 'Committed seats', align: 'right', value: (r) => r.committedSeats },
            { key: 'held', header: 'Held', align: 'right', value: (r) => r.heldSeats, render: (r) => `${formatInteger(r.heldSeats)}${r.unassignedCommittedSeats > 0 ? ` (${formatInteger(r.unassignedCommittedSeats)} paid, unassigned)` : ''}` },
            { key: 'inactive', header: 'Inactive', align: 'right', value: (r) => r.inactiveSeats },
            { key: 'reclaimed', header: 'Reclaimed', align: 'right', value: (r) => r.reclaimedSeats },
            { key: 'proposed', header: 'Proposed commitment (floor)', align: 'right', value: (r) => r.proposedCommitment, render: (r) => `${formatInteger(r.proposedCommitment)} (${formatInteger(r.floorSeatsAtRenewal)})` },
            { key: 'deadline', header: 'Notice deadline', value: (r) => r.noticeDeadline, render: (r) => `${formatDate(r.noticeDeadline)} (${r.noticeOpen ? `${r.daysToNoticeDeadline} days left` : `passed ${-r.daysToNoticeDeadline} days earlier`})` },
            { key: 'savings', header: 'Annual savings (USD)', align: 'right', value: (r) => r.annualSavingsUsd + r.deferredAnnualSavingsUsd, render: (r) => (r.noticeOpen ? formatUsd(r.annualSavingsUsd) : `${formatUsd(r.deferredAnnualSavingsUsd)} deferred`) },
            { key: 'eligibleWithout', header: 'Eligible without a seat', align: 'right', value: (r) => r.eligibleWithoutSeat },
          ]}
          rows={rows}
          rowKey={(r) => r.product}
          pageSize={5}
        />
      </div>
    </section>
  );
}

function WindowSelect({ value, choices, onChange }: { value: number; choices: number[]; onChange: (weeks: number) => void }) {
  return <PlainSelect label="Observation window" value={String(value)} options={choices.map((w) => ({ value: String(w), label: `Last ${w} weeks` }))} onChange={(v) => onChange(Number(v))} />;
}

function PlainSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}: <output htmlFor={id}>{formatPercent(value, 0)}</output>
      </label>
      <input id={id} type="range" min={0} max={max} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full accent-[var(--accent)]" />
    </div>
  );
}
