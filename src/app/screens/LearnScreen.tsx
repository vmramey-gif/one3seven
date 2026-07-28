import { ArrowLeft } from 'lucide-react';
import { EducationFilm } from '../education/EducationFilm';
import { LESSONS, WORKER_RECORDS_LESSON } from '../education/lessons';

/**
 * /learn — public, worker-facing education. Short narrated films (intake voice) that teach process
 * and general rights while attorney/worker AI-fear is high. Doctrine: strictest no-conclude tier;
 * every line is vetted. Counsel review before heavy promotion. Currently ships one lesson.
 */
export function LearnScreen({ onBack }: { onBack?: () => void }) {
  const lesson = WORKER_RECORDS_LESSON;
  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
        <button
          type="button"
          onClick={onBack ?? (() => { window.location.href = '/'; })}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6A6D66] transition hover:text-[#1B2623]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#7C857F]">Learn · a short film</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-1.5 max-w-[24ch] text-[clamp(26px,4vw,40px)] font-medium leading-[1.08] text-[#1B2623]">
          {lesson.title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-[#5A5F58]">{lesson.blurb}</p>
        <p className="mt-1 text-[12px] text-[#9AA39B]">{lesson.minutes} min · narrated · captions &amp; transcript included</p>

        <div className="mt-7">
          <EducationFilm lesson={lesson} />
        </div>

        <div className="mt-10 rounded-[18px] border border-[#E4E5DE] bg-white p-6">
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[19px] font-medium text-[#1B2623]">Ready to put yours in order?</h2>
          <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-[#5A5F58]">
            Getting your records organized is the first step. It’s free, and the record is yours to keep.
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

        {LESSONS.length > 1 ? (
          <p className="mt-8 text-[12px] text-[#9AA39B]">More lessons coming soon.</p>
        ) : null}

        <p className="mt-10 border-t border-[#E4E5DE] pt-5 text-[11.5px] leading-relaxed text-[#8a8f88]">
          one3seven organizes and informs. It is not a law firm and does not provide legal advice. Nothing here decides
          anything about your situation — the legal judgment stays with you and any attorney you choose.
        </p>
      </div>
    </div>
  );
}
