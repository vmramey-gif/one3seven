import { ArrowRight } from 'lucide-react';
import { useLang, LangToggle } from '../../i18n/i18n';

/**
 * Worker-facing front door — the default landing (worker-first). Bilingual via i18n t():
 * this audience (esp. fire-displaced workers) skews Spanish-preferring, so the EN/ES toggle
 * matters more here than on the firm page. Verb-test clean, referral-safe (worker owns +
 * chooses; one3seven never routes/matches/selects).
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
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

const YOURS_KEYS = [
  ['wl.yours1.t', 'wl.yours1.b'],
  ['wl.yours2.t', 'wl.yours2.b'],
  ['wl.yours3.t', 'wl.yours3.b'],
  ['wl.yours4.t', 'wl.yours4.b'],
] as const;

export function WorkerLandingPage({ onStart, onSignIn, onBack, onForFirms }: WorkerLandingPageProps) {
  const { t } = useLang();
  return (
    <div style={BODY} className="min-h-screen bg-[#F1F3EF] text-[#17181C] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E1E4DD] bg-[#F1F3EF]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C]">
            one3seven
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

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Hero */}
        <section className="pb-8 pt-14 sm:pt-20">
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
            <button type="button" onClick={onStart} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[16px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42] sm:w-auto">
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

        {/* Straight with you */}
        <section className="py-4">
          <div className="rounded-[24px] bg-[#42574E] p-8 sm:p-10 text-[#EAF0EC]">
            <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#AFC3B4]">{t('wl.straight.eyebrow')}</div>
            <p style={SERIF} className="mt-3 max-w-[26ch] text-[clamp(20px,3vw,26px)] font-medium text-white">
              {t('wl.straight.h')}
            </p>
            <p className="mt-3.5 max-w-[56ch] text-[16px] leading-[1.65] text-[#D3DED6]">
              {t('wl.straight.body')}
            </p>
          </div>
        </section>

        {/* Your record, your call */}
        <section className="py-16">
          <div className="mb-8 text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">{t('wl.yours.eyebrow')}</div>
            <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">{t('wl.yours.h2')}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {YOURS_KEYS.map(([hKey, bodyKey]) => (
              <div key={hKey} className="rounded-[20px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
                <div className="flex items-center gap-2 text-[16px] font-bold text-[#20242a]">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E7EDE8] text-[13px] font-extrabold text-[#42574E]">✓</span>
                  {t(hKey)}
                </div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#40433f]">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-10 text-center">
          <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">{t('wl.final.h2')}</h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-[#40433f]">{t('wl.final.sub')}</p>
          <div className="mt-6 flex justify-center">
            <button type="button" onClick={onStart} className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[16px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42] sm:w-auto">
              {t('wl.cta')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E1E4DD] px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          <div style={MONO} className="text-[11px] uppercase tracking-[0.14em] text-[#6a6d66]">one3seven</div>
          <p className="max-w-[640px] text-[11.5px] leading-relaxed text-[#6a6d66]">
            {t('wl.footer.disc')}
          </p>
        </div>
      </footer>
    </div>
  );
}
