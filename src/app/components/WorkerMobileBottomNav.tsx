import { FileText, Home, Route } from 'lucide-react';
import type { WorkerShellScreen } from './WorkerAppShell';

export type WorkerMobileHubView = 'home' | 'statusJourney' | 'summary' | 'intakes';

// 'add'/'summary' stay in the union for back-compat with the onNavigate handler, but the bar
// renders three worker-language destinations only. Starting/continuing lives in the home content,
// and a worker's file is reached from their case — so "My file" and "My cases" (the detail and the
// list of the same thing) collapse into one "My case" tab.
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
  // "My case" covers both the list of cases and an open file (the detail).
  const caseActive =
    activeShellScreen === 'summary' ||
    (onLanding && (mobileHubView === 'intakes' || mobileHubView === 'summary'));

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
      <div className="grid grid-cols-3 items-end px-4 pt-2 pb-2.5 max-w-sm mx-auto">
        <button type="button" onClick={() => onNavigate('home')} className={tabClass(homeActive)}>
          <Home className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Home
        </button>
        <button type="button" onClick={() => onNavigate('statusJourney')} className={tabClass(statusJourneyActive)}>
          <Route className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          Status
        </button>
        <button type="button" onClick={() => onNavigate('intakes')} className={tabClass(caseActive)}>
          <FileText className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          <span className="leading-tight text-center">My case</span>
        </button>
      </div>
    </nav>
  );
}
