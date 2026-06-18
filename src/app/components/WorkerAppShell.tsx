import type { ReactNode } from 'react';
import { FileText, Home, Menu, Settings, Upload } from 'lucide-react';
import type { Screen } from '../App';
import { NotificationsBell } from './NotificationsBell';
import type { AppNotificationItem } from './NotificationsBell';
import { WordMark } from './WordMark';
import {
  WorkerMobileBottomNav,
  type WorkerMobileHubView,
  type WorkerMobileNavId,
} from './WorkerMobileBottomNav';
import { O3S_SHELL_MAIN } from '../constants/visualTheme';

export type WorkerShellScreen = 'landing' | 'upload' | 'summary' | 'processing' | 'workerSettings';

type NavItem = {
  screen: Screen;
  label: string;
  icon: typeof Home;
  shellScreen: WorkerShellScreen;
};

const NAV_ITEMS: NavItem[] = [
  { screen: 'landing', label: 'Home', icon: Home, shellScreen: 'landing' },
  { screen: 'upload', label: 'Add records', icon: Upload, shellScreen: 'upload' },
  { screen: 'summary', label: 'Summary', icon: FileText, shellScreen: 'summary' },
];

type WorkerAppShellProps = {
  children: ReactNode;
  /** When false, renders children only (offline / unsigned routes). */
  enabled?: boolean;
  activeShellScreen: WorkerShellScreen;
  onNavigate: (screen: Screen) => void;
  onOpenSettings?: () => void;
  onWorkerSignOut?: () => void;
  workerBellNotifications?: AppNotificationItem[];
  notificationsPanelNotice?: string;
  /** Hide duplicate top chrome when child screen renders its own back row */
  hideTopChrome?: boolean;
  mobileHubView?: WorkerMobileHubView;
  onMobileNav?: (id: WorkerMobileNavId) => void;
  onCreateNewIntake?: () => void;
};

export function WorkerAppShell({
  children,
  enabled = true,
  activeShellScreen,
  onNavigate,
  onOpenSettings,
  onWorkerSignOut,
  workerBellNotifications = [],
  notificationsPanelNotice,
  hideTopChrome = false,
  mobileHubView = 'home',
  onMobileNav,
  onCreateNewIntake,
}: WorkerAppShellProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const handleMobileNav = (id: WorkerMobileNavId) => {
    if (onMobileNav) {
      onMobileNav(id);
      return;
    }
    if (id === 'summary') onNavigate('summary');
    else if (id === 'home' || id === 'statusJourney' || id === 'intakes') onNavigate('landing');
    else if (id === 'add') {
      if (onCreateNewIntake) onCreateNewIntake();
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--o3s-bg)] text-[var(--o3s-text)] sm:bg-[var(--o3s-obsidian)] sm:text-[var(--o3s-fg)]">
      <aside
        className="hidden sm:flex w-[3.25rem] shrink-0 flex-col items-center border-r border-[var(--o3s-border)] py-5 gap-1 bg-[var(--o3s-obsidian)]"
        aria-label="Main navigation"
      >
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="mb-4 text-[10px] font-medium tracking-[0.2em] text-[var(--o3s-subtle)] hover:text-[var(--o3s-fg)] transition-colors"
          aria-label="one3seven home"
        >
          137
        </button>
        {NAV_ITEMS.map((item) => {
          const active = activeShellScreen === item.shellScreen;
          const Icon = item.icon;
          return (
            <button
              key={item.screen}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.screen)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                active
                  ? 'text-[var(--o3s-cyan)]'
                  : 'text-[var(--o3s-subtle)] hover:text-[var(--o3s-muted)] hover:bg-white/[0.03]'
              }`}
            >
              {active ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-[var(--o3s-cyan)]"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </button>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          {onOpenSettings ? (
            <button
              type="button"
              title="Settings"
              aria-label="Settings"
              onClick={onOpenSettings}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                activeShellScreen === 'workerSettings'
                  ? 'text-[var(--o3s-cyan)]'
                  : 'text-[var(--o3s-subtle)] hover:text-[var(--o3s-muted)] hover:bg-white/[0.03]'
              }`}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </aside>

      <div className={`${O3S_SHELL_MAIN} pb-20 sm:pb-0`}>
        {!hideTopChrome ? (
          <header className="sticky top-0 z-50 border-b border-[var(--o3s-border)] bg-[var(--o3s-surface)]/92 backdrop-blur-md sm:bg-[var(--o3s-obsidian)]/90">
            <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="text-lg font-medium tracking-tight text-[var(--o3s-text)] transition-opacity hover:opacity-80 sm:text-[var(--o3s-fg)]"
              >
                <WordMark />
              </button>
              <div className="flex items-center gap-0.5">
                <NotificationsBell
                  items={workerBellNotifications}
                  panelNotice={notificationsPanelNotice}
                  label="Updates"
                  compact
                />
                {onOpenSettings ? (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="rounded-lg px-2.5 py-2 text-sm text-[var(--o3s-text-muted)] transition-colors hover:bg-[var(--o3s-primary-soft)] hover:text-[var(--o3s-text)] sm:hidden"
                    aria-label="Menu"
                  >
                    <Menu className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                ) : null}
                {onOpenSettings ? (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="hidden rounded-lg px-2.5 py-2 text-sm text-[var(--o3s-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--o3s-fg)] sm:inline-flex"
                  >
                    Settings
                  </button>
                ) : null}
                {onWorkerSignOut ? (
                  <button
                    type="button"
                    onClick={onWorkerSignOut}
                    className="hidden rounded-lg px-2.5 py-2 text-sm text-[var(--o3s-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--o3s-fg)] sm:inline-flex"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          </header>
        ) : null}
        {children}
        <WorkerMobileBottomNav
          activeShellScreen={activeShellScreen}
          mobileHubView={mobileHubView}
          onNavigate={handleMobileNav}
        />
      </div>
    </div>
  );
}
