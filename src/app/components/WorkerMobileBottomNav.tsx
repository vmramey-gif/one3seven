import { FileText, Files, Home, Route } from 'lucide-react';
import type { WorkerShellScreen } from './WorkerAppShell';

export type WorkerMobileHubView = 'home' | 'statusJourney' | 'summary' | 'intakes';

// 'add' stays in the union for back-compat with the onNavigate handler, but the nav no longer
// renders a "new intake" FAB — starting/continuing lives in the home content now, so the bottom
// bar is just destinations, in the worker's own words.
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
      aria-label="Your navigation"
    >
      <div className="grid grid-cols-4 items-end px-3 pt-2 pb-2.5 max-w-md mx-auto">
        <button type="button" onClick={() => onNavigate('home')} className={tabClass(homeActive)}>
          <Home className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Home
        </button>
        <button type="button" onClick={() => onNavigate('statusJourney')} className={tabClass(statusJourneyActive)}>
          <Route className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Status
        </button>
        <button type="button" onClick={() => onNavigate('summary')} className={tabClass(summaryActive)}>
          <FileText className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          <span className="leading-tight text-center">My file</span>
        </button>
        <button type="button" onClick={() => onNavigate('intakes')} className={tabClass(intakesActive)}>
          <Files className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          <span className="leading-tight text-center">My cases</span>
        </button>
      </div>
    </nav>
  );
}
