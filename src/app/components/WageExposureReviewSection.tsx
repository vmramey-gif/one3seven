import type { DamagesReport, DamagesLineItem, SourceCitation } from '../../services/damagesCalculator';
import { CitationLink, StatutoryRef } from './CitationLink';

const BRAND = '#5B21B6';
const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * On-screen wage-exposure estimate for the attorney review UI (section 8B equivalent).
 * Firm-only. Figures with a source document are wrapped in CitationLink (opens CitationPanel);
 * statutory figures use StatutoryRef tooltips. Copy is constrained to neutral terms.
 * Themed entirely via CSS variables; #5B21B6 is the only intentional hardcoded color.
 */
export function WageExposureReviewSection({
  wage,
  onOpenCitation,
}: {
  wage: { report: DamagesReport; disclaimer: string[] };
  onOpenCitation: (citation: SourceCitation) => void;
}) {
  const r = wage.report;

  const ValueOrCitation = ({ item, text }: { item: DamagesLineItem; text: string }) =>
    item.citation ? (
      <CitationLink citation={item.citation} onOpen={onOpenCitation}>
        {text}
      </CitationLink>
    ) : (
      <span className="font-medium">{text}</span>
    );

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span style={{ color: 'var(--o3s-muted, #6b7280)' }}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );

  return (
    <section
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--o3s-border, #e7e1ff)', background: 'var(--o3s-surface, #fff)', color: 'var(--o3s-text, #1e1b4b)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-base font-semibold">Wage exposure estimate</h3>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: 'var(--o3s-primary-soft, #f3efff)', color: BRAND }}
        >
          calculated from records
        </span>
      </div>

      {r.baseHourlyRate ? (
        <Row label={r.baseHourlyRate.label} value={<ValueOrCitation item={r.baseHourlyRate} text={money(r.baseHourlyRate.value)} />} />
      ) : null}

      {r.overtimeRate && r.overtimePremiumPerHour && r.overtimeHoursUnderpaid ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--o3s-muted, #6b7280)' }}>Overtime</p>
          <Row
            label={r.overtimeRate.label}
            value={<StatutoryRef refText={r.overtimeRate.statutoryRef ?? ''}>{money(r.overtimeRate.value)}</StatutoryRef>}
          />
          <Row
            label={r.overtimePremiumPerHour.label}
            value={<StatutoryRef refText={r.overtimePremiumPerHour.statutoryRef ?? ''}>{money(r.overtimePremiumPerHour.value)}</StatutoryRef>}
          />
          <Row label={r.overtimeHoursUnderpaid.label} value={<ValueOrCitation item={r.overtimeHoursUnderpaid} text={`${r.overtimeHoursUnderpaid.value} hrs`} />} />
          <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--o3s-border, #e7e1ff)' }}>
            <Row label="Estimated overtime premium" value={<span className="font-semibold" style={{ color: BRAND }}>{money(r.overtimeTotalEstimate)}</span>} />
          </div>
        </div>
      ) : null}

      {r.mealBreaksMissed && r.mealBreakPremiumPerBreak ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--o3s-muted, #6b7280)' }}>Meal breaks</p>
          <Row label={r.mealBreaksMissed.label} value={<ValueOrCitation item={r.mealBreaksMissed} text={`${r.mealBreaksMissed.value}`} />} />
          <Row
            label={r.mealBreakPremiumPerBreak.label}
            value={<StatutoryRef refText={r.mealBreakPremiumPerBreak.statutoryRef ?? ''}>{money(r.mealBreakPremiumPerBreak.value)}</StatutoryRef>}
          />
          <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--o3s-border, #e7e1ff)' }}>
            <Row label="Estimated meal-break premium" value={<span className="font-semibold" style={{ color: BRAND }}>{money(r.mealBreakTotalEstimate)}</span>} />
          </div>
        </div>
      ) : null}

      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--o3s-border, #e7e1ff)' }}>
        <Row
          label="Combined estimate"
          value={<span className="text-base font-bold" style={{ color: BRAND }}>{money(r.combinedEstimate)}</span>}
        />
      </div>

      {r.isPartialData && r.missingRecordsWarning ? (
        <p
          className="mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed"
          style={{ borderColor: 'var(--o3s-border, #e7e1ff)', color: 'var(--o3s-muted, #6b7280)' }}
        >
          <span className="font-semibold">Incomplete records.</span> {r.missingRecordsWarning}
        </p>
      ) : null}

      <div className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--o3s-muted, #6b7280)' }}>
        {wage.disclaimer.map((d, i) => (
          <p key={i}>{d}</p>
        ))}
      </div>
    </section>
  );
}
