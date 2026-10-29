/** Shared shape for written findings. Every statement is generated from computed values, never hand-typed numbers. */
export type FindingKind = 'observed' | 'scenario' | 'recommendation';

export interface Finding {
  kind: FindingKind;
  title: string;
  text: string;
}

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  observed: 'Observed in the synthetic data',
  scenario: 'Scenario estimate',
  recommendation: 'Recommendation',
};
