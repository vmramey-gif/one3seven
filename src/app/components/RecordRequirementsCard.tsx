import { Check, FileText, ChevronRight } from 'lucide-react';
import type { EmployerRecordCoverage } from '../../services/caEmployerRecordRequirements';

/**
 * Worker-facing surface for the CA record-requirements engine.
 *
 * DOCTRINE: describes the record only — what's organized in the worker's file vs. commonly requested
 * employment records. Never says a law was broken or the worker was wronged. Sage = on file, burnt
 * orange = the gap (problem state). The visible disclaimer is both honest and protective.
 *
 * NO PER-ITEM CITATION: this component must never render a coverage item's `citation` field. The underlying engine
 * (caEmployerRecordRequirements.ts) still computes it for the counsel-gated attorney-facing surfaces
 * (Decision Card / Element Lens / firm PDF) — pairing a specific statute with a specific worker's
 * specific gap, directly to an unrepresented worker, is the exact combination that reads as
 * individualized legal advice rather than legal information. See feedback_verify_statute_citations_primary_source
 * and the RecordRequirementsCard redesign discussion for the reasoning.
 */

type RecordRequirementsCardProps = {
  coverage: EmployerRecordCoverage;
  onRequestRecords?: () => void;
  className?: string;
};

export function RecordRequirementsCard({
  coverage,
  onRequestRecords,
  className = '',
}: RecordRequirementsCardProps) {
  const { items, onFileCount, toObtain } = coverage;
  if (items.length === 0) return null;

  return (
    <div className={`rounded-[20px] border border-[#CBD6CF] bg-white/95 p-5 shadow-[0_16px_42px_rgba(91,53,213,0.07)] ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[#1B2623]">Records organized in your file</span>
        <span className="rounded-full bg-[#EFF1EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5E6B62]">
          Not legal advice
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#5E6B62]">
        Commonly requested employment records, and what we’ve organized from your file so far —{' '}
        <span className="font-semibold text-[#42574E]">{onFileCount} of {items.length}</span>.
      </p>

      {/* The list — on file (sage) vs not in your file yet (orange). No verdicts. */}
      <div className="mt-4 flex flex-col gap-1.5">
        {items.map((it) => {
          const present = it.state === 'on_file';
          return (
            <div
              key={it.key}
              className={`flex items-start gap-3 rounded-[12px] border px-3 py-2.5 ${
                present ? 'border-[#E7EDE8] bg-[#F7F9F5]' : 'border-[#EBD9CD] bg-[#FBF4EF]'
              }`}
            >
              <span
                className={`mt-[1px] flex h-5 w-5 flex-none items-center justify-center rounded-full ${
                  present ? 'bg-[#E7EDE8] text-[#42574E]' : 'bg-[#F0DDD0] text-[#A8512B]'
                }`}
              >
                {present ? <Check className="h-3 w-3" strokeWidth={2.75} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#A8512B]" />}
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium leading-snug text-[#20242a]">{it.label}</div>
                <div className="text-[11px] leading-snug text-[#8a938c]">
                  {present
                    ? 'In your file'
                    : it.state === 'worker_stated_missing'
                      ? 'You noted you never received this'
                      : 'Not in your file yet'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The flip side of the gaps: records the worker can request. */}
      {toObtain.length > 0 && onRequestRecords ? (
        <button
          type="button"
          onClick={onRequestRecords}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--o3s-action)] px-4 py-3.5 text-left text-white transition hover:brightness-95"
        >
          <span className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-none" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">
                Prepare a request for the {toObtain.length} record{toObtain.length === 1 ? '' : 's'} not in your file
              </span>
              <span className="block text-[12.5px] leading-snug text-white/75">
                We’ll prepare a draft for you to review and send.
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none" />
        </button>
      ) : null}

      <p className="mt-3.5 border-t border-[#EFF1EC] pt-3 text-[11px] leading-relaxed text-[#8a938c]">
        This shows employment records we’ve organized from your uploads and records that may be useful
        to gather. It doesn’t determine whether any record was legally required or whether anything was
        done wrong. An attorney can review what the records mean for your situation.
      </p>
    </div>
  );
}
