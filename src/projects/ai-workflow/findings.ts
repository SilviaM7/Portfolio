/** Written findings for AI Workflow Value & Quality. Computed from the FULL dataset (all months, teams, workflows). */
import {
  buildScenarioBase,
  byComplexity,
  compareProcesses,
  defaultValueParams,
  estimateValue,
  monthlyTrend,
  pilotTeams,
} from '@/analysis/workflow';
import { formatDecimal, formatInteger, formatPercent, formatUsd } from '@/lib/format';
import { formatMonth } from '@/lib/dates';
import type { Finding } from '../findings';
import type { WorkflowDataset } from './load';

export function buildWorkflowFindings(data: WorkflowDataset): Finding[] {
  const { records, assumptions } = data;
  const out: Finding[] = [];
  const cmp = compareProcesses(records, records, assumptions);
  const months = [...new Set(records.map((r) => r.month))].sort();
  const first = months[0];
  const last = months[months.length - 1];
  const period = first !== undefined && last !== undefined ? `${formatMonth(first)}–${formatMonth(last)}` : 'the dataset period';

  out.push({
    kind: 'observed',
    title: 'Time per task, baseline vs AI-assisted',
    text: `Full dataset, ${period}: AI-assisted tasks took ${formatDecimal(cmp.ai.meanMinutes)} minutes on average versus ${formatDecimal(cmp.baseline.meanMinutes)} for baseline tasks (handling + review + rework), ${formatDecimal(cmp.minutesSavedRaw)} minutes less; ${formatDecimal(cmp.minutesSavedStandardized)} minutes less after standardizing the baseline to the AI-assisted complexity mix. Review time is higher with AI (${formatDecimal(cmp.ai.meanReviewMinutes)} vs ${formatDecimal(cmp.baseline.meanReviewMinutes)} minutes). This is a descriptive comparison, not proof the AI caused the change.`,
  });

  const levels = byComplexity(records, assumptions);
  const slower = levels.filter((l) => l.aiMinutes !== null && l.baselineMinutes !== null && l.aiMinutes > l.baselineMinutes);
  const faster = levels.filter((l) => l.aiMinutes !== null && l.baselineMinutes !== null && l.aiMinutes <= l.baselineMinutes);
  if (levels.length > 0) {
    out.push({
      kind: 'observed',
      title: 'Results by task complexity',
      text: `${faster.length > 0 ? `AI-assisted tasks were faster at ${faster.map((l) => l.complexity).join(' and ')} complexity` : 'AI-assisted tasks were not faster at any complexity level'}${slower.length > 0 ? `; at ${slower.map((l) => l.complexity).join(' and ')} complexity they were slower (${slower.map((l) => `${formatDecimal(l.aiMinutes)} vs ${formatDecimal(l.baselineMinutes)} minutes`).join('; ')})` : ''}. Overall pass rate was ${formatPercent(cmp.ai.passRate)} AI-assisted vs ${formatPercent(cmp.baseline.passRate)} baseline (audited tasks only), and escalation was ${formatPercent(cmp.ai.escalationRate)} vs ${formatPercent(cmp.baseline.escalationRate)}.`,
    });
  }

  const trend = monthlyTrend(records, months, pilotTeams(records), assumptions);
  const pilotMonths = new Set(records.filter((r) => r.process === 'ai_assisted').map((r) => r.month));
  const prePilot = trend.filter((t) => !pilotMonths.has(t.month) && t.pilotMinutes !== null);
  if (prePilot.length > 0) {
    const pre = prePilot.reduce((n, t) => n + (t.pilotMinutes ?? 0), 0) / prePilot.length;
    out.push({
      kind: 'observed',
      title: 'Pilot teams before the pilot began',
      text: `In the ${prePilot.length} months before the pilot, the pilot teams averaged ${formatDecimal(pre)} minutes per task. The pilot teams volunteered and one received an easier task mix, so a before/after or pilot/comparison difference mixes the tool with team and mix effects. Treat the comparison as descriptive.`,
    });
  }

  const base = buildScenarioBase(records, assumptions);
  if (base !== null) {
    const all = estimateValue(base, defaultValueParams(base));
    const scoped = estimateValue(base, { ...defaultValueParams(base), complexities: ['low', 'medium'] });
    const scaled = estimateValue(base, { ...defaultValueParams(base), complexities: ['low', 'medium'], monthlyVolume: defaultValueParams(base).monthlyVolume * 10 });
    out.push({
      kind: 'scenario',
      title: 'Break-even volume versus observed volume',
      text: `At the observed ${formatInteger(base.observedAiTasksPerMonth)} AI-assisted tasks per month, the estimated value of released capacity (${formatDecimal(all.capacityHoursPerMonth)} hours per month, valued at ${formatUsd(assumptions.laborRateUsdPerHour)} per hour) is ${formatUsd(all.estimatedGrossValueUsdPerMonth)} per month, against ${formatUsd(assumptions.softwareUsdPerMonth)} per month of software. Estimated break-even is about ${all.breakEvenAiTasksPerMonth === null ? 'not reachable' : `${formatInteger(all.breakEvenAiTasksPerMonth)} AI-assisted tasks per month`}. Routing only low and medium complexity to AI lowers that to about ${scoped.breakEvenAiTasksPerMonth === null ? 'not reachable' : formatInteger(scoped.breakEvenAiTasksPerMonth)}.`,
    });
    out.push({
      kind: 'scenario',
      title: 'Capacity released versus cash saved',
      text: `Labor value here is time valued at a fully loaded rate. Cash savings appear only if hours are actually removed from payroll or avoided spend. With none assumed, the cash view is ${formatUsd(all.cashNetUsdPerMonth)} per month (software and AI usage cost with no offset). At ten times the volume with low and medium tasks only, the estimated value view pays back in ${scaled.paybackMonthsEstimated === null ? 'no finite time' : `about ${formatDecimal(scaled.paybackMonthsEstimated, 0)} months`}; the cash view ${scaled.paybackMonthsCash === null ? 'does not pay back unless some capacity is converted to cash' : `pays back in about ${formatDecimal(scaled.paybackMonthsCash, 0)} months`}.`,
    });
  }

  const covered = base !== null && estimateValue(base, defaultValueParams(base)).estimatedNetValueUsdPerMonth >= 0;
  const slowerLevels = levels.filter((l) => l.aiMinutes !== null && l.baselineMinutes !== null && l.aiMinutes > l.baselineMinutes).map((l) => l.complexity);
  out.push({
    kind: 'recommendation',
    title: 'What to do next',
    text: [
      covered
        ? '1. At the observed volume the estimated value exceeds software cost, but confirm the comparison design before scaling (step 3).'
        : '1. Do not scale on these results alone: at the observed volume the estimated value of saved time does not cover the software cost.',
      slowerLevels.length > 0
        ? `2. Restrict AI assistance to the complexity levels where it was faster, and track ${slowerLevels.join(' and ')} complexity tasks separately (AI-assisted work was slower there).`
        : '2. Keep tracking results by complexity; AI-assisted work was not slower at any level in this data.',
      '3. Run a better-designed comparison (randomly assigned or matched teams, same task mix) before claiming time savings.',
      '4. Decide in advance how released capacity will be used (more throughput, backlog, avoided hiring); otherwise there is no cash saving to count.',
    ].join(' '),
  });
  return out;
}

/** One-paragraph summary of the full dataset, generated from computed values. */
/** "4.5 fewer minutes" / "1.2 more minutes" from a saving (positive = AI-assisted faster). */
function timeDiff(saved: number | null): string {
  if (saved === null) return 'an unknown number of minutes (not enough data)';
  return `${formatDecimal(Math.abs(saved))} ${saved >= 0 ? 'fewer' : 'more'} minutes`;
}

export function buildWorkflowExecutiveSummary(data: WorkflowDataset): string {
  const cmp = compareProcesses(data.records, data.records, data.assumptions);
  const base = buildScenarioBase(data.records, data.assumptions);
  const est = base === null ? null : estimateValue(base, defaultValueParams(base));
  return `Full dataset: ${formatInteger(cmp.baseline.tasks)} baseline and ${formatInteger(cmp.ai.tasks)} AI-assisted tasks. AI-assisted tasks took ${timeDiff(cmp.minutesSavedStandardized)} after adjusting for task mix (${timeDiff(cmp.minutesSavedRaw)} unadjusted), with a pass rate of ${formatPercent(cmp.ai.passRate)} versus ${formatPercent(cmp.baseline.passRate)}.${est === null ? '' : ` At the observed volume, the estimated value of released time is ${formatUsd(est.estimatedGrossValueUsdPerMonth)} per month against ${formatUsd(data.assumptions.softwareUsdPerMonth)} of software, and estimated break-even is ${est.breakEvenAiTasksPerMonth === null ? 'not reachable' : `about ${formatInteger(est.breakEvenAiTasksPerMonth)} AI-assisted tasks per month`}.`} The sections below show where the pilot helped, what volume and assumptions it needs to pay for itself, and why released time is not cash; all of it is a demonstration on synthetic data.`;
}
