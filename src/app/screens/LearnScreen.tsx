import { ArrowLeft } from 'lucide-react';
import { EducationFilm } from '../education/EducationFilm';
import { WORKER_RECORDS_LESSON, FIRM_VALUE_LESSON } from '../education/lessons';

/**
 * Education films — narrated (intake voice). Audience is decided by the ROUTE, never by an in-page
 * toggle: a worker on the public surface must have no path into firm-side material. main.tsx mounts
 * this as WORKER at /learn (public) and FIRM at /firm-learn (used only from firm/CRM contexts, not
 * linked from any worker screen). Worker film is the strictest no-conclude tier; the firm film may
 * quote business ROI (never a worker's claim value). Counsel review before heavy promotion.
 */
export function LearnScreen({ audience = 'worker' }: { audience?: 'worker' | 'firm' }) {
  const isFirm = audience === 'firm';
  const lesson = isFirm ? FIRM_VALUE_LESSON : WORKER_RECORDS_LESSON;

  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
        <button
          type="button"
          onClick={() => { window.location.href = isFirm ? '/for-firms' : '/'; }}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6A6D66] transition hover:text-[#1B2623]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#7C857F]">
          Learn · a short film{isFirm ? ' · for firms' : ''}
        </p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-1.5 max-w-[24ch] text-[clamp(26px,4vw,40px)] font-medium leading-[1.08] text-[#1B2623]">
          {lesson.title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-[#5A5F58]">{lesson.blurb}</p>
        <p className="mt-1 text-[12px] text-[#9AA39B]">{lesson.minutes} min · narrated · captions &amp; transcript included</p>

        <div className="mt-7">
          <EducationFilm lesson={lesson} />
        </div>

        {isFirm ? (
          <div className="mt-10 rounded-[18px] border border-[#E4E5DE] bg-white p-6">
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[19px] font-medium text-[#1B2623]">See it on a real intake.</h2>
            <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-[#5A5F58]">
              A 15-minute walkthrough on one of your own files — the source-linked record, the coverage map, the minutes it takes to screen.
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = '/for-firms'; }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#42574E] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#374a42]"
            >
              Book the 15-minute review
            </button>
          </div>
        ) : (
          <div className="mt-10 rounded-[18px] border border-[#E4E5DE] bg-white p-6">
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[19px] font-medium text-[#1B2623]">Ready to put yours in order?</h2>
            <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-[#5A5F58]">
              Getting your records organized is the first step. It is free, and the record is yours to keep — forever.
            </p>
            <button
              type="button"
              onClick={() => {
                try { sessionStorage.setItem('o3s_worker_cta', 'start'); } catch { /* ignore */ }
                window.location.href = '/';
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#42574E] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#374a42]"
            >
              Start organizing — free
            </button>
          </div>
        )}

        <p className="mt-10 border-t border-[#E4E5DE] pt-5 text-[11.5px] leading-relaxed text-[#8a8f88]">
          one3seven organizes and informs. It is not a law firm and does not provide legal advice. Every figure shown is an
          illustrative, firm-editable assumption, not a proven benchmark. Nothing here decides anything about any situation —
          the legal judgment stays with the attorney.
        </p>
      </div>
    </div>
  );
}
