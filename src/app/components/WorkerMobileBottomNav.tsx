import { FileText, Files, Home, Plus, Route } from 'lucide-react';
import type { WorkerShellScreen } from './WorkerAppShell';

export type WorkerMobileHubView = 'home' | 'statusJourney' | 'summary' | 'intakes';

export type WorkerMobileNavId = 'home' | 'statusJourney' | 'add' | 'summary' | 'intakes';

type WorkerMobileBottomNavProps = {
  activeShellScreen: WorkerShellScreen;
  mobileHubView?: WorkerMobileHubView;
  onNavigate: (id: WorkerMobileNavId) => void;
};

export function WorkerMobileBottomNav({
  activeShellScreen,
  mobileHubView = 'home',
  onNavigate,
}: WorkerMobileBottomNavProps) {
  const onLanding = activeShellScreen === 'landing';
  const homeActive = onLanding && mobileHubView === 'home';
  const statusJourneyActive = onLanding && mobileHubView === 'statusJourney';
  const summaryActive = activeShellScreen === 'summary' || (onLanding && mobileHubView === 'summary');
  const intakesActive = onLanding && mobileHubView === 'intakes';

  const tabClass = (active: boolean) =>
    `flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-[var(--o3s-primary-soft)] text-[var(--o3s-primary)]'
        : 'text-[var(--o3s-text-muted)] hover:bg-[var(--o3s-bg-soft)] hover:text-[var(--o3s-text)]'
    }`;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--o3s-border)] bg-[var(--o3s-surface)]/96 shadow-[0_-12px_32px_rgba(24,31,67,0.1)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 items-end px-2 pt-2 pb-2.5 max-w-lg mx-auto">
        <button type="button" onClick={() => onNavigate('home')} className={tabClass(homeActive)}>
          <Home className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Home
        </button>
        <button
          type="button"
          onClick={() => onNavigate('statusJourney')}
          className={tabClass(statusJourneyActive)}
        >
          <Route className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          <span className="leading-tight text-center">Status</span>
        </button>
        <div className="flex flex-col items-center -mt-5">
          <button
            type="button"
            onClick={() => onNavigate('add')}
            aria-label="Start new intake"
            className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-[var(--o3s-primary)] text-white shadow-[var(--o3s-shadow-button)] ring-4 ring-[var(--o3s-surface)] transition-colors hover:bg-[var(--o3s-primary-hover)]"
          >
            <Plus className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </button>
          <span className="mt-1 text-[11px] font-semibold text-[var(--o3s-text-muted)]">+</span>
        </div>
        <button type="button" onClick={() => onNavigate('summary')} className={tabClass(summaryActive)}>
          <FileText className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Summary
        </button>
        <button type="button" onClick={() => onNavigate('intakes')} className={tabClass(intakesActive)}>
          <Files className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Intakes
        </button>
      </div>
    </nav>
  );
}
