import { useState } from 'react';
import { FileText, ChevronRight, SlidersHorizontal } from 'lucide-react';
import {
  type GapDetectionResult,
  type PayFrequency,
  PAY_FREQUENCY_LABELS,
} from '../../services/gapDetection';

/**
 * Gap Detection — Layer 1 coverage rail.
 *
 * DOCTRINE ("describe the record, not the case"): every string here talks about the FILE —
 * what's present, what's missing, what can be requested. Never about the matter's strength,
 * value, or merit. All numbers are labeled ESTIMATED and the worker can correct the inputs.
 * Burnt orange marks the gap (the problem state); sage marks documented coverage.
 */

type GapCoverageRailProps = {
  result: GapDetectionResult;
  payFrequency: PayFrequency;
  onFrequencyChange?: (f: PayFrequency) => void;
  onRequestRecords?: () => void;
  className?: string;
};

const FREQ_OPTIONS: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

export function GapCoverageRail({
  result,
  payFrequency,
  onFrequencyChange,
  onRequestRecords,
  className = '',
}: GapCoverageRailProps) {
  const [adjustOpen, setAdjustOpen] = useState(false);

  if (!result.computable) {
    return (
      <div className={`rounded-[20px] border border-[#CBD6CF] bg-white/95 p-5 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#1B2623]">Pay-record coverage</span>
          <EstimatedChip />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#5E6B62]">
          Add your employment start and end dates and we can estimate how much of your pay record
          is in your file — and what’s missing.
        </p>
      </div>
    );
  }

  const { estimatedPeriods, documentedPeriods, undocumentedPeriods, segments, gapSegments } = result;
  const totalPeriods = segments.reduce((n, s) => n + s.periodCount, 0) || 1;

  return (
    <div className={`rounded-[20px] border border-[#CBD6CF] bg-white/95 p-5 shadow-[0_16px_42px_rgba(91,53,213,0.07)] ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[#1B2623]">Pay-record coverage</span>
        <EstimatedChip />
      </div>

      {/* The reveal — calculated expectation, observed coverage, stated separately. */}
      <p className="mt-3 text-[15px] leading-relaxed text-[#20242a]">
        About{' '}
        <span className="font-semibold text-[#1B2623]">{estimatedPeriods} pay periods</span> fall
        within the dates you entered. Records covering{' '}
        <span className="font-semibold text-[#42574E]">{documentedPeriods}</span> are in your file.
      </p>
      {undocumentedPeriods > 0 ? (
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#8B4A2B]">
          <span className="font-semibold text-[#A8512B]">{undocumentedPeriods}</span> aren’t
          represented yet.
        </p>
      ) : (
        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-[#42574E]">
          Every estimated period is represented. 🌱
        </p>
      )}

      {/* Coverage rail — sage = documented, burnt orange = gap. */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[#EFF1EC]" aria-hidden>
        {segments.map((s, i) => (
          <div
            key={i}
            title={`${s.label} — ${s.covered ? 'in your file' : 'not represented'}`}
            style={{ width: `${(s.periodCount / totalPeriods) * 100}%` }}
            className={s.covered ? 'bg-[#7C8B6F]' : 'bg-[#C2703F]'}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-4 text-[11px] text-[#6A6D66]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#7C8B6F]" /> In your file
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#C2703F]" /> Not represented yet
        </span>
      </div>

      {/* Gap ranges, inspectable as chips. */}
      {gapSegments.length > 0 ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A8512B]">
            Periods not represented
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gapSegments.map((s, i) => (
              <span
                key={i}
                className="rounded-[10px] border border-[#EBD9CD] bg-[#FBF4EF] px-2.5 py-1 text-[12px] text-[#8B4A2B]"
              >
                {s.label}
                <span className="text-[#B98A72]"> · {s.periodCount}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* CTA — routes to the existing self-help records request (correct per-statute deadlines live there). */}
      {undocumentedPeriods > 0 && onRequestRecords ? (
        <button
          type="button"
          onClick={onRequestRecords}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-[#42574E] px-4 py-3.5 text-left text-white transition hover:bg-[#374A42]"
        >
          <span className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-none" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">Request your missing pay records</span>
              <span className="block text-[12.5px] leading-snug text-white/75">
                California workers can request copies of their payroll records. We’ll write the letter.
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none" />
        </button>
      ) : null}

      {/* Correction control — the trust layer. Estimated, and the worker owns the inputs. */}
      <div className="mt-3 border-t border-[#EFF1EC] pt-3">
        <button
          type="button"
          onClick={() => setAdjustOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#5E6B62] transition hover:text-[#1B2623]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          These numbers are estimated — adjust if they’re off
        </button>
        {adjustOpen ? (
          <div className="mt-3 rounded-[14px] bg-[#F7F9F5] p-3.5">
            <label className="block text-[12px] font-medium text-[#40433f]">
              How often were you paid?
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FREQ_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFrequencyChange?.(f)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    f === payFrequency
                      ? 'bg-[#42574E] text-white'
                      : 'border border-[#CBD6CF] bg-white text-[#40433f] hover:border-[#7C8B6F]'
                  }`}
                >
                  {PAY_FREQUENCY_LABELS[f]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[#6A6D66]">
              The estimate can shift with unpaid leave, a pay-schedule change, or partial first and
              last periods. It’s a guide to what to gather — not a count of anything owed.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EstimatedChip() {
  return (
    <span className="rounded-full bg-[#EFF1EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5E6B62]">
      Estimated
    </span>
  );
}
