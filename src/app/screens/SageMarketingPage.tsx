/**
 * SageMarketingPage — the live marketing homepage in the sage identity
 * (2026-07-08 brand). Light off-white + ink + cool sage accent; deep violet
 * (#5B21B6) reserved for AI-only moments; source-linked vertical timeline is
 * the signature. Props-compatible with the previous PublicMarketingPage so
 * App's routing (worker/firm/sign-in/firm-directed intake) is unchanged.
 * Bilingual via i18n t().
 */
import { ArrowRight } from 'lucide-react';
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
      className="rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_30px_70px_-26px_rgba(46,64,56,0.35)]"
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
          <div>
            <motion.div variants={heroItem} style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">
              {directed ? `${t('aw.badge')}` : t('home.eyebrow')}
            </motion.div>
            <motion.h1 variants={heroItem} style={SERIF} className="mt-3.5 text-[clamp(40px,6.5vw,66px)] font-semibold leading-[0.96] tracking-[-0.022em] text-balance">
              {t('home.h1_1')}
              <span className="block text-[#5E7268]">{t('home.h1_2')}</span>
            </motion.h1>
            <motion.p variants={heroItem} className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-[#40433f]">
              {directed && firmDirectedContext
                ? `${firmDirectedContext.firmName}: ${t('home.sub')}`
                : t('home.sub')}
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
          <TimelineCard t={t} />
        </motion.div>
      </section>

      {/* problem */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <p style={SERIF} className="text-balance text-[clamp(24px,3.6vw,38px)] font-medium leading-[1.25] tracking-[-0.012em] text-[#20242a]">
          {t('home.problem')}
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
      </footer>
    </div>
  );
}
