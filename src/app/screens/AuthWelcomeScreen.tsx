import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Screen } from '../App';
import { useLang, LangToggle } from '../../i18n/i18n';

interface AuthWelcomeScreenProps {
  onNavigate: (screen: Screen) => void;
  /** Clears firm sign-in intent and opens Sign In (normal path). */
  onOpenSignIn?: () => void;
  /** Sets firm sign-in intent and opens Sign In (participating firm path). */
  onFirmSignIn?: () => void;
  /** Clears firm sign-in intent and opens Create Account. */
  onOpenCreateAccount?: () => void;
}

// Sage brand (2026-07-08): light off-white + ink + cool sage; violet reserved for AI only.
const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

export function AuthWelcomeScreen({
  onNavigate,
  onOpenSignIn,
  onFirmSignIn,
  onOpenCreateAccount,
}: AuthWelcomeScreenProps) {
  const [isOrganizingStack, setIsOrganizingStack] = useState(false);
  const { t } = useLang();
  const openSignIn = () => (onOpenSignIn ? onOpenSignIn() : onNavigate('signIn'));
  const openCreateAccount = () => (onOpenCreateAccount ? onOpenCreateAccount() : onNavigate('createAccount'));
  const openFirmSignIn = () => (onFirmSignIn ? onFirmSignIn() : onNavigate('signIn'));

  const startOrganizing = () => {
    if (isOrganizingStack) return;
    setIsOrganizingStack(true);
    window.setTimeout(() => {
      openCreateAccount();
    }, 2250);
  };

  const stackCards = [
    { label: 'Calendar Event', from: '-translate-x-[70px] -translate-y-[84px] -rotate-[8deg]', to: '-translate-y-[34px] rotate-[-1deg]' },
    { label: 'Text Messages', from: 'translate-x-[72px] -translate-y-[70px] rotate-[7deg]', to: '-translate-y-[29px] rotate-[0.5deg]' },
    { label: 'HR Complaint', from: '-translate-x-[46px] -translate-y-[42px] rotate-[4deg]', to: '-translate-y-[24px] rotate-[-0.5deg]' },
    { label: 'Doctor Note', from: 'translate-x-[56px] -translate-y-[20px] -rotate-[5deg]', to: '-translate-y-[18px] rotate-[0.5deg]' },
    { label: 'Email', from: '-translate-x-[76px] translate-y-[6px] rotate-[6deg]', to: '-translate-y-[12px] rotate-[-0.5deg]' },
    { label: 'Screenshot', from: 'translate-x-[70px] translate-y-[28px] rotate-[9deg]', to: '-translate-y-[6px] rotate-[0.5deg]' },
    { label: 'Pay Stub', from: '-translate-x-[20px] translate-y-[54px] -rotate-[4deg]', to: 'translate-y-0 rotate-0' },
  ];

  return (
    <div style={BODY} className="relative min-h-screen overflow-hidden bg-[#F1F3EF] px-5 py-4 text-[#17181C] antialiased sm:px-6 sm:py-8">
      {/* Ambient sage wash */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#42574E]/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[440px] w-[440px] rounded-full bg-[#728179]/8 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[480px] flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('publicMarketing')}
            style={SERIF}
            className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C] transition hover:opacity-80"
            aria-label="one3seven — home"
          >
            one3seven
          </button>
          <div className="flex items-center gap-2">
            <LangToggle tone="light" />
            <button
              type="button"
              onClick={openSignIn}
              className="rounded-full border border-[#CBD6CF] bg-white px-4 py-2 text-sm font-medium text-[#2c332e] transition hover:border-[#8f958b]"
            >
              {t('aw.signin')}
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-5 sm:py-10">
          <div className="mb-5 rounded-[28px] border border-[#E1E4DD] bg-[#FBFBFA] p-3 shadow-[0_18px_60px_rgba(27,38,35,0.08)] sm:mb-10 sm:rounded-[34px] sm:p-5">
            <div
              className={`relative mx-auto h-[168px] max-w-[300px] transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[248px] sm:max-w-[360px] ${
                isOrganizingStack ? '-translate-y-4 scale-[0.94]' : ''
              }`}
            >
              <div className="absolute inset-x-10 bottom-4 h-10 rounded-full bg-[#42574E]/10 blur-2xl" />
              {stackCards.map((card, index) => (
                <div
                  key={card.label}
                  className={`absolute left-1/2 top-1/2 w-[152px] -translate-x-1/2 rounded-[16px] border border-[#D3DED6] bg-white px-3 py-2.5 shadow-[0_18px_38px_rgba(31,39,36,0.10)] transition-all duration-[2100ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[190px] sm:rounded-[20px] sm:px-4 sm:py-3 ${
                    isOrganizingStack
                      ? `${card.to} scale-[0.88] opacity-0`
                      : `${card.from} scale-100 opacity-100`
                  }`}
                  style={{ zIndex: index + 1, transitionDelay: isOrganizingStack ? `${index * 70}ms` : '0ms' }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                    <div className="h-1.5 w-10 rounded-full bg-[#42574E]/20 sm:h-2 sm:w-12" />
                    <div className="h-5 w-5 rounded-lg border border-[#D3DED6] bg-[#EEF2EE] sm:h-6 sm:w-6" />
                  </div>
                  <div className="mb-1.5 h-1 w-20 rounded-full bg-[#20242a]/10 sm:mb-2 sm:h-1.5 sm:w-24" />
                  <div className="mb-2.5 h-1 w-14 rounded-full bg-[#20242a]/8 sm:mb-4 sm:h-1.5 sm:w-16" />
                  <div className="text-[10px] font-semibold text-[#20242a] sm:text-xs">{card.label}</div>
                </div>
              ))}
              <div
                className={`absolute left-1/2 top-1/2 z-20 w-[168px] -translate-x-1/2 rounded-[20px] border border-[#CBD6CF] bg-[#F7F9F5] px-4 py-4 shadow-[0_22px_48px_rgba(31,39,36,0.12)] transition-all duration-[1900ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[210px] sm:rounded-[24px] sm:px-5 sm:py-5 ${
                  isOrganizingStack
                    ? '-translate-y-[20px] scale-100 opacity-100'
                    : 'translate-y-[48px] scale-90 opacity-0'
                }`}
              >
                <div className="mb-3 h-6 w-16 rounded-t-[10px] bg-[#42574E]/20 sm:mb-4 sm:h-8 sm:w-20 sm:rounded-t-[12px]" />
                <div className="rounded-[14px] border border-[#D3DED6] bg-white p-3 sm:rounded-[18px] sm:p-4">
                  <div className="mb-2 h-1.5 w-20 rounded-full bg-[#42574E]/25 sm:h-2 sm:w-24" />
                  <div className="h-1 w-24 rounded-full bg-[#20242a]/10 sm:h-1.5 sm:w-28" />
                </div>
              </div>
            </div>
          </div>

          <section className="text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#CBD6CF] bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#42574E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]" />
              {t('aw.badge')}
            </div>
            <h1 style={SERIF} className="text-[31px] font-semibold leading-[1.05] tracking-[-0.015em] text-[#17181C] sm:text-[40px]">
              {t('aw.h1_line1')}
              <br />
              <span className="text-[#5E7268]">{t('aw.h1_line2')}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[390px] text-[14px] leading-relaxed text-[#40433f] sm:mt-5 sm:text-[15px]">
              {t('aw.sub')}
            </p>

            <div className="mt-6 space-y-3 sm:mt-8">
              <button
                type="button"
                onClick={startOrganizing}
                disabled={isOrganizingStack}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#42574E] px-6 py-3.5 text-base font-semibold text-[#EAF0EC] shadow-[0_16px_44px_rgba(66,87,78,0.30)] transition hover:-translate-y-0.5 hover:bg-[#374a42] disabled:translate-y-0 disabled:opacity-80 sm:py-4"
              >
                {isOrganizingStack ? t('aw.organizing') : t('aw.start')}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={openSignIn}
                className="text-sm font-medium text-[#42574E] transition hover:text-[#2c332e]"
              >
                {t('aw.signin')}
              </button>
            </div>

            <button
              type="button"
              onClick={openFirmSignIn}
              className="mt-3 text-xs font-medium text-[#6a6d66] transition hover:text-[#17181C] sm:mt-5"
            >
              {t('aw.firm')}
            </button>
          </section>
        </main>

        {/* ── Why one3seven exists — founder origin (worker-facing) ── */}
        <footer className="pb-6 pt-2">
          <div className="mx-auto max-w-[420px] rounded-[22px] border border-[#E1E4DD] bg-[#FBFBFA] px-5 py-6 text-center">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#42574E]">{t('aw.why')}</div>
            <p className="mx-auto text-[13px] leading-relaxed text-[#40433f] sm:text-[14px]">
              {t('aw.why_body')}
            </p>
            <p className="mt-4 font-semibold leading-snug text-[#17181C]" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(18px, 4vw, 23px)' }}>
              {t('aw.quote')}
            </p>
            <p className="mt-2 text-[12px] font-semibold text-[#5E7268]">{t('aw.founder')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
