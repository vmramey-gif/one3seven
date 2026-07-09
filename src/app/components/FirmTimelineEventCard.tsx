import { useState } from 'react';
import { FileText } from 'lucide-react';
import { FIRM_INTAKE_ACTIONS } from '../constants/firmIntakePresentation';
import { polishFirmFacingProse, polishFirmFacingText } from '../../services/firmIntakeDisplay';

export type FirmTimelineEventCardProps = {
  date: string;
  category: string;
  title: string;
  summary: string;
  relatedDocs: number;
  relatedDocLabels: string[];
  important?: boolean;
  /** When false, a connecting timeline rail is drawn from this node down to the next event. */
  isLast?: boolean;
};

export function FirmTimelineEventCard({
  date,
  category,
  title,
  summary,
  relatedDocs,
  relatedDocLabels,
  important = false,
  isLast = false,
}: FirmTimelineEventCardProps) {
  const [open, setOpen] = useState(false);
  const labels = relatedDocLabels.slice(0, 6);

  // If date is the "unclear" sentinel, try to infer a year from the summary's file references
  const resolveDisplayDate = (): string => {
    const raw = polishFirmFacingText(date);
    if (raw && !/date unclear|date to confirm/i.test(raw)) return raw;
    // Try to extract a year from filenames mentioned in the summary or labels
    const searchText = [summary, ...relatedDocLabels].join(' ');
    const yearMatch = searchText.match(/(20\d{2})/);
    if (yearMatch) return yearMatch[1];
    return 'Date unclear';
  };
  const displayDate = resolveDisplayDate();
  const dateIsInferred = /^\d{4}$/.test(displayDate);
  const dateIsUnclear = /date unclear/i.test(displayDate);
  const displayCategory = polishFirmFacingText(category) || 'Record context';
  // Strip raw email headers that sometimes leak into AI-generated titles
  const sanitizeTitle = (raw: string): string => {
    return raw
      .replace(/\s*\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, '') // (email@domain.com)
      .replace(/\bFROM:\s*[^\s]+/gi, '')
      .replace(/\bTO:\s*[^\s]+/gi, '')
      .replace(/\bSUBJECT:\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };
  const displayTitle = sanitizeTitle(polishFirmFacingText(title)) || 'Timeline event';
  const displaySummary = polishFirmFacingProse(summary);
  const hasLongSummary = displaySummary.length > 120;
  const hasSupportingRecords = relatedDocs > 0;
  const canExpand = hasLongSummary || hasSupportingRecords;

  const confidenceLabel = (() => {
    if (hasSupportingRecords) return 'Record-grounded';
    if (!dateIsUnclear) return 'Worker-reported';
    return null;
  })();

  return (
    <div className="relative flex gap-4">
      <div className="relative flex-shrink-0 pt-1">
        {!isLast ? (
          <div
            className="absolute left-1/2 top-[2.75rem] -bottom-6 w-[2px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#D9CEFF] to-[#EFEAFF]"
            aria-hidden="true"
          />
        ) : null}
        <div
          className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center ${
            important
              ? 'border-[#42574E] bg-[#F1ECFF]'
              : 'border-[#CBD6CF] bg-white'
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${important ? 'bg-[#42574E]' : 'bg-[#B8A8FF]'}`} />
        </div>
      </div>
      <div className="min-w-0 flex-1 rounded-2xl border border-[#D3DED6] bg-white/95 p-5 shadow-[0_16px_46px_rgba(31,27,75,0.09)]">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#42574E]">
            {displayDate}
            {dateIsInferred ? <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-[#42574E]/55">(year from filename)</span> : null}
          </span>
          <span className="rounded-md border border-[#D3DED6] bg-[#F7F3FF] px-2 py-0.5 text-[11px] text-[#1E1B4B]/62">
            {displayCategory}
          </span>
          {confidenceLabel ? (
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              confidenceLabel === 'Record-grounded'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${confidenceLabel === 'Record-grounded' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {confidenceLabel}
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-[#1E1B4B]/50">
            <FileText className="w-3 h-3" />
            {relatedDocs} supporting {relatedDocs === 1 ? 'record' : 'records'}
          </span>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-[#1E1B4B] break-words overflow-hidden">{displayTitle}</h3>
        <p className={`text-sm text-[#1E1B4B]/68 leading-relaxed whitespace-pre-wrap break-words ${!open && hasLongSummary ? 'line-clamp-3' : ''}`}>{displaySummary}</p>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-xs font-medium text-[#374A42] hover:text-[#1E1B4B]"
          >
            {open ? FIRM_INTAKE_ACTIONS.showLess : FIRM_INTAKE_ACTIONS.showMore}
          </button>
        ) : null}
        {hasSupportingRecords && open ? (
          <div className="pt-3 mt-3 border-t border-[#D3DED6]">
            <div className="text-[11px] text-[#1E1B4B]/50 mb-2">Supporting Records</div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <span
                  key={label}
                  className="max-w-[200px] truncate px-2 py-1 bg-[#F7F3FF] text-[11px] text-[#1E1B4B]/68 rounded border border-[#D3DED6]"
                  title={label.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
                >
                  {label.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
                </span>
              ))}
              {relatedDocLabels.length === 0 ? (
                <span className="max-w-full break-words px-2 py-1 bg-[#F7F3FF] text-[11px] text-[#1E1B4B]/68 rounded border border-[#D3DED6]">
                  {relatedDocs} record{relatedDocs === 1 ? '' : 's'} in this category
                </span>
              ) : null}
              {relatedDocLabels.length > 6 ? (
                <span className="max-w-full break-words px-2 py-1 text-[11px] text-[#1E1B4B]/45">
                  +{relatedDocLabels.length - 6} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
