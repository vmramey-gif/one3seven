import { Check, FileText, ChevronRight } from 'lucide-react';
import type { EmployerRecordCoverage } from '../../services/caEmployerRecordRequirements';

/**
 * Worker-facing surface for the CA record-requirements engine.
 *
 * DOCTRINE: describes the record only — what CA generally requires employers to keep vs. what's in
 * the worker's file. Never says a law was broken or the worker was wronged. Sage = on file,
 * burnt orange = the gap (problem state). The visible disclaimer is both honest and protective.
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
        <span className="text-[13px] font-semibold text-[#1B2623]">What’s on file vs. what’s required</span>
        <span className="rounded-full bg-[#EFF1EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5E6B62]">
          Not legal advice
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#5E6B62]">
        California requires employers to keep and provide certain records. Here’s what’s in your file
        so far — <span className="font-semibold text-[#42574E]">{onFileCount} of {items.length}</span>.
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
                  <span className="text-[#b3bab0]"> · {it.citation}</span>
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
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-[#42574E] px-4 py-3.5 text-left text-white transition hover:bg-[#374A42]"
        >
          <span className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-none" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">
                Request the {toObtain.length} record{toObtain.length === 1 ? '' : 's'} not in your file
              </span>
              <span className="block text-[12.5px] leading-snug text-white/75">
                California lets you request these. We’ll write the letter.
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none" />
        </button>
      ) : null}

      <p className="mt-3.5 border-t border-[#EFF1EC] pt-3 text-[11px] leading-relaxed text-[#8a938c]">
        This compares your file to records California generally requires employers to keep. It isn’t
        legal advice and doesn’t determine that anything was done wrong — an attorney reviews what it means.
      </p>
    </div>
  );
}
