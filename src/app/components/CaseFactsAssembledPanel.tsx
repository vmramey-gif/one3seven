import { useState } from 'react';
import { Check, ArrowRight, ChevronDown } from 'lucide-react';
import { type CaseTimelinePatternResult, describeSequence } from '../../services/caseTimelinePatterns';
import type { EmployerRecordCoverage } from '../../services/caEmployerRecordRequirements';
import type { GapDetectionResult } from '../../services/gapDetection';
import type { DamagesReport } from '../../services/damagesCalculator';

/**
 * Case Facts, Assembled — the firm-facing canvas, designed for TRIAGE not a data dump.
 *
 * Inverted pyramid: an at-a-glance strip (scan in 5 sec) → the sequence as the hero → everything
 * else collapsed behind one-line summaries (drill on demand). Every tile/summary is a FACT
 * (interval in days, counts, arithmetic) — the ordering guides the eye by neutral salience, it
 * NEVER scores, ranks, or concludes the case. Firm/attorney-facing, describe-the-record only.
 */

type CaseFactsAssembledPanelProps = {
  workerName: string;
  employer: string;
  employmentDates: string;
  proximity: CaseTimelinePatternResult;
  coverage: EmployerRecordCoverage;
  gaps: GapDetectionResult;
  damages: DamagesReport | null;
  /** Raw uploaded documents, for the category-organized "case folder" view. */
  documents?: Array<{ fileName?: string; category?: string }>;
  illustrative?: boolean;
};

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

function Tile({ value, label, tone }: { value: string; label: string; tone: 'sage' | 'orange' | 'ink' }) {
  const color = tone === 'orange' ? '#A8512B' : tone === 'sage' ? '#42574E' : '#1B2623';
  return (
    <div className="flex-1 rounded-[14px] border border-[#E3E7DF] bg-[#FBFBFA] px-3.5 py-3">
      <div style={SERIF} className="text-[26px] font-semibold leading-none" >
        <span style={{ color }}>{value}</span>
      </div>
      <div className="mt-1.5 text-[11px] font-medium leading-tight text-[#6A6D66]">{label}</div>
    </div>
  );
}

function Collapsible({
  summary,
  count,
  tone,
  children,
}: {
  summary: string;
  count?: string;
  tone: 'sage' | 'orange';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const chip = tone === 'orange' ? 'text-[#A8512B]' : 'text-[#42574E]';
  return (
    <div className="border-t border-[#E7EDE8]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="text-[14px] text-[#20242a]">
          {summary}
          {count ? <span className={`ml-2 font-semibold ${chip}`}>{count}</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 flex-none text-[#8a938c] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
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
  documents = [],
  illustrative = false,
}: CaseFactsAssembledPanelProps) {
  const currency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const tightest = proximity.closestIntervalDays;
  const sequenceEvents = proximity.events
    .filter((e) => e.role !== 'neutral' && e.parsedDate)
    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

  // The attorney's 5-second screen: adverse action? · nexus (proximity)? · SOL (most recent date)?
  const mostRecentDate = proximity.events
    .map((e) => e.parsedDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // Case folder — group documents by category ("organize by category, not chronology").
  const folders = documents.reduce<Record<string, string[]>>((acc, d) => {
    const cat = (d.category ?? 'Uncategorized').trim() || 'Uncategorized';
    (acc[cat] ??= []).push(d.fileName ?? 'Document');
    return acc;
  }, {});
  const folderEntries = Object.entries(folders).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="mx-auto max-w-[820px] rounded-[22px] border border-[#CBD6CF] bg-white p-6 shadow-[0_24px_70px_-30px_rgba(66,87,78,0.4)] sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div style={MONO} className="text-[10.5px] uppercase tracking-[0.16em] text-[#8a938c]">
            Case file — assembled for review
          </div>
          <h1 style={SERIF} className="mt-1.5 text-[24px] font-semibold leading-tight text-[#1B2623]">
            {workerName}
          </h1>
          <div className="mt-0.5 text-[13px] text-[#5E6B62]">
            {employer} · {employmentDates}
          </div>
        </div>
        {illustrative ? (
          <span className="rounded-full border border-[#D3DED6] bg-[#EFF3ED] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#42574E]">
            Illustrative example
          </span>
        ) : null}
      </div>

      {/* THE INTAKE SCREEN — mirrors the attorney's own 5-second triage: adverse action? · nexus? ·
          statute-of-limitations date? Facts only — the screen is the attorney's to run, not ours. */}
      <div style={MONO} className="mt-5 mb-2 text-[10px] uppercase tracking-[0.14em] text-[#8a938c]">
        The intake screen
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Tile value={`${proximity.adverseActions.length}`} label="adverse actions in the record" tone="orange" />
        <Tile
          value={tightest !== null ? `${tightest}d` : '—'}
          label="closest protected-activity → adverse-action gap"
          tone="orange"
        />
        <Tile
          value={mostRecentDate ? shortDate(mostRecentDate) : '—'}
          label="most recent dated event (for SOL review)"
          tone="ink"
        />
      </div>
      {/* Secondary row — supporting facts */}
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Tile value={`${coverage.onFileCount}/${coverage.items.length}`} label="required records on file" tone="sage" />
        {gaps.computable ? (
          <Tile value={`${gaps.undocumentedMonths}mo`} label="pay records not represented" tone="orange" />
        ) : null}
        {damages && damages.combinedEstimate > 0 ? (
          <Tile value={currency(damages.combinedEstimate)} label="wage exposure (arithmetic)" tone="ink" />
        ) : null}
      </div>

      {/* THE SEQUENCE — the hero. The story of the case is the four dates. */}
      <section className="mt-6">
        <div style={MONO} className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">
          The sequence
        </div>
        <div className="space-y-2.5">
          {sequenceEvents.map((e, i) => {
            const isAction = e.role === 'adverse_action';
            // Show the interval inline, right where the eye is, between activity and the next action.
            const seq = proximity.sequences.find((s) => s.action === e);
            return (
              <div key={i}>
                <div className="flex items-start gap-3">
                  <span className={`mt-[6px] h-2.5 w-2.5 flex-none rounded-full ${isAction ? 'bg-[#C2703F]' : 'bg-[#7C8B6F]'}`} />
                  <div className="min-w-0">
                    <span style={MONO} className="text-[11px] tracking-[0.06em] text-[#8a938c]">
                      {e.parsedDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="ml-2 text-[14.5px] font-medium text-[#20242a]">{e.title}</span>
                  </div>
                </div>
                {seq ? (
                  <div className="ml-[5px] flex items-center gap-2 border-l-2 border-dashed border-[#EBD9CD] py-1 pl-4">
                    <span className="rounded-full bg-[#FBF4EF] px-2 py-0.5 text-[11px] font-bold text-[#A8512B]">
                      {seq.intervalDays} days later
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* COLLAPSED DETAIL — drill on demand, never a dump */}
      <div className="mt-5">
        {folderEntries.length > 0 ? (
          <Collapsible summary="Case folder — organized by category" count={`${documents.length} documents`} tone="sage">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {folderEntries.map(([cat, files]) => (
                <div key={cat} className="rounded-[12px] border border-[#E3E7DF] bg-[#F7F9F5] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#42574E]">{cat}</span>
                    <span style={MONO} className="text-[11px] text-[#8a938c]">{files.length}</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {files.map((f, i) => (
                      <li key={i} className="truncate text-[11.5px] text-[#5E6B62]">{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Collapsible>
        ) : null}

        <Collapsible
          summary="Records to request in discovery"
          count={`${coverage.toObtain.length} missing`}
          tone="orange"
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {coverage.toObtain.map((it) => (
              <span key={it.key} className="rounded-[8px] border border-[#EBD9CD] bg-[#FBF4EF] px-2 py-1 text-[11.5px] text-[#8B4A2B]">
                {it.label} <span className="text-[#B98A72]">· {it.citation}</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {coverage.items
              .filter((i) => i.state === 'on_file')
              .map((it) => (
                <div key={it.key} className="flex items-center gap-2 text-[12px] text-[#5E6B62]">
                  <Check className="h-3 w-3 flex-none text-[#42574E]" strokeWidth={3} /> {it.label} — on file
                </div>
              ))}
          </div>
        </Collapsible>

        {gaps.computable ? (
          <Collapsible
            summary="Pay-record coverage"
            count={`${gaps.documentedPeriods} of ~${gaps.estimatedPeriods} periods`}
            tone="orange"
          >
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#EFF1EC]">
              {gaps.segments.map((s, i) => (
                <div
                  key={i}
                  style={{ width: `${(s.periodCount / gaps.estimatedPeriods) * 100}%` }}
                  className={s.covered ? 'bg-[#7C8B6F]' : 'bg-[#C2703F]'}
                />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[#5E6B62]">
              About {gaps.undocumentedMonths} months of pay records aren't in the file yet.
            </p>
          </Collapsible>
        ) : null}

        {damages && damages.combinedEstimate > 0 ? (
          <Collapsible summary="Wage exposure — arithmetic" count={currency(damages.combinedEstimate)} tone="sage">
            <div className="space-y-1 text-[12.5px] text-[#5E6B62]">
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
            <p className="mt-2 text-[11px] italic leading-relaxed text-[#8a938c]">
              Arithmetic from values stated in the records — not a determination of liability, recoverable amount, or merit.
            </p>
          </Collapsible>
        ) : null}
      </div>

      {/* Footer — the firm value prop + doctrine */}
      <div className="mt-6 rounded-[14px] bg-[#42574E] p-4">
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
