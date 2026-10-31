import { Badge } from '@/components/ui/badge';
import { FINDING_KIND_LABEL, type Finding, type FindingKind } from '@/projects/findings';

const ORDER: FindingKind[] = ['observed', 'scenario', 'recommendation'];

/**
 * Findings, scenario estimates, and recommendations stay visibly separate. Each group is introduced by a text label
 * (not just a colour), and the panel says these statements describe the FULL dataset, not the current filters.
 */
export function FindingsPanel({ findings }: { findings: readonly Finding[] }) {
  return (
    <div className="space-y-8">
      <p className="max-w-prose text-sm text-muted-foreground">
        These statements are computed from the <strong className="text-foreground">full dataset</strong>, not from the filters above. Patterns in synthetic data were seeded to demonstrate methods; they are not independent empirical discoveries.
      </p>
      {ORDER.map((kind) => {
        const group = findings.filter((f) => f.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <Badge tone={kind === 'recommendation' ? 'accent' : 'neutral'}>{FINDING_KIND_LABEL[kind]}</Badge>
            <ul className="mt-3 space-y-5">
              {group.map((finding) => (
                <li key={finding.title}>
                  <h3 className="text-lg font-semibold">{finding.title}</h3>
                  <p className="mt-1 max-w-prose">{finding.text}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
