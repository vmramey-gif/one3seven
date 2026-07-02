import { useState } from 'react';
import { WordMark } from '../components/WordMark';
import { ArrowRight } from 'lucide-react';
import { Screen } from '../App';

interface AuthWelcomeScreenProps {
  onNavigate: (screen: Screen) => void;
  /** Clears firm sign-in intent and opens Sign In (normal path). */
  onOpenSignIn?: () => void;
  /** Sets firm sign-in intent and opens Sign In (participating firm path). */
  onFirmSignIn?: () => void;
  /** Clears firm sign-in intent and opens Create Account. */
  onOpenCreateAccount?: () => void;
}

export function AuthWelcomeScreen({
  onNavigate,
  onOpenSignIn,
  onFirmSignIn,
  onOpenCreateAccount,
}: AuthWelcomeScreenProps) {
  const [isOrganizingStack, setIsOrganizingStack] = useState(false);
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
    <div className="min-h-screen bg-[#f6f2ff] px-5 py-4 text-[#1e1b4b] sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[480px] flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('publicMarketing')}
            className="text-[15px] font-semibold tracking-tight text-[#1e1b4b] transition hover:opacity-80"
            aria-label="one3seven — home"
          >
            <WordMark />
          </button>
          <button
            type="button"
            onClick={openSignIn}
            className="rounded-full border border-[#ded6ff] bg-white/80 px-4 py-2 text-sm font-medium text-[#5b35d5] shadow-sm transition hover:bg-white"
          >
            Sign in
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-5 sm:py-10">
          <div className="mb-5 rounded-[28px] border border-[#e7e1ff] bg-white/82 p-3 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:mb-10 sm:rounded-[34px] sm:p-5">
            <div
              className={`relative mx-auto h-[168px] max-w-[300px] transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[248px] sm:max-w-[360px] ${
                isOrganizingStack ? '-translate-y-4 scale-[0.94]' : ''
              }`}
            >
              <div className="absolute inset-x-10 bottom-4 h-10 rounded-full bg-[#6d4aff]/10 blur-2xl" />
              {stackCards.map((card, index) => (
                <div
                  key={card.label}
                  className={`absolute left-1/2 top-1/2 w-[152px] -translate-x-1/2 rounded-[16px] border border-[#e7e1ff] bg-white px-3 py-2.5 shadow-[0_18px_38px_rgba(31,27,75,0.13)] transition-all duration-[2100ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[190px] sm:rounded-[20px] sm:px-4 sm:py-3 ${
                    isOrganizingStack
                      ? `${card.to} scale-[0.88] opacity-0`
                      : `${card.from} scale-100 opacity-100`
                  }`}
                  style={{ zIndex: index + 1, transitionDelay: isOrganizingStack ? `${index * 70}ms` : '0ms' }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                    <div className="h-1.5 w-10 rounded-full bg-[#6d4aff]/18 sm:h-2 sm:w-12" />
                    <div className="h-5 w-5 rounded-lg border border-[#e7e1ff] bg-[#f6f2ff] sm:h-6 sm:w-6" />
                  </div>
                  <div className="mb-1.5 h-1 w-20 rounded-full bg-[#1e1b4b]/10 sm:mb-2 sm:h-1.5 sm:w-24" />
                  <div className="mb-2.5 h-1 w-14 rounded-full bg-[#1e1b4b]/8 sm:mb-4 sm:h-1.5 sm:w-16" />
                  <div className="text-[10px] font-semibold text-[#1e1b4b] sm:text-xs">{card.label}</div>
                </div>
              ))}
              <div
                className={`absolute left-1/2 top-1/2 z-20 w-[168px] -translate-x-1/2 rounded-[20px] border border-[#dcd3ff] bg-[#fbf9ff] px-4 py-4 shadow-[0_22px_48px_rgba(31,27,75,0.14)] transition-all duration-[1900ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[210px] sm:rounded-[24px] sm:px-5 sm:py-5 ${
                  isOrganizingStack
                    ? '-translate-y-[20px] scale-100 opacity-100'
                    : 'translate-y-[48px] scale-90 opacity-0'
                }`}
              >
                <div className="mb-3 h-6 w-16 rounded-t-[10px] bg-[#6d4aff]/18 sm:mb-4 sm:h-8 sm:w-20 sm:rounded-t-[12px]" />
                <div className="rounded-[14px] border border-[#e7e1ff] bg-white p-3 sm:rounded-[18px] sm:p-4">
                  <div className="mb-2 h-1.5 w-20 rounded-full bg-[#6d4aff]/22 sm:h-2 sm:w-24" />
                  <div className="h-1 w-24 rounded-full bg-[#1e1b4b]/10 sm:h-1.5 sm:w-28" />
                </div>
              </div>
            </div>
          </div>

          <section className="text-center">
            <h1 className="text-[31px] font-semibold leading-[1.03] tracking-tight text-[#1e1b4b] sm:text-[38px]">
              Your records are everywhere.
              <br />
              Your story doesn't have to be.
            </h1>
            <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-relaxed text-[#1e1b4b]/68 sm:mt-5 sm:text-[15px]">
              Organize documents, conversations, timelines, and records in one place before speaking
              with an attorney.
            </p>

            <div className="mt-5 space-y-2.5 sm:mt-8 sm:space-y-3">
              <button
                type="button"
                onClick={startOrganizing}
                disabled={isOrganizingStack}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6d4aff] px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_48px_rgba(109,74,255,0.28)] transition hover:-translate-y-0.5 hover:bg-[#5b35d5] disabled:translate-y-0 disabled:opacity-80 sm:py-4"
              >
                {isOrganizingStack ? 'Organizing...' : 'Start Organizing'}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={openSignIn}
                className="text-sm font-medium text-[#5b35d5] transition hover:text-[#4322b8]"
              >
                Sign in
              </button>
            </div>

            <button
              type="button"
              onClick={openFirmSignIn}
              className="mt-3 text-xs font-medium text-[#1e1b4b]/55 transition hover:text-[#1e1b4b] sm:mt-5"
            >
              Participating firm?
            </button>
          </section>
        </main>

        {/* ── Why one3seven exists — founder origin (worker-facing) ── */}
        <footer className="pb-6 pt-2">
          <div className="mx-auto max-w-[420px] rounded-[22px] border border-[#e7e1ff] bg-white/70 px-5 py-6 text-center">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#5b35d5]">Why one3seven exists</div>
            <p className="mx-auto text-[13px] leading-relaxed text-[#1e1b4b]/70 sm:text-[14px]">
              one3seven was built by someone who went through her own legal situation — and had to write out her whole story from scratch every time she talked to a new attorney. Scattered records, retold from memory, over and over. There had to be a better way.
            </p>
            <p className="mt-4 font-medium leading-snug text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(18px, 4vw, 23px)' }}>
              &ldquo;You should only have to tell your story once.&rdquo;
            </p>
            <p className="mt-2 text-[12px] font-semibold text-[#5b35d5]">&mdash; Victoria, founder</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
