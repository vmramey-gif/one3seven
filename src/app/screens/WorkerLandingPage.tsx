import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { useLang, LangToggle } from '../../i18n/i18n';

/**
 * Worker-facing front door — the default landing (worker-first). Bilingual via i18n t():
 * this audience (esp. fire-displaced workers) skews Spanish-preferring, so the EN/ES toggle
 * matters more here than on the firm page. Verb-test clean, referral-safe (worker owns +
 * chooses; one3seven never routes/matches/selects).
 */

// SaaS-led type (2026-08-02): display is now the tight sans, not Fraunces — reads product, not
// artisanal. Kept the name SERIF to avoid churning every style={SERIF} usage on this page.
const SERIF = { fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', fontWeight: 680 } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

interface WorkerLandingPageProps {
  onStart: () => void;   // "Start organizing — free" → low-friction worker sign-up
  onSignIn: () => void;
  onBack?: () => void;
  onForFirms?: () => void;  // subtle link to the firm-facing marketing page
}

const STEP_KEYS = [
  ['01', 'wl.step1.t', 'wl.step1.b'],
  ['02', 'wl.step2.t', 'wl.step2.b'],
  ['03', 'wl.step3.t', 'wl.step3.b'],
] as const;

const HERO_CHIP_KEYS = ['wl.hero.c1', 'wl.hero.c2', 'wl.hero.c3', 'wl.hero.c4'] as const;


export function WorkerLandingPage({ onStart, onSignIn, onBack, onForFirms }: WorkerLandingPageProps) {
  const { t } = useLang();
  // Illustrative evidence rows for the hero card: [date, item (i18n), source-link chip].
  const EVIDENCE: [string, string, string][] = [
    ['Sep 09 2024', t('wl.ev1'), '» hr_complaint.pdf'],
    ['Nov 12 2025', t('wl.ev2'), '» timecard.pdf'],
    ['Mar 10 2026', t('wl.ev3'), '» paystub_9.pdf'],
  ];
  // Hero card animates in when scrolled into view (framer-motion, in-view once): the "have"
  // chips settle in a clean straight row, then the "get" panel rises. Motion only —
  // organizes-never-concludes holds. Straight chips read as organized, not sloppy.
  const reduce = useReducedMotion();
  return (
    <div style={BODY} className="min-h-screen o3s-warm-sky text-[#17181C] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E1E4DD] bg-[#FBF7EF]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C] transition hover:opacity-70">
            <WordMark />
          </button>
          <div className="flex items-center gap-3 sm:gap-5">
            <LangToggle tone="light" />
            {onForFirms ? (
              <button type="button" onClick={onForFirms} className="text-sm font-medium text-[#6a6d66] transition hover:text-[#17181C]">
                {t('wl.forfirms')}
              </button>
            ) : null}
            <button type="button" onClick={onSignIn} className="text-sm font-medium text-[#3f4a44] transition hover:text-[#17181C]">
              {t('nav.signin')}
            </button>
          </div>
        </div>
      </nav>

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        {/* Journey spine — a thin rail down the left gutter that ripens warm → sage → green as the
            record moves toward completion. Desktop only; decorative (pointer-events-none). */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-28 bottom-28 hidden w-px lg:block"
          style={{ background: 'linear-gradient(180deg,#E7C9AE,#CDAF97 26%,#9FB08E 56%,#5E7268 82%,#3E5747 100%)', opacity: 0.55 }}
        />
        {/* node at the top of the spine */}
        <div aria-hidden className="pointer-events-none absolute left-[1px] top-28 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-[#A8512B] shadow-[0_0_0_4px_rgba(168,81,43,0.14)] lg:block" />
        {/* Hero */}
        <section className="relative pb-8 pt-14 sm:pt-20">
          {/* Sunset glow — warm depth behind the hero, no interaction */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-6 right-[-12%] h-[340px] w-[340px] rounded-full sm:right-[-4%]"
            style={{ background: 'radial-gradient(circle, rgba(233,169,78,0.28), rgba(233,169,78,0) 62%)' }}
          />
          <div className="relative grid items-center gap-10 md:grid-cols-[1.05fr_.95fr]">
            <div className="min-w-0">
          <div style={MONO} className="mb-4 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('wl.eyebrow')}</div>
          <h1 style={SERIF} className="mb-4 max-w-[15ch] text-balance text-[clamp(34px,7vw,58px)] font-semibold leading-[1.02] tracking-[-0.02em]">
            {t('wl.h1a')} <span className="text-[#5E7268]">{t('wl.h1b')}</span>
          </h1>
          <p style={SERIF} className="mb-4 max-w-[26ch] text-[clamp(18px,3vw,23px)] font-medium italic leading-snug text-[#42574E]">
            {t('wl.belief')}
          </p>
          <p className="mb-6 max-w-[54ch] text-[16.5px] leading-[1.65] text-[#40433f]">
            {t('wl.lede')}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onStart} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--o3s-action)] px-7 py-3.5 text-[16px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(181,83,31,0.55)] transition hover:-translate-y-0.5 hover:brightness-95 sm:w-auto">
              {t('wl.cta')} <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#how" className="inline-flex w-full items-center justify-center rounded-full border border-[#B7BCB2] bg-white/60 px-6 py-3.5 text-[16px] font-semibold text-[#22262a] transition hover:border-[#8f958b] hover:bg-white sm:w-auto">
              {t('wl.howlink')}
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-[18px] gap-y-2.5 border-t border-[#E4E5DE] pt-4 text-[13.5px] font-semibold text-[#42574E]">
            {['wl.chip.free', 'wl.chip.notified', 'wl.chip.keep', 'wl.chip.choose'].map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#95AB9B]" />{t(k)}</span>
            ))}
          </div>
            </div>

            {/* Hero illustration — scattered files becoming a dated, source-linked list.
                Shows organization only: no case narrative, no sequencing, no merit or value. */}
            <div className="min-w-0">
              <div className="rounded-[26px] border border-[#CBD6CF] bg-white p-6 shadow-[0_24px_60px_-26px_rgba(66,87,78,0.38)] sm:p-7">
                <div style={MONO} className="text-[10px] uppercase tracking-[0.16em] text-[#8a938c]">
                  {t('wl.hero.card.tag')}
                </div>

                {/* Burnt orange marks the problem state; sage marks everything organized. */}
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#A8512B]">
                  {t('wl.hero.card.before')}
                </div>
                <motion.div
                  className="mt-2.5 flex flex-wrap gap-x-1.5 gap-y-1.5"
                  initial={reduce ? false : 'hidden'}
                  whileInView="show"
                  viewport={{ once: true, amount: 0.4 }}
                  variants={{ show: { transition: { staggerChildren: 0.07 } } }}
                >
                  {HERO_CHIP_KEYS.map((k) => (
                    <motion.span
                      key={k}
                      variants={{ hidden: { opacity: 0, y: -6, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                      className="rounded-[10px] border border-[#EBD9CD] bg-[#FBF4EF] px-2.5 py-1 text-[11.5px] text-[#A8512B] shadow-[0_2px_6px_rgba(168,81,43,0.08)]"
                    >
                      {t(k)}
                    </motion.span>
                  ))}
                </motion.div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-[#8B7166]">{t('wl.hero.card.pain')}</p>

                <div className="my-4 flex items-center gap-2">
                  <span className="h-px flex-1 bg-[#E4E5DE]" />
                  <span style={MONO} className="text-[10px] uppercase tracking-[0.14em] text-[#42574E]">
                    {t('wl.hero.card.arrow')}
                  </span>
                  <span className="h-px flex-1 bg-[#E4E5DE]" />
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">
                  {t('wl.hero.card.after')}
                </div>
                {/* Contained, calm panel — the visual relief against the scattered pile above.
                    Stated as what the worker gets to DO, not as product features. */}
                {/* Evidence-instrument rows — mono date + item + violet source-link chip = the
                    signature "serious record" texture. Organize-only labels; illustrative. */}
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: 0.22, type: 'spring', stiffness: 320, damping: 30 }}
                  className="mt-2.5 rounded-[16px] border border-[#CBD6CF] bg-[#F7F9F5] px-4"
                >
                  {EVIDENCE.map(([d, e, s]) => (
                    <div key={s} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#E4E5DE] py-2.5 last:border-b-0">
                      <span style={MONO} className="whitespace-nowrap text-[10.5px] tabular-nums text-[#42574E]">{d}</span>
                      <span className="truncate text-[13px] text-[#20242a]">{e}</span>
                      <span style={MONO} className="whitespace-nowrap rounded-md border border-[#5B21B6]/25 bg-[#5B21B6]/[0.07] px-1.5 py-0.5 text-[9px] text-[#5B21B6]">{s}</span>
                    </div>
                  ))}
                </motion.div>
                <div style={MONO} className="mt-2.5 text-[10.5px] leading-snug text-[#6a6d66]">{t('wl.ev.status')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Does any of this sound like you? — recognition hook (questions only, no law stated).
            Placed BEFORE the glass preview: name the pain first, then show the organized payoff. */}
        <section className="py-6">
          <div style={MONO} className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#A8512B]">{t('wl.sly.eyebrow')}</div>
          <h2 style={SERIF} className="mb-6 max-w-[22ch] text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">{t('wl.sly.h')}</h2>
          <div className="flex flex-col gap-2.5">
            {['wl.sly.q1', 'wl.sly.q2', 'wl.sly.q3', 'wl.sly.q4', 'wl.sly.q5'].map((k) => (
              <div key={k} className="flex items-start gap-3 rounded-[16px] border border-[#E4E5DE] bg-[#FBFBFA] px-4 py-3.5 text-[15.5px] font-medium leading-snug text-[#20242a]">
                <span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-[#A8512B]" />
                {t(k)}
              </div>
            ))}
          </div>
          <div className="mt-3.5 rounded-[18px] bg-[#42574E] px-6 py-5 text-[#EAF0EC]">
            <p style={SERIF} className="text-[clamp(16px,2.4vw,18px)] font-medium leading-snug text-white">{t('wl.sly.bridge1')}</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#D3DED6]">{t('wl.sly.bridge2')}</p>
          </div>
        </section>

        {/* Your organized profile — glass preview of what the worker gets & owns (illustrative) */}
        <section className="py-8">
          <div className="relative overflow-hidden rounded-[28px] border border-[#EAD9BF] bg-gradient-to-br from-[#FCEEDA] via-[#FBF4E8] to-[#F1E7D5] p-6 sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(233,169,78,0.35), rgba(233,169,78,0) 65%)' }} />
            <div className="relative">
              <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#A8512B]">Show up ready</div>
              <h2 style={SERIF} className="mt-2 max-w-[26ch] text-[clamp(24px,4vw,34px)] font-semibold leading-[1.1] tracking-[-0.01em] text-[#1B2623]">
                Walk in already organized — the client every lawyer wishes they had.
              </h2>
              <p style={BODY} className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-[#5a5f58]">
                Show up with a pile of screenshots and old texts, and the first meeting gets spent digging. Show up already organized, and it gets spent on you. one3seven is how you walk in the second way — your key dates, your reminders, and the records your employer is holding, all in one place you own.
              </p>

              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {/* Reminders */}
                <div className="rounded-[20px] border border-white/60 bg-white/55 p-5 shadow-[0_18px_50px_-22px_rgba(66,87,78,0.4)] backdrop-blur-md">
                  <div style={MONO} className="text-[10.5px] uppercase tracking-[0.12em] text-[#42574E]">Reminders · your key dates</div>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 rounded-[12px] bg-white/70 px-3 py-2.5">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#E08A4E]" />
                      <span className="text-[13px] text-[#20242a]">Deposition</span>
                      <span className="ml-auto text-[12px] text-[#8a8f88]">Sep 4</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-[12px] bg-white/70 px-3 py-2.5">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#E08A4E]" />
                      <span className="text-[13px] text-[#20242a]">Examination appointment</span>
                      <span className="ml-auto text-[12px] text-[#8a8f88]">Sep 18</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-[12px] bg-white/70 px-3 py-2.5">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#7C8B6F]" />
                      <span className="text-[13px] text-[#20242a]">Records due from employer</span>
                      <span className="ml-auto text-[12px] font-semibold text-[#7C8B6F]">✓ received</span>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] leading-snug text-[#8a8f88]">Every date is one you or your attorney set — one3seven never calculates legal deadlines.</div>
                </div>

                {/* Important dates */}
                <div className="rounded-[20px] border border-white/60 bg-white/55 p-5 shadow-[0_18px_50px_-22px_rgba(66,87,78,0.4)] backdrop-blur-md">
                  <div style={MONO} className="text-[10.5px] uppercase tracking-[0.12em] text-[#42574E]">Important dates</div>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {[
                      ['Mar 3, 2025', 'Raised concern with manager'],
                      ['Nov 12, 2025', 'Hours reduced'],
                      ['Mar 10, 2026', 'Final paycheck received'],
                    ].map(([d, e]) => (
                      <div key={d}>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold tabular-nums text-[#42574E]">{d}</span>
                          <span className="rounded-full bg-[#EAF0EC] px-2 py-0.5 text-[10px] font-semibold text-[#42574E]">On your record</span>
                        </div>
                        <div className="mt-0.5 text-[13px] text-[#20242a]">{e}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Get your records — the emphasized card */}
                <div className="rounded-[20px] border-2 border-[#E08A4E]/60 bg-white/60 p-5 shadow-[0_20px_55px_-20px_rgba(224,138,78,0.5)] backdrop-blur-md">
                  <div style={MONO} className="text-[10.5px] uppercase tracking-[0.12em] text-[#A8512B]">Get your records</div>
                  <p className="mt-2 text-[13.5px] leading-snug text-[#20242a]">
                    The records your employer is holding — demanded in one tap. California law says they&rsquo;re yours, with a deadline. We write the letter; you hit send.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['Pay records', 'Personnel file', 'Timekeeping', 'Documents I signed'].map((c) => (
                      <span key={c} className="rounded-full border border-[#E4E5DE] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#3a3f38]">{c}</span>
                    ))}
                  </div>
                  <button type="button" onClick={onStart} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E08A4E] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95">
                    ✉ Start your records request →
                  </button>
                </div>
              </div>

              <div className="mt-4 text-[11px] italic text-[#9a8f7e]">Illustrative example — one3seven organizes and informs; the legal judgment stays with you and any attorney you choose.</div>
            </div>
          </div>
        </section>

        {/* Founder testimony — someone who was where the worker is built this */}
        <section className="py-8">
          <div className="rounded-[24px] border border-[#CBD6CF] bg-[#FBFBFA] p-7 shadow-[0_18px_45px_rgba(66,87,78,0.08)] sm:p-9">
            <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('wl.founder.eyebrow')}</div>
            <blockquote style={SERIF} className="mt-4 max-w-[62ch] text-[clamp(18px,2.6vw,23px)] font-medium leading-[1.42] text-[#20242a]">
              &ldquo;{t('wl.founder.quote')}&rdquo;
            </blockquote>
            <div className="mt-6">
              <div className="text-[13px] leading-snug text-[#6a6d66]">{t('wl.founder.title')}</div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-16">
          <div className="text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('wl.how.eyebrow')}</div>
            <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">{t('wl.how.h2')}</h2>
            <p className="mx-auto mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-[#40433f]">
              {t('wl.how.sub')}
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {STEP_KEYS.map(([n, titleKey, bodyKey]) => (
              <div key={n} className="rounded-[20px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
                <div style={MONO} className="text-[12px] tracking-[0.1em] text-[#42574E]">{n}</div>
                <h3 style={SERIF} className="mb-1.5 mt-2.5 text-[19px] font-semibold">{t(titleKey)}</h3>
                <p className="text-[14.5px] leading-relaxed text-[#40433f]">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How the AI helps — worker-facing AI awareness. Transparent + verify-first (reinforces
            organize-never-conclude). Deep violet #5B21B6 is the brand's AI-only accent. */}
        <section className="py-8">
          <div className="rounded-[24px] border border-[#E0DBEF] bg-white p-7 shadow-[0_18px_45px_rgba(91,33,182,0.06)] sm:p-9">
            <div className="flex items-center gap-2">
              <span style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#5B21B6]">{t('wl.ai.eyebrow')}</span>
              <span className="rounded-full bg-[#5B21B6]/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#5B21B6]">AI</span>
            </div>
            <h2 style={SERIF} className="mt-3 max-w-[24ch] text-[clamp(22px,3.4vw,30px)] font-semibold tracking-[-0.01em] text-[#20242a]">
              {t('wl.ai.h')}
            </h2>
            <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-[#40433f]">{t('wl.ai.body')}</p>
            <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#E0DBEF] bg-[#F8F6FD] px-4 py-3.5">
              <span className="mt-[2px] flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#5B21B6]/12 text-[#5B21B6]">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <p className="text-[14.5px] leading-relaxed text-[#3a2f52]">{t('wl.ai.trust')}</p>
            </div>
            <p className="mt-3.5 text-[12.5px] font-medium text-[#6a6d66]">{t('wl.ai.builton')}</p>
          </div>
        </section>

        {/* Yours, start to finish — the ownership/journey formula. Worker surface: NO metrics,
            no merit, no scoring. Just the ownership flip stated plainly. */}
        <section className="py-14">
          <div className="rounded-[24px] border border-[#CBD6CF] bg-white/70 p-8 sm:p-10">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('wl.own.eyebrow')}</div>
            <h2 style={SERIF} className="mb-3 max-w-[24ch] text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.015em] text-[#17181C]">{t('wl.own.h')}</h2>
            <p className="mb-6 max-w-[58ch] text-[16px] leading-[1.65] text-[#40433f]">{t('wl.own.body')}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {['wl.own.s1', 'wl.own.s2', 'wl.own.s3'].map((k, i) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#42574E] text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="text-[15px] font-semibold text-[#20242a]">{t(k)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA — sits directly in the page's ripened deep-green bottom (the "sunset
            completion"), inverted text, amber glow for warmth. No card: the page IS the band. */}
        <section className="relative py-20 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(233,169,78,0.22), rgba(233,169,78,0) 62%)' }}
          />
          <div className="relative">
            <h2 style={SERIF} className="mx-auto max-w-[16ch] text-balance text-[clamp(26px,5vw,36px)] font-semibold tracking-[-0.02em] text-white">
              {t('wl.final.h2')}
            </h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[#D8E0CF]">{t('wl.final.sub')}</p>
            <div className="mt-7 flex justify-center">
              <button type="button" onClick={onStart} className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[var(--o3s-action)] px-7 py-3.5 text-[16px] font-semibold text-white shadow-[0_14px_34px_-10px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 hover:brightness-105 sm:w-auto">
                {t('wl.cta')} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Footer — rests in the deepest green; light-inverted to stay readable. */}
      <footer className="border-t border-white/10 px-5 pb-12 pt-9 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          <div style={MONO} className="text-[11px] uppercase tracking-[0.14em] text-[#AEBEA6]">one3seven</div>
          <p className="max-w-[640px] text-[11.5px] leading-relaxed text-[#9DB097]">
            {t('wl.footer.disc')}
          </p>
        </div>
      </footer>
    </div>
  );
}
