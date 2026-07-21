/**
 * SageMarketingPage — the live marketing homepage in the sage identity
 * (2026-07-08 brand). Light off-white + ink + cool sage accent; deep violet
 * (#5B21B6) reserved for AI-only moments; source-linked vertical timeline is
 * the signature. Props-compatible with the previous PublicMarketingPage so
 * App's routing (worker/firm/sign-in/firm-directed intake) is unchanged.
 * Bilingual via i18n t().
 */
import { ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { useLang, LangToggle } from '../../i18n/i18n';
import { track } from '../../lib/analytics';
import { motion, useReducedMotion } from 'motion/react';

interface SageMarketingPageProps {
  onWorkerStart: () => void;
  onFirmStart: () => void;
  onSignIn: () => void;
  onSignUpFree: () => void;
  onForFirms: () => void;
  firmDirectedContext?: { firmId: string; firmName: string; firmCode: string } | null;
}

const SERIF = { fontFamily: '"Fraunces", Georgia, "Times New Roman", serif' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

// Entrance motion — a calm, staggered reveal (the page composes itself, like the product).
const heroContainer = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
const heroItem = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };

function TimelineCard({ t }: { t: (k: string) => string }) {
  const events = [
    { date: 'Nov 2025', title: t('tl.e1'), doc: 'Rivera_HR_Complaint.pdf' },
    { date: 'Dec 2025', title: t('tl.e2'), doc: 'Rivera_Warning_Dec2025.pdf' },
    { date: 'Jan 2026', title: t('tl.e3'), doc: 'Rivera_Termination.pdf' },
  ];
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="min-w-0 rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_30px_70px_-26px_rgba(46,64,56,0.35)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <span style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">{t('tl.header')}</span>
        <span style={MONO} className="rounded-full border border-[#C6D0C8] bg-[#E7EDE8] px-2.5 py-1 text-[10px] text-[#5B21B6]">{t('tl.ai')}</span>
      </div>
      <div className="relative">
        {/* signature rail draws down as the events organize themselves in */}
        <motion.span aria-hidden
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.85, ease: 'easeInOut', delay: 0.4 }}
          style={{ transformOrigin: 'top' }}
          className="absolute left-[5px] top-[4px] bottom-[20px] w-[2px] bg-[#CBD6CF]"
        />
        {events.map((e, i) => (
          <motion.div key={e.doc}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.55 + i * 0.2 }}
            className="flex gap-3.5"
          >
            <div className="relative w-3 flex-none">
              <span className="absolute left-[1px] top-[3px] h-2.5 w-2.5 rounded-full bg-[#42574E]" />
            </div>
            <div className={i < events.length - 1 ? 'pb-5' : ''}>
              <div style={MONO} className="text-[11px] text-[#7c857f]">{e.date}</div>
              <div className="mb-[7px] mt-px text-[14px] font-semibold text-[#20242a]">{e.title}</div>
              <span style={MONO} className="inline-flex items-center gap-2 rounded-[7px] border border-[#D3DED6] bg-[#E7EDE8] px-2.5 py-[3px] text-[10.5px] text-[#3c5049]">
                <span className="h-2.5 w-[7px] flex-none rounded-[1px] bg-[#42574E]" />
                {e.doc}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Hero-right feature card: source-linked extraction — a fact pulled from a document,
// shown with its verbatim quote and a clickable citation to the exact source page.
function ExtractionCard({ t }: { t: (k: string) => string }) {
  const reduce = useReducedMotion();
  const facts = [
    { from: t('ext.from_hr'), quote: '“…formally requesting a payroll audit covering October 2022 to present, specifically regarding overtime calculation and meal-break compensation.”', src: 'Rivera_HR_Complaint_Nov2025.pdf · p.1' },
    { from: t('ext.from_term'), quote: '“…the Company has determined that your continued employment is no longer consistent with our performance standards.”', src: 'Rivera_Termination.pdf · p.1' },
  ];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="min-w-0 rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_30px_70px_-26px_rgba(46,64,56,0.35)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <span style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">{t('ext.header')}</span>
        <span style={MONO} className="rounded-full border border-[#C6D0C8] bg-[#E7EDE8] px-2.5 py-1 text-[10px] text-[#5B21B6]">{t('tl.ai')}</span>
      </div>
      <div className="space-y-3.5">
        {facts.map((f, i) => (
          <motion.div key={i}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 + i * 0.22 }}
            className="rounded-xl border border-[#E4E5DE] bg-white p-3.5"
          >
            <div style={MONO} className="text-[10px] uppercase tracking-[0.1em] text-[#7c857f]">{f.from}</div>
            <p className="mt-1.5 border-l-2 border-[#CBD6CF] pl-3 text-[12.5px] italic leading-relaxed text-[#20242a]">{f.quote}</p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#42574E]">
              <FileText className="h-3.5 w-3.5 flex-none" />
              <span style={MONO} className="min-w-0 truncate text-[10.5px] text-[#3c5049]">{f.src}</span>
              <span className="ml-auto inline-flex flex-none items-center gap-0.5 whitespace-nowrap">{t('ext.view')} <ArrowRight className="h-3 w-3" /></span>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] leading-relaxed text-[#6a6d66]">{t('ext.foot')}</p>
    </motion.div>
  );
}

// Hero-right feature card: the DECISION CARD — the verdict-first opener the attorney reads first.
// Mirrors the product's Decision Card (and the PDF): matter line, what the records show, the
// sequence, a damages signal, and a ready-to-review verdict. Never a merit judgment — the numbers
// are arithmetic from records; the attorney decides.
function DecisionCard({ t }: { t: (k: string) => string }) {
  const reduce = useReducedMotion();
  const sequence = [
    { date: 'Nov 2025', title: t('tl.e1') },
    { date: 'Dec 2025', title: t('tl.e2') },
    { date: 'Jan 2026', title: t('tl.e3') },
  ];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="min-w-0 rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_30px_70px_-26px_rgba(46,64,56,0.35)]"
    >
      <div className="mb-1 flex items-center justify-between">
        <span style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">Decision Card</span>
        <span style={MONO} className="rounded-full border border-[#C6D0C8] bg-[#E7EDE8] px-2.5 py-1 text-[10px] text-[#5B21B6]">organized · review in ~2 min</span>
      </div>
      <div style={MONO} className="mb-3 text-[9px] uppercase tracking-[0.1em] text-[#a2aaa2]">Illustrative example</div>

      {/* matter line */}
      <div className="text-[15px] font-semibold tracking-[-0.01em] text-[#17181C]">M. Rivera · Lumina Foods · 2022&ndash;2026</div>

      {/* what the records show — factual contents only, no characterization */}
      <div className="mt-3.5">
        <div style={MONO} className="text-[9.5px] uppercase tracking-[0.12em] text-[#8a938c]">What&rsquo;s in the file</div>
        <p className="mt-1 text-[13.5px] leading-snug text-[#20242a]">A written payroll-audit request and a termination letter &mdash; both dated and source-linked.</p>
      </div>

      {/* the sequence */}
      <div className="mt-4">
        <div style={MONO} className="mb-2 text-[9.5px] uppercase tracking-[0.12em] text-[#8a938c]">The sequence</div>
        <div className="relative">
          <motion.span aria-hidden
            initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.45 }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-[5px] top-[4px] bottom-[8px] w-[2px] bg-[#CBD6CF]"
          />
          {sequence.map((e, i) => (
            <motion.div key={e.title}
              initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.55 + i * 0.18 }}
              className="flex gap-3"
            >
              <div className="relative w-3 flex-none"><span className="absolute left-[1px] top-[4px] h-2.5 w-2.5 rounded-full bg-[#42574E]" /></div>
              <div className={i < sequence.length - 1 ? 'pb-2.5' : ''}>
                <div style={MONO} className="text-[10.5px] text-[#7c857f]">{e.date}</div>
                <div className="text-[13px] font-medium text-[#20242a]">{e.title}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* signals — organization only; no valuation, no merit signal */}
      <div className="mt-4 flex gap-2.5">
        <div className="min-w-0 flex-1 rounded-[12px] border border-[#E4E5DE] bg-[#FAF9F6] p-2.5 text-center">
          <div className="text-[17px] font-black leading-none text-[#42574E]">12</div>
          <div style={MONO} className="mt-1 text-[9px] uppercase tracking-[0.06em] text-[#6a6d66]">Records organized</div>
        </div>
        <div className="min-w-0 flex-1 rounded-[12px] border border-[#E4E5DE] bg-[#FAF9F6] p-2.5 text-center">
          <div className="text-[17px] font-black leading-none text-[#42574E]">9</div>
          <div style={MONO} className="mt-1 text-[9px] uppercase tracking-[0.06em] text-[#6a6d66]">Facts source-linked</div>
        </div>
      </div>

      {/* state, not merit — describes completeness, never case value */}
      <div className="mt-3.5 flex items-center gap-2 rounded-[10px] border border-[#D3DED6] bg-[#EFF3ED] px-3 py-2 text-[12px] font-semibold text-[#3c5049]">
        <CheckCircle2 className="h-3.5 w-3.5 flex-none" /> Organized and ready to review.
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-[#8a938c]">Organized from records &mdash; not legal advice, a case valuation, or an outcome prediction. The attorney decides.</p>
    </motion.div>
  );
}

export function SageMarketingPage({ onWorkerStart, onSignIn, onForFirms, firmDirectedContext = null }: SageMarketingPageProps) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const directed = !!firmDirectedContext;

  return (
    <div style={BODY} className="min-h-screen bg-[#F1F3EF] text-[#17181C]">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em]">one3seven</span>
        <div className="flex items-center gap-3 sm:gap-5">
          <a href="/hq" className="text-[12px] font-medium text-[#9aa39b] transition hover:text-[#42574E]">HQ</a>
          <LangToggle tone="light" />
          <button type="button" onClick={() => { track('nav_for_workers'); onWorkerStart(); }} className="hidden text-[13.5px] font-medium text-[#3f4a44] hover:text-[#17181C] sm:block">{t('nav.workers')}</button>
          <button type="button" onClick={onSignIn} className="hidden text-[13.5px] font-medium text-[#3f4a44] hover:text-[#17181C] sm:block">{t('nav.signin')}</button>
          <button type="button" onClick={() => { track('nav_for_firms'); onForFirms(); }} className="rounded-full bg-[#42574E] px-5 py-2.5 text-[13.5px] font-semibold text-[#EAF0EC] transition hover:bg-[#374a42]">{t('home.request')}</button>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-10 h-[540px] w-[540px] rounded-full bg-[#42574E]/[0.06] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-28 h-[440px] w-[440px] rounded-full bg-[#95AB9B]/[0.16] blur-3xl" />
        <motion.div
          className="relative mx-auto grid max-w-6xl items-center gap-11 px-6 py-14 md:grid-cols-[1.08fr_.92fr] md:py-20"
          initial={reduce ? false : 'hidden'} animate="show" variants={heroContainer}
        >
          <div className="min-w-0">
            <motion.div variants={heroItem} style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">
              {directed ? `${t('aw.badge')}` : t('home.eyebrow')}
            </motion.div>
            <motion.h1 variants={heroItem} style={SERIF} className="mt-3.5 text-[clamp(40px,6.5vw,66px)] font-semibold leading-[0.96] tracking-[-0.022em] text-balance">
              {t('home.h1_1')}
              <span className="block text-[#5E7268]">{t('home.h1_2')}</span>
            </motion.h1>
            <motion.p variants={heroItem} style={SERIF} className="mt-4 max-w-[30ch] text-[clamp(17px,2.2vw,21px)] font-medium italic leading-snug text-[#42574E]">
              {t('home.belief')}
            </motion.p>
            <motion.p variants={heroItem} className="mt-4 max-w-[48ch] text-[15px] leading-[1.65] text-[#40433f]">
              {directed && firmDirectedContext
                ? `${firmDirectedContext.firmName}: ${t('home.sub')}`
                : t('home.explain')}
            </motion.p>
            <motion.div variants={heroItem} className="mt-6 flex flex-wrap items-center gap-3">
              {directed ? (
                <button type="button" onClick={() => { track('cta_worker_start'); onWorkerStart(); }} className="inline-flex items-center gap-2 rounded-full bg-[#42574E] px-6 py-3 text-[14px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42]">{t('aw.start')} <ArrowRight className="h-4 w-4" /></button>
              ) : (
                <>
                  <button type="button" onClick={() => { track('cta_firm_pilot'); onForFirms(); }} className="rounded-full bg-[#42574E] px-6 py-3 text-[14px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42]">{t('home.request')}</button>
                  <a href="/demo" onClick={() => track('firm_see_sample')} className="rounded-full border border-[#B7BCB2] bg-white/50 px-5 py-3 text-[14px] font-semibold text-[#22262a] transition hover:border-[#8f958b] hover:bg-white">{t('home.sample')}</a>
                </>
              )}
            </motion.div>
            <motion.div variants={heroItem} className="mt-6 flex items-center gap-2 text-[12.5px] text-[#5b5e59]">
              <motion.span
                className="h-[7px] w-[7px] rounded-full bg-[#5B21B6]"
                animate={reduce ? {} : { boxShadow: ['0 0 0 0 rgba(91,33,182,0.30)', '0 0 0 5px rgba(91,33,182,0)'] }}
                transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut' }}
              />
              {t('home.ai_line')}
            </motion.div>
            <motion.div variants={heroItem} className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E1E4DD] pt-4 text-[11.5px] font-medium text-[#6a6d66]">
              <span>Built on Anthropic&rsquo;s Claude</span>
              <span className="h-1 w-1 rounded-full bg-[#B7BCB2]" />
              <span>California employment firms</span>
              <span className="h-1 w-1 rounded-full bg-[#B7BCB2]" />
              <span>Free 7-day pilot</span>
            </motion.div>
          </div>
          <DecisionCard t={t} />
        </motion.div>
      </section>

      {/* problem — the pain, shown as before → after */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('prob.eyebrow')}</div>
        <h2 style={SERIF} className="mt-3 max-w-[20ch] text-balance text-[clamp(26px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.02em] text-[#17181C]">
          {t('prob.head')}
        </h2>

        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr]">
          {/* BEFORE — the pile */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-[#E1E4DD] bg-[#ECEFEA] p-6"
          >
            <div style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">{t('prob.before')}</div>
            <div className="relative mt-4 h-[196px]">
              {[
                { k: 'prob.c1', top: '2%', left: '2%', rot: '-6deg' },
                { k: 'prob.c2', top: '5%', left: '40%', rot: '5deg' },
                { k: 'prob.c3', top: '40%', left: '5%', rot: '-3deg' },
                { k: 'prob.c4', top: '30%', left: '55%', rot: '8deg' },
                { k: 'prob.c5', top: '66%', left: '22%', rot: '-4deg' },
                { k: 'prob.c6', top: '60%', left: '56%', rot: '6deg' },
              ].map((c) => (
                <div key={c.k} style={{ top: c.top, left: c.left, rotate: c.rot }}
                  className="absolute inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3C8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#5c5c55] shadow-[0_6px_16px_-8px_rgba(46,64,56,0.4)]">
                  <FileText className="h-3 w-3 text-[#9aa39b]" /> {t(c.k)}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] italic text-[#6a6d66]">{t('prob.before_cap')}</p>
          </motion.div>

          {/* arrow */}
          <div className="flex items-center justify-center py-1 md:py-0">
            <div className="flex flex-col items-center gap-2">
              <span style={MONO} className="rounded-full bg-[#42574E] px-3 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-[#EAF0EC]">{t('prob.arrow')}</span>
              <ArrowRight className="h-5 w-5 rotate-90 text-[#42574E] md:rotate-0" />
            </div>
          </div>

          {/* AFTER — organized */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            className="rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_24px_60px_-28px_rgba(46,64,56,0.3)]"
          >
            <div style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">{t('prob.after')}</div>
            <div className="relative mt-4">
              <span aria-hidden className="absolute left-[5px] top-[4px] bottom-[16px] w-[2px] bg-[#CBD6CF]" />
              {[
                { d: 'Nov 2025', k: 'tl.e1', doc: 'Rivera_HR_Complaint.pdf' },
                { d: 'Dec 2025', k: 'tl.e2', doc: 'Rivera_Warning_Dec2025.pdf' },
                { d: 'Jan 2026', k: 'tl.e3', doc: 'Rivera_Termination.pdf' },
              ].map((e, i, arr) => (
                <div key={e.doc} className="flex gap-3.5">
                  <div className="relative w-3 flex-none"><span className="absolute left-[1px] top-[3px] h-2.5 w-2.5 rounded-full bg-[#42574E]" /></div>
                  <div className={i < arr.length - 1 ? 'pb-4' : ''}>
                    <div style={MONO} className="text-[10.5px] text-[#7c857f]">{e.d}</div>
                    <div className="mt-px text-[13px] font-semibold text-[#20242a]">{t(e.k)}</div>
                    <span style={MONO} className="mt-1 inline-flex items-center gap-1.5 rounded-[6px] border border-[#D3DED6] bg-[#E7EDE8] px-2 py-[2px] text-[10px] text-[#3c5049]"><span className="h-2 w-[6px] flex-none rounded-[1px] bg-[#42574E]" />{e.doc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] italic text-[#3c5049]">{t('prob.after_cap')}</p>
          </motion.div>
        </div>

        <p className="mx-auto mt-12 max-w-[64ch] text-center text-[15.5px] leading-[1.7] text-[#40433f]">
          {t('prob.body')}
        </p>
      </section>

      {/* how it works */}
      <section className="border-y border-[#E1E4DD] bg-[#ECEFEA]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            ['01', t('step1.t'), t('step1.b')],
            ['02', t('step2.t'), t('step2.b')],
            ['03', t('step3.t'), t('step3.b')],
          ].map(([n, title, body]) => (
            <div key={n}>
              <div style={MONO} className="text-[12px] text-[#42574E]">{n}</div>
              <h3 style={SERIF} className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#454a44]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* trust */}
      <section className="mx-auto grid max-w-6xl items-start gap-10 px-6 py-20 md:grid-cols-2">
        <div>
          <div style={MONO} className="text-[11px] uppercase tracking-[0.14em] text-[#42574E]">{t('trust.eyebrow')}</div>
          <h2 style={SERIF} className="mt-3 text-[clamp(26px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.015em] text-balance">
            {t('trust.h1')}<span className="block text-[#5E7268]">{t('trust.h2')}</span>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-[#40433f]">{t('trust.body')}</p>
          <div className="mt-5 inline-flex items-center gap-2 text-[12.5px] text-[#5b5e59]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#5B21B6] shadow-[0_0_0_4px_rgba(66,87,78,0.16)]" />
            {t('trust.claude')}
          </div>
        </div>
        <ul className="grid gap-2.5">
          {['trust.b1', 'trust.b2', 'trust.b3', 'trust.b4', 'trust.b5'].map((k) => (
            <li key={k} className="flex items-start gap-3 rounded-xl border border-[#E1E4DD] bg-[#F7F9F5] px-4 py-3 text-[14px] text-[#2c332e]">
              <span className="mt-[6px] h-2 w-2 flex-none rounded-full bg-[#42574E]" />
              {t(k)}
            </li>
          ))}
        </ul>
      </section>

      {/* pilot CTA — deep sage-charcoal (previews the light→dark product transition) */}
      <section className="border-t border-[#E1E4DD] bg-[#20302B]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 style={SERIF} className="text-balance text-[clamp(30px,4.6vw,52px)] font-semibold leading-[1.02] tracking-[-0.02em] text-[#F1F5F1]">
            {t('pilot.h1')}<span className="block text-[#9FB3A8]">{t('pilot.h2')}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-[1.6] text-[#C3CEC7]">{t('pilot.body')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => { track('cta_firm_pilot'); onForFirms(); }} className="rounded-full bg-[#DDE7DF] px-6 py-3 text-[14px] font-semibold text-[#20302B] transition hover:bg-white">{t('home.request')}</button>
            <button type="button" onClick={() => { track('nav_for_workers'); onWorkerStart(); }} className="rounded-full border border-[#4A5A52] px-5 py-3 text-[14px] font-semibold text-[#DDE7DF] transition hover:border-[#7c8b81]">{t('nav.workers')}</button>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10">
        <p className="max-w-[74ch] text-[12px] leading-[1.6] text-[#7a7d76]">{t('foot.disc')}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E1E4DD] pt-4 text-[12px] text-[#7a7d76]">
          <a href="/terms" className="font-medium text-[#42574E] hover:underline">{t('foot.terms')}</a>
          <span aria-hidden className="text-[#c3c7bd]">·</span>
          <a href="/privacy" className="font-medium text-[#42574E] hover:underline">{t('foot.privacy')}</a>
          <span aria-hidden className="text-[#c3c7bd]">·</span>
          <a href="/privacy#california-privacy-rights" className="font-medium text-[#42574E] hover:underline">{t('foot.choices')}</a>
          <span aria-hidden className="text-[#c3c7bd]">·</span>
          <a href="mailto:info@one3seven.com" className="font-medium text-[#42574E] hover:underline">{t('foot.contact')}</a>
          <span className="ml-auto text-[#9a9d95]">© {new Date().getFullYear()} one3seven</span>
        </div>
      </footer>
    </div>
  );
}
