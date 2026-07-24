import { Check, ArrowRight, FileText } from 'lucide-react';
import { type CaseTimelinePatternResult, describeSequence } from '../../services/caseTimelinePatterns';
import type { EmployerRecordCoverage } from '../../services/caEmployerRecordRequirements';
import type { GapDetectionResult } from '../../services/gapDetection';
import type { DamagesReport } from '../../services/damagesCalculator';

/**
 * Case Facts, Assembled — the firm-facing canvas. Assembles all four factual engines (proximity /
 * the four dates · record coverage + discovery list · pay-record gaps · wage-exposure arithmetic)
 * into the attorney's own intake worksheet, pre-filled with FACTS.
 *
 * DOCTRINE: describes the record — dates, intervals, coverage, arithmetic. NEVER concludes a claim,
 * a violation, a merit, or a value. Firm/attorney-facing (the audience that applies the law).
 * The proximity juxtaposition states the interval as a fact; it never labels it retaliation.
 */

type CaseFactsAssembledPanelProps = {
  workerName: string;
  employer: string;
  employmentDates: string;
  proximity: CaseTimelinePatternResult;
  coverage: EmployerRecordCoverage;
  gaps: GapDetectionResult;
  damages: DamagesReport | null;
  illustrative?: boolean;
};

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#42574E] text-[12px] font-bold text-white">
        {n}
      </span>
      <span style={MONO} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">
        {title}
      </span>
    </div>
  );
}

export function CaseFactsAssembledPanel({
  workerName,
  employer,
  employmentDates,
  proximity,
  coverage,
  gaps,
  damages,
  illustrative = false,
}: CaseFactsAssembledPanelProps) {
  const currency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="mx-auto max-w-[820px] rounded-[22px] border border-[#CBD6CF] bg-white p-6 shadow-[0_24px_70px_-30px_rgba(66,87,78,0.4)] sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7EDE8] pb-5">
        <div className="min-w-0">
          <div style={MONO} className="text-[10.5px] uppercase tracking-[0.16em] text-[#8a938c]">
            Case file — assembled for review
          </div>
          <h1 style={SERIF} className="mt-1.5 text-[26px] font-semibold leading-tight text-[#1B2623]">
            {workerName}
          </h1>
          <div className="mt-0.5 text-[13.5px] text-[#5E6B62]">
            {employer} · {employmentDates}
          </div>
        </div>
        {illustrative ? (
          <span className="rounded-full border border-[#D3DED6] bg-[#EFF3ED] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#42574E]">
            Illustrative example
          </span>
        ) : null}
      </div>

      {/* 1 — THE SEQUENCE (proximity / the four dates) — the money shot */}
      <section className="border-b border-[#E7EDE8] py-6">
        <SectionLabel n={1} title="The sequence" />
        <div className="space-y-2">
          {proximity.events
            .filter((e) => e.role !== 'neutral' && e.parsedDate)
            .sort((a, b) => (a.parsedDate!.getTime() - b.parsedDate!.getTime()))
            .map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className={`mt-[6px] h-2 w-2 flex-none rounded-full ${
                    e.role === 'adverse_action' ? 'bg-[#C2703F]' : 'bg-[#7C8B6F]'
                  }`}
                />
                <div className="min-w-0">
                  <span style={MONO} className="text-[11px] tracking-[0.06em] text-[#8a938c]">
                    {e.parsedDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="ml-2 text-[14px] font-medium text-[#20242a]">{e.title}</span>
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
                      e.role === 'adverse_action' ? 'bg-[#FBF4EF] text-[#A8512B]' : 'bg-[#EFF3ED] text-[#42574E]'
                    }`}
                  >
                    {e.role === 'adverse_action' ? 'action' : 'activity'}
                  </span>
                </div>
              </div>
            ))}
        </div>
        {proximity.sequences.length > 0 ? (
          <div className="mt-4 rounded-[14px] border border-[#EBD9CD] bg-[#FBF4EF] p-3.5">
            <div style={MONO} className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A8512B]">
              Interval between protected activity and adverse action
            </div>
            {proximity.sequences.map((s, i) => (
              <p key={i} className="text-[13.5px] leading-relaxed text-[#20242a]">
                {describeSequence(s)}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      {/* 2 — RECORD COVERAGE + discovery list */}
      <section className="border-b border-[#E7EDE8] py-6">
        <SectionLabel n={2} title="Record coverage" />
        <p className="mb-3 text-[13.5px] text-[#5E6B62]">
          Records California requires an employer to keep/provide:{' '}
          <span className="font-semibold text-[#42574E]">{coverage.onFileCount} of {coverage.items.length}</span> on file.
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {coverage.items.map((it) => {
            const present = it.state === 'on_file';
            return (
              <div key={it.key} className="flex items-center gap-2 text-[12.5px]">
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-full ${
                    present ? 'bg-[#E7EDE8] text-[#42574E]' : 'bg-[#F0DDD0] text-[#A8512B]'
                  }`}
                >
                  {present ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-[#A8512B]" />}
                </span>
                <span className={present ? 'text-[#20242a]' : 'text-[#8B4A2B]'}>{it.label}</span>
              </div>
            );
          })}
        </div>
        {coverage.toObtain.length > 0 ? (
          <div className="mt-4 rounded-[14px] border border-[#CBD6CF] bg-[#F7F9F5] p-3.5">
            <div style={MONO} className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#42574E]">
              <FileText className="h-3.5 w-3.5" /> Records to request in discovery
            </div>
            <div className="flex flex-wrap gap-1.5">
              {coverage.toObtain.map((it) => (
                <span key={it.key} className="rounded-[8px] border border-[#D3DED6] bg-white px-2 py-1 text-[11.5px] text-[#40433f]">
                  {it.label} <span className="text-[#9aa39b]">· {it.citation}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* 3 — PAY-RECORD COVERAGE (gap detection) */}
      {gaps.computable ? (
        <section className="border-b border-[#E7EDE8] py-6">
          <SectionLabel n={3} title="Pay-record coverage" />
          <div className="flex items-baseline gap-2">
            <span style={SERIF} className="text-[30px] font-semibold text-[#A8512B]">
              {gaps.undocumentedMonths}
            </span>
            <span className="text-[14px] text-[#5E6B62]">
              months of pay records not represented ·{' '}
              <span className="font-medium text-[#42574E]">{gaps.documentedPeriods}</span> of ~{gaps.estimatedPeriods} pay periods on file
            </span>
          </div>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[#EFF1EC]">
            {gaps.segments.map((s, i) => (
              <div
                key={i}
                style={{ width: `${(s.periodCount / gaps.estimatedPeriods) * 100}%` }}
                className={s.covered ? 'bg-[#7C8B6F]' : 'bg-[#C2703F]'}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 4 — WAGE EXPOSURE (arithmetic) */}
      {damages && damages.combinedEstimate > 0 ? (
        <section className="py-6">
          <SectionLabel n={4} title="Wage exposure (arithmetic)" />
          <div className="rounded-[14px] border border-[#CBD6CF] bg-[#F7F9F5] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13.5px] font-medium text-[#40433f]">Estimated from stated record values</span>
              <span style={SERIF} className="text-[24px] font-semibold text-[#1B2623]">
                {currency(damages.combinedEstimate)}
              </span>
            </div>
            <div className="mt-2 space-y-1 border-t border-[#E7EDE8] pt-2 text-[12px] text-[#5E6B62]">
              {damages.overtimeTotalEstimate > 0 ? (
                <div className="flex justify-between">
                  <span>Overtime premium (§510)</span>
                  <span className="font-medium text-[#40433f]">{currency(damages.overtimeTotalEstimate)}</span>
                </div>
              ) : null}
              {damages.mealBreakTotalEstimate > 0 ? (
                <div className="flex justify-between">
                  <span>Meal/rest premium (§226.7)</span>
                  <span className="font-medium text-[#40433f]">{currency(damages.mealBreakTotalEstimate)}</span>
                </div>
              ) : null}
            </div>
            <p className="mt-2.5 text-[11px] italic leading-relaxed text-[#8a938c]">
              Arithmetic from values stated in the records — not a determination of liability, recoverable amount, or merit.
            </p>
          </div>
        </section>
      ) : null}

      {/* Footer — the firm value prop + doctrine */}
      <div className="mt-2 rounded-[14px] bg-[#42574E] p-4">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
          <ArrowRight className="h-4 w-4 flex-none" /> Your first intake meeting, already done.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#D3DED6]">
          one3seven organized these facts from the worker's own records. It does not evaluate the claim, score the
          case, or draw legal conclusions — every fact links to its source; your team decides what it means.
        </p>
      </div>
    </div>
  );
}
