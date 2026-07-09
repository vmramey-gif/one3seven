import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, CheckCircle2, FileCheck, X } from 'lucide-react';
import { Screen } from '../App';
import {
  ONE3SEVEN_NOTICES,
  formatWorkerWorkflowStatusForDisplay,
  isParticipatingSubmissionChannel,
  workerParticipatingPreviewSent,
  PARTICIPATING_NETWORK_COPY,
  formatRouteStatusForWorker,
  linkedFirmIntakeAlreadyShared,
} from '../constants/one3sevenProduct';
import { ParticipatingNetworkStatusSection } from '../components/ParticipatingNetworkStatusSection';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import { WorkerFirmCodeSection } from '../components/WorkerFirmCodeSection';
import { WorkerExpandableSection } from '../components/WorkerExpandableSection';
import type { WorkerIntakeFirmRoutingCard } from '../../services/intakeDataService';
import { formatWorkerIntakeLastActivity } from '../utils/workerDashboardFormat';
import { WordMark } from '../components/WordMark';
import {
  WORKER_HUB_COPY,
  WORKER_INTAKE_ACTIONS,
  WORKER_INTAKE_SECTIONS,
} from '../constants/workerIntakePresentation';
import { EmploymentMatterTagsLine } from '../components/EmploymentMatterTagsLine';
import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import { displayCaseCategoryLabel, isBetaEmploymentCategory } from '../constants/employmentMatter';
import { WorkerMobileDocRequestCard } from '../components/WorkerMobileDocRequestCard';
import { WorkerMissionControlHome } from '../components/WorkerMissionControlHome';
import { WorkerMobileBottomNav, type WorkerMobileHubView, type WorkerMobileNavId } from '../components/WorkerMobileBottomNav';
import { WorkerStatusJourneyCard } from '../components/WorkerStatusJourneyCard';
import { WorkerDocumentRequestDashboardCard } from '../components/WorkerDocumentRequestDashboardCard';
import { WorkerIntakeCompactRow } from '../components/WorkerIntakeCompactRow';
import type { WorkerDocumentRequestStatus } from '../utils/workerDocumentRequest';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import {
  O3S_BTN_GHOST,
  O3S_BTN_PRIMARY,
} from '../constants/visualTheme';

export type WorkerIntakeListRow = {
  id: string;
  intake_number: string;
  workflow_status: string;
  updated_at: string;
  has_summary: boolean;
  case_category?: string | null;
};

interface LandingScreenProps {
  onNavigate: (screen: Screen) => void;
  /** When set, replaces default navigation to upload (e.g. create Supabase intake first). */
  onStartOrganizing?: () => void;
  /** Signed-in worker: show law-firm question before creating intake / upload. */
  requireLawFirmChoiceBeforeOrganizing?: boolean;
  /** Supabase-backed firm code lookup available */
  firmCodeRoutingAvailable?: boolean;
  onContinueOrganizing?: (choice: 'continue_without' | 'enter_firm_code') => void;
  onOpenSettings?: () => void;
  onGoWorkerDashboard?: () => void;
  onGoWorkerSummary?: () => void;
  onOpenWorkerSummaryForIntake?: (intakeId: string) => void;
  onOpenWorkerIntakeWorkspaceForIntake?: (intakeId: string) => void;
  /** Open intake summary scrolled to firm notes (Supabase worker). */
  onOpenWorkerFirmNotes?: () => void;
  onWorkerSignOut?: () => void;
  workerBellNotifications?: AppNotificationItem[];
  workerActionNeededIntakeIds?: string[];
  activeIntakeHub?: {
    intakeId?: string | null;
    intakeNumber: string;
    caseCategory?: string | null;
    workflow: string;
    channel: string | null;
    firmName: string | null;
    firmCode?: string | null;
    routeStatus?: string | null;
    routeSharedAt?: string | null;
  };
  workerIntakeRoutingCards?: WorkerIntakeFirmRoutingCard[];
  firmCodeActionBusy?: boolean;
  firmCodeActionError?: string | null;
  onAddFirmCodeForIntake?: (intakeId: string) => void;
  onRemoveFirmCodeForIntake?: (intakeId: string) => Promise<{ error?: string }>;
  onDeleteWorkerIntake?: (intakeId: string) => Promise<{ error?: string }>;
  deleteIntakeBusyId?: string | null;
  deleteIntakeError?: string | null;
  deleteIntakeErrorIntakeId?: string | null;
  onClearDeleteIntakeError?: () => void;
  onSelectWorkerIntake?: (intakeId: string) => void;
  workerDocumentRequestAlert?: {
    status: WorkerDocumentRequestStatus;
    firmName: string | null;
    categories: string[];
    note: string;
  };
  onReviewDocumentRequest?: () => void;
  onCreateNewIntake?: () => void;
  createNewIntakeBusy?: boolean;
  notificationsPanelNotice?: string;
  organizationRecoveryNotice?: string | null;
  /** Set when worker arrived via ?fc= link — drives firm-directed hero copy. */
  firmDirectedContext?: { firmId: string; firmName: string; firmCode: string } | null;
  /** Signed-in worker: notifications + settings row */
  showWorkerHub?: boolean;
  /** Hide hero “Start organizing” once the worker has organizing activity (uploads, active intake, or saved intakes). */
  showStartOrganizingHero?: boolean;
  /** When true, top nav is rendered by WorkerAppShell */
  shellMode?: boolean;
  hubTimelinePreview?: WorkerTimelineItem[];
  hubRecordCount?: number;
  hubEventCount?: number;
  hubGapCount?: number;
  workerGreetingName?: string | null;
  mobileHubView?: WorkerMobileHubView;
}

function firmRoutingPeekLine(card: {
  submissionChannel: string | null;
  workflowStatus: string;
  linkedFirmName: string | null;
  linkedFirmCode: string | null;
  routeStatus: string | null;
}): string {
  if (isParticipatingSubmissionChannel(card.submissionChannel)) {
    const sent = workerParticipatingPreviewSent(card.submissionChannel, card.workflowStatus);
    const status = formatWorkerWorkflowStatusForDisplay(card.workflowStatus, card.submissionChannel);
    return [PARTICIPATING_NETWORK_COPY.channelLabel, status, sent ? 'Preview sent' : 'Not sent yet']
      .filter(Boolean)
      .join(' · ');
  }
  const connected = Boolean((card.linkedFirmName ?? '').trim() || (card.linkedFirmCode ?? '').trim());
  if (!connected) return 'No firm connected';
  const firm = (card.linkedFirmName ?? '').trim() || 'your firm';
  const shared = linkedFirmIntakeAlreadyShared(card.routeStatus);
  const routeLabel = formatRouteStatusForWorker(card.routeStatus, card.submissionChannel);
  if (shared) return `Shared with ${firm}${routeLabel ? ` · ${routeLabel}` : ''}`;
  return `Connected to ${firm} · not shared yet`;
}

export function LandingScreen({
  onNavigate,
  onStartOrganizing,
  requireLawFirmChoiceBeforeOrganizing,
  firmCodeRoutingAvailable,
  onContinueOrganizing,
  onOpenSettings,
  onGoWorkerDashboard,
  onGoWorkerSummary,
  onOpenWorkerSummaryForIntake,
  onOpenWorkerIntakeWorkspaceForIntake,
  onOpenWorkerFirmNotes,
  onWorkerSignOut,
  workerBellNotifications = [],
  workerActionNeededIntakeIds = [],
  activeIntakeHub,
  workerIntakeRoutingCards = [],
  firmCodeActionBusy = false,
  firmCodeActionError = null,
  onAddFirmCodeForIntake,
  onRemoveFirmCodeForIntake,
  onDeleteWorkerIntake,
  deleteIntakeBusyId = null,
  deleteIntakeError = null,
  deleteIntakeErrorIntakeId = null,
  onClearDeleteIntakeError,
  onSelectWorkerIntake,
  workerDocumentRequestAlert,
  onReviewDocumentRequest,
  onCreateNewIntake,
  createNewIntakeBusy = false,
  notificationsPanelNotice,
  organizationRecoveryNotice = null,
  firmDirectedContext = null,
  showWorkerHub = false,
  showStartOrganizingHero = true,
  shellMode = false,
  hubTimelinePreview = [],
  hubRecordCount = 0,
  hubEventCount = 0,
  hubGapCount = 0,
  workerGreetingName = null,
  mobileHubView = 'home',
}: LandingScreenProps) {
  const [showLawFirmModal, setShowLawFirmModal] = useState(false);
  const [pendingDeleteIntakeId, setPendingDeleteIntakeId] = useState<string | null>(null);
  const workerIntakesSectionRef = useRef<HTMLElement | null>(null);
  const [pendingOpenIntakeId, setPendingOpenIntakeId] = useState<string | null>(null);
  const [openIntakeFeedbackNonce, setOpenIntakeFeedbackNonce] = useState(0);
  const [activeIntakeHighlight, setActiveIntakeHighlight] = useState(false);
  const [openIntakeFeedback, setOpenIntakeFeedback] = useState<string | null>(null);
  const [docRequestDismissed, setDocRequestDismissed] = useState(false);
  const [mobileNavSection, setMobileNavSection] = useState<WorkerMobileHubView>(mobileHubView);
  const [selectedStatusIntakeId, setSelectedStatusIntakeId] = useState<string | null>(
    activeIntakeHub?.intakeId ?? workerIntakeRoutingCards[0]?.intakeId ?? null
  );
  const intakeRowRefs = useRef<Record<string, HTMLElement | null>>({});

  const hasSavedIntakes = workerIntakeRoutingCards.length > 0;
  const workerDashboardCompact = showWorkerHub && (hasSavedIntakes || Boolean(activeIntakeHub));

  useEffect(() => {
    setMobileNavSection(mobileHubView);
  }, [mobileHubView]);

  const handleOpenWorkerIntake = (intakeId: string) => {
    if (!onSelectWorkerIntake) return;
    setMobileNavSection('intakes');
    onSelectWorkerIntake(intakeId);
    setPendingOpenIntakeId(intakeId);
    setOpenIntakeFeedbackNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!pendingOpenIntakeId || openIntakeFeedbackNonce === 0) return;
    if (activeIntakeHub?.intakeId !== pendingOpenIntakeId) return;

    const intakeNumber =
      activeIntakeHub.intakeNumber?.trim() ||
      workerIntakeRoutingCards.find((c) => c.intakeId === pendingOpenIntakeId)?.intakeNumber?.trim() ||
      'this intake';

    if (!workerDashboardCompact) {
      setOpenIntakeFeedback(`Now viewing intake ${intakeNumber}.`);
    }
    setActiveIntakeHighlight(true);

    const scroll = () => {
      if (workerDashboardCompact) {
        intakeRowRefs.current[pendingOpenIntakeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        workerIntakesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scroll);
    });

    const highlightOff = window.setTimeout(() => setActiveIntakeHighlight(false), 1800);
    const feedbackOff = window.setTimeout(() => {
      setOpenIntakeFeedback(null);
      setPendingOpenIntakeId(null);
    }, 3200);

    return () => {
      window.clearTimeout(highlightOff);
      window.clearTimeout(feedbackOff);
    };
  }, [
    openIntakeFeedbackNonce,
    pendingOpenIntakeId,
    activeIntakeHub?.intakeId,
    activeIntakeHub?.intakeNumber,
    workerIntakeRoutingCards,
    workerDashboardCompact,
  ]);

  const openOrganizeFlow = () => {
    if (requireLawFirmChoiceBeforeOrganizing && onContinueOrganizing) {
      setShowLawFirmModal(true);
      return;
    }
    if (onStartOrganizing) {
      onStartOrganizing();
      return;
    }
    onNavigate('upload');
  };

  const handleLawFirmChoice = (choice: 'continue_without' | 'enter_firm_code') => {
    if (choice === 'enter_firm_code' && !firmCodeRoutingAvailable) {
      window.alert(
        'Firm code routing is available when your workspace is connected (beta). You can continue without a firm code and organize your records locally.'
      );
      return;
    }
    setShowLawFirmModal(false);
    onContinueOrganizing?.(choice);
  };

  const goSummary = () => {
    if (onGoWorkerSummary) onGoWorkerSummary();
    else window.alert('Sign in with a connected workspace (beta) to open your intake summary.');
  };

  const scrollToWorkerIntakes = () => {
    setMobileNavSection('intakes');
    requestAnimationFrame(() => {
      workerIntakesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const isHomeTab = mobileNavSection === 'home';
  const isStatusJourneyTab = mobileNavSection === 'statusJourney';
  const isSummaryTab = mobileNavSection === 'summary';
  const isIntakesTab = mobileNavSection === 'intakes';

  const handleFreshIntakeAdd = () => {
    if (!onCreateNewIntake || createNewIntakeBusy) return;
    onCreateNewIntake();
  };

  const handleWorkerMobileNav = (id: WorkerMobileNavId) => {
    if (id === 'home') {
      setMobileNavSection('home');
      if (onGoWorkerDashboard) onGoWorkerDashboard();
      else onNavigate('landing');
      return;
    }
    if (id === 'statusJourney') {
      setMobileNavSection('statusJourney');
      if (onGoWorkerDashboard) onGoWorkerDashboard();
      else onNavigate('landing');
      return;
    }
    if (id === 'summary') {
      setMobileNavSection('summary');
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      return;
    }
    if (id === 'intakes') {
      setMobileNavSection('intakes');
      scrollToWorkerIntakes();
      return;
    }
    if (id === 'add') {
      handleFreshIntakeAdd();
    }
  };

  const sortedIntakeCards = useMemo(() => {
    const cards = workerIntakeRoutingCards;
    const activeId = activeIntakeHub?.intakeId;
    if (!activeId) return cards;
    const active = cards.find((c) => c.intakeId === activeId);
    const rest = cards.filter((c) => c.intakeId !== activeId);
    return active ? [active, ...rest] : cards;
  }, [workerIntakeRoutingCards, activeIntakeHub?.intakeId]);

  const summaryReadyCards = useMemo(
    () => sortedIntakeCards.filter((card) => card.hasSummary),
    [sortedIntakeCards]
  );

  const statusJourneyOptions = useMemo(() => {
    const options = sortedIntakeCards.map((card) => ({
      intakeId: card.intakeId,
      intakeNumber: card.intakeNumber,
      title: 'Employment Records Intake',
      workflow: card.workflowStatus,
      channel: card.submissionChannel,
      routeStatus: card.routeStatus,
    }));

    if (
      activeIntakeHub?.intakeId &&
      !options.some((option) => option.intakeId === activeIntakeHub.intakeId)
    ) {
      options.unshift({
        intakeId: activeIntakeHub.intakeId,
        intakeNumber: activeIntakeHub.intakeNumber,
        title: 'Employment Records Intake',
        workflow: activeIntakeHub.workflow,
        channel: activeIntakeHub.channel,
        routeStatus: activeIntakeHub.routeStatus ?? null,
      });
    }

    return options;
  }, [sortedIntakeCards, activeIntakeHub]);

  useEffect(() => {
    if (statusJourneyOptions.length === 0) {
      if (selectedStatusIntakeId !== null) setSelectedStatusIntakeId(null);
      return;
    }

    const preferredId = activeIntakeHub?.intakeId ?? statusJourneyOptions[0]?.intakeId ?? null;
    const selectedStillExists = statusJourneyOptions.some(
      (option) => option.intakeId === selectedStatusIntakeId
    );

    if (!selectedStatusIntakeId || !selectedStillExists) {
      setSelectedStatusIntakeId(preferredId);
    }
  }, [activeIntakeHub?.intakeId, selectedStatusIntakeId, statusJourneyOptions]);

  const selectedStatusJourney =
    statusJourneyOptions.find((option) => option.intakeId === selectedStatusIntakeId) ??
    statusJourneyOptions[0] ??
    null;

  const docRequestPending = workerDocumentRequestAlert?.status === 'pending';
  const showDocRequestCard =
    Boolean(workerDocumentRequestAlert) &&
    onReviewDocumentRequest &&
    (!docRequestPending || !docRequestDismissed);
  const mobileShellHub = showWorkerHub && shellMode;

  const missionControlWorkflow =
    activeIntakeHub?.workflow ?? sortedIntakeCards[0]?.workflowStatus ?? null;
  const missionControlChannel =
    activeIntakeHub?.channel ?? sortedIntakeCards[0]?.submissionChannel ?? null;
  const missionControlRouteStatus =
    activeIntakeHub?.routeStatus ?? sortedIntakeCards[0]?.routeStatus ?? null;
  const workerWelcomeIntakeCount = sortedIntakeCards.length || (activeIntakeHub ? 1 : 0);
  const firstUnreadNotification = workerBellNotifications.find((n) => n.isRead !== true) ?? null;
  const runFirstUnreadNotificationAction = firstUnreadNotification
    ? () => {
        if (firstUnreadNotification.onItemClick) {
          void firstUnreadNotification.onItemClick();
          return;
        }
        if (firstUnreadNotification.onAction) {
          void firstUnreadNotification.onAction();
          return;
        }
        const firstAction = firstUnreadNotification.actions?.[0];
        if (firstAction) void firstAction.onClick();
      }
    : null;
  const handleWorkerWelcomeContinueIntake = () => {
    const onlyIntakeId = sortedIntakeCards[0]?.intakeId ?? activeIntakeHub?.intakeId ?? null;
    if (onlyIntakeId && onSelectWorkerIntake) {
      handleOpenWorkerIntake(onlyIntakeId);
      return;
    }
    openOrganizeFlow();
  };
  const workerWelcomePrimaryActionLabel = firstUnreadNotification
    ? runFirstUnreadNotificationAction
      ? 'View notification'
      : null
    : workerWelcomeIntakeCount === 0
      ? '✨ Should we begin organizing?'
      : workerWelcomeIntakeCount === 1
        ? 'Continue intake'
        : 'View intakes';
  const handleWorkerWelcomePrimaryAction = firstUnreadNotification
    ? runFirstUnreadNotificationAction ?? undefined
    : workerWelcomeIntakeCount === 0
      ? openOrganizeFlow
      : workerWelcomeIntakeCount === 1
        ? handleWorkerWelcomeContinueIntake
        : scrollToWorkerIntakes;

  const renderFirmRoutingModule = (
    opts: {
      channel: string | null;
      workflow: string;
      firmName: string | null;
      firmCode?: string | null;
      routeStatus?: string | null;
      routeSharedAt?: string | null;
      intakeId?: string | null;
      previewSent?: boolean;
      size?: 'default' | 'compact';
      firmCodeError?: string | null;
    },
    key: string
  ) => {
    const size = opts.size ?? 'default';
    const routingError = opts.firmCodeError ?? null;
    const peek = firmRoutingPeekLine({
      submissionChannel: opts.channel,
      workflowStatus: opts.workflow,
      linkedFirmName: opts.firmName,
      linkedFirmCode: opts.firmCode ?? null,
      routeStatus: opts.routeStatus ?? null,
    });
    const noFirmConnected =
      !isParticipatingSubmissionChannel(opts.channel) &&
      !((opts.firmName ?? '').trim() || (opts.firmCode ?? '').trim());
    return (
      <WorkerExpandableSection
        key={key}
        title={WORKER_INTAKE_SECTIONS.firmActivity}
        meta={noFirmConnected ? 'No firm connected — tap to add a firm code' : peek}
        defaultOpen={noFirmConnected}
        size={size}
        className={workerDashboardCompact ? 'bg-white/80' : 'bg-[#F8F6FF]'}
      >
        {isParticipatingSubmissionChannel(opts.channel) ? (
          <ParticipatingNetworkStatusSection
            className="bg-white border-0 px-0 py-0"
            workflowStatus={opts.workflow}
            submissionChannel={opts.channel}
            previewSent={opts.previewSent}
          />
        ) : (
          <WorkerFirmCodeSection
            className="bg-white border-0 px-0 py-0"
            firmName={opts.firmName}
            firmCode={opts.firmCode}
            routeStatus={opts.routeStatus}
            routeSharedAt={opts.routeSharedAt}
            submissionChannel={opts.channel}
            busy={firmCodeActionBusy}
            error={routingError}
            onAddFirmCode={
              onAddFirmCodeForIntake && opts.intakeId
                ? () => onAddFirmCodeForIntake(opts.intakeId!)
                : undefined
            }
            onRemoveFirmCode={
              onRemoveFirmCodeForIntake && opts.intakeId
                ? () => onRemoveFirmCodeForIntake(opts.intakeId!)
                : undefined
            }
          />
        )}
      </WorkerExpandableSection>
    );
  };

  const renderMissionControlHome = () => (
    <section className="px-4 sm:px-8 pt-5 pb-6 scroll-mt-4 max-w-3xl">
      <WorkerMissionControlHome
        greetingName={workerGreetingName}
      />
    </section>
  );

  const renderStatusJourneyTab = () => (
    <section className="px-5 sm:px-8 pt-5 pb-6 scroll-mt-4 max-w-3xl">
      {selectedStatusJourney ? (
        <div className="mb-4 rounded-3xl border border-[#CBD6CF] bg-white/90 p-4 text-center shadow-[0_18px_45px_rgba(91,53,213,0.08)]">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#42574E]">
                Status Journey
              </p>
              <h2 className="mt-2 break-words text-lg font-semibold text-[#1E1B4B]">
                {selectedStatusJourney.title}
              </h2>
              <p className="mt-1 break-words text-xs text-[#64748B]">
                Reference: {selectedStatusJourney.intakeNumber}
              </p>
            </div>
            {statusJourneyOptions.length > 1 ? (
              <label className="flex w-full max-w-md flex-col gap-1 text-left text-xs font-medium text-[#1E1B4B]/70">
                Choose intake
                <select
                  value={selectedStatusJourney.intakeId}
                  onChange={(event) => setSelectedStatusIntakeId(event.target.value)}
                  className="w-full max-w-full rounded-2xl border border-[#CBD6CF] bg-[#FBFAFF] px-3 py-2 text-sm font-medium text-[#1E1B4B] shadow-sm outline-none transition focus:border-[#42574E] focus:ring-2 focus:ring-[#CBD6CF]"
                >
                  {statusJourneyOptions.map((option) => (
                    <option key={option.intakeId} value={option.intakeId}>
                      {option.title} - Ref: {option.intakeNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
      <WorkerStatusJourneyCard
        variant="rail"
        showSubtitle
        workflow={selectedStatusJourney?.workflow ?? missionControlWorkflow}
        channel={selectedStatusJourney?.channel ?? missionControlChannel}
        routeStatus={selectedStatusJourney?.routeStatus ?? missionControlRouteStatus}
      />
    </section>
  );

  const renderCompactIntakeList = () => (
    <div className="space-y-3">
      {sortedIntakeCards.map((card) => {
        const isActive = activeIntakeHub?.intakeId === card.intakeId;
        const lastActivity = formatWorkerIntakeLastActivity(card.updatedAt);
        const statusLabel =
          docRequestPending && showDocRequestCard && isActive
            ? null
            : formatWorkerWorkflowStatusForDisplay(card.workflowStatus, card.submissionChannel);
        const highlighted = isActive && activeIntakeHighlight;
        const actionNeeded = workerActionNeededIntakeIds.includes(card.intakeId);
        return (
          <div
            key={card.intakeId}
            ref={(el) => {
              intakeRowRefs.current[card.intakeId] = el;
            }}
          >
            <WorkerIntakeCompactRow
              intakeNumber={card.intakeNumber}
              statusLabel={statusLabel}
              lastActivity={lastActivity}
              highlighted={highlighted}
              actionNeeded={actionNeeded}
              onOpenWorkspace={
                onOpenWorkerIntakeWorkspaceForIntake
                  ? () => onOpenWorkerIntakeWorkspaceForIntake(card.intakeId)
                  : isActive
                    ? openOrganizeFlow
                    : undefined
              }
            >
              {card.hasSummary ? (
                <p className="text-xs text-[var(--o3s-muted)]">{WORKER_HUB_COPY.summaryReady}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {!card.hasSummary && isActive ? (
                  <button
                    type="button"
                    onClick={openOrganizeFlow}
                    className={`text-xs px-3 py-2 ${O3S_BTN_GHOST}`}
                  >
                    Continue Intake
                  </button>
                ) : null}
                {onDeleteWorkerIntake ? (
                  <button
                    type="button"
                    disabled={deleteIntakeBusyId === card.intakeId}
                    onClick={() => {
                      onClearDeleteIntakeError?.();
                      setPendingDeleteIntakeId(card.intakeId);
                    }}
                    className="text-xs text-red-400/90 hover:text-red-300 disabled:opacity-50 px-1 py-2"
                  >
                    {deleteIntakeBusyId === card.intakeId ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </div>
              {deleteIntakeError && deleteIntakeErrorIntakeId === card.intakeId ? (
                <p className="text-xs text-red-400">{deleteIntakeError}</p>
              ) : null}
              {renderFirmRoutingModule(
                {
                  channel: card.submissionChannel,
                  workflow: card.workflowStatus,
                  firmName: card.linkedFirmName,
                  firmCode: card.linkedFirmCode,
                  routeStatus: card.routeStatus,
                  intakeId: card.intakeId,
                  previewSent: workerParticipatingPreviewSent(
                    card.submissionChannel,
                    card.workflowStatus
                  ),
                  size: 'compact',
                  firmCodeError:
                    activeIntakeHub?.intakeId === card.intakeId ? firmCodeActionError : null,
                },
                card.intakeId
              )}
            </WorkerIntakeCompactRow>
          </div>
        );
      })}
    </div>
  );

  const renderSummaryHome = () => (
    <section className="px-5 sm:px-8 pt-5 pb-6 max-w-3xl scroll-mt-4">
      <div className="mb-4">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">
          Summary
        </h2>
        <p className="text-xs leading-relaxed text-[#1E1B4B]/64">
          Completed organized summaries are available here for review.
        </p>
      </div>

      {summaryReadyCards.length > 0 ? (
        <div className="space-y-3">
          {summaryReadyCards.map((card) => {
            const lastActivity = formatWorkerIntakeLastActivity(card.updatedAt);
            const statusLabel = formatWorkerWorkflowStatusForDisplay(
              card.workflowStatus,
              card.submissionChannel
            );
            return (
              <article
                key={card.intakeId}
                className="rounded-[18px] border border-[#D3DED6] bg-white/94 p-4 shadow-[0_18px_42px_rgba(67,56,202,0.08)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[#42574E]">
                      <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      <p className="text-sm font-semibold text-[#1E1B4B]">
                        Employment Intake Summary
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-[#1E1B4B]/50">
                      Reference: {card.intakeNumber}
                    </p>
                    <p className="mt-1 text-xs text-[#1E1B4B]/64">
                      {statusLabel}
                      {lastActivity ? ` - ${lastActivity}` : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenWorkerSummaryForIntake) {
                        onOpenWorkerSummaryForIntake(card.intakeId);
                        return;
                      }
                      if (activeIntakeHub?.intakeId === card.intakeId && onGoWorkerSummary) {
                        goSummary();
                      }
                    }}
                    disabled={!onOpenWorkerSummaryForIntake && activeIntakeHub?.intakeId !== card.intakeId}
                    className="w-full rounded-[14px] border border-[#42574E] bg-[#42574E] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(109,74,255,0.18)] transition-colors hover:bg-[#374A42] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    View Summary
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[18px] border border-[#D3DED6] bg-white/90 px-4 py-8 text-center text-sm leading-relaxed text-[#1E1B4B]/64">
          No completed summaries yet. Organize an intake first, then its Employment Intake Summary will appear here.
        </p>
      )}
    </section>
  );

  return (
    <div className={`min-h-screen bg-[#F2F4EC] text-[#1E1B4B]${showWorkerHub ? ' pb-24 sm:pb-0' : ''}`}>
      {/* Top Navigation */}
      {!shellMode ? (
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md ${
        showWorkerHub
          ? 'border-[#D3DED6] bg-white/86'
          : 'border-[#D3DED6] bg-white/90'
      }`}>
        <div className={`flex flex-col gap-2 px-6 ${showWorkerHub || workerDashboardCompact ? 'py-2.5' : 'py-5'}`}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => (showWorkerHub && onGoWorkerDashboard ? onGoWorkerDashboard() : onNavigate('landing'))}
              className={`${showWorkerHub ? 'text-base' : 'text-lg'} font-medium text-[#1E1B4B] hover:opacity-80 transition-opacity text-left tracking-tight`}
            >
              <WordMark />
            </button>
            <div className="flex items-center gap-2">
              {showWorkerHub ? (
                <NotificationsBell items={workerBellNotifications} panelNotice={notificationsPanelNotice} />
              ) : null}
              {showWorkerHub && onOpenSettings ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-lg px-3 py-2 text-sm text-[#1E1B4B]/65 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
                >
                  Settings
                </button>
              ) : !showWorkerHub && onOpenSettings ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-lg px-3 py-2 text-sm text-[#1E1B4B]/65 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
                >
                  Settings
                </button>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
      </nav>
      ) : null}

      {isHomeTab && showWorkerHub ? renderMissionControlHome() : null}

      {isStatusJourneyTab && showWorkerHub ? renderStatusJourneyTab() : null}

      {isSummaryTab && showWorkerHub ? renderSummaryHome() : null}

      {mobileShellHub ? (
        <>
          <div className="sm:hidden">
            {mobileNavSection === 'intakes' ? (
              <section id="worker-mobile-records" className="px-4 pt-5 pb-4">
                {openIntakeFeedback ? (
                  <p
                    className="mb-3 rounded-lg border border-[#D3DED6] bg-white px-3 py-1.5 text-xs leading-relaxed text-[#1E1B4B]/70"
                    role="status"
                    aria-live="polite"
                  >
                    {openIntakeFeedback}
                  </p>
                ) : null}
                {organizationRecoveryNotice ? (
                  <p className="text-xs text-amber-400/90 mb-4 leading-relaxed" role="status">
                    {organizationRecoveryNotice}
                  </p>
                ) : null}
                {showDocRequestCard &&
                workerDocumentRequestAlert &&
                docRequestPending &&
                onReviewDocumentRequest ? (
                  <WorkerMobileDocRequestCard
                    firmName={workerDocumentRequestAlert.firmName}
                    categories={workerDocumentRequestAlert.categories}
                    onUploadRequested={onReviewDocumentRequest}
                  />
                ) : null}
                <div className="mb-4">
                  <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">Intakes</h2>
                  <p className="text-xs leading-relaxed text-[#1E1B4B]/64">
                    All saved and created intakes remain available here. Tap + to start a new intake.
                  </p>
                </div>
                {sortedIntakeCards.length > 0 ? (
                  renderCompactIntakeList()
                ) : (
                  <p className="py-6 text-center text-sm leading-relaxed text-[#1E1B4B]/64">
                    No saved intakes yet. Tap + to start a new intake.
                  </p>
                )}
              </section>
            ) : null}
          </div>
        </>
      ) : null}

      {isIntakesTab && showWorkerHub && (workerIntakeRoutingCards.length > 0 || onCreateNewIntake) ? (
        <section
          ref={workerIntakesSectionRef}
          className={`${
            workerDashboardCompact
              ? 'px-5 sm:px-8 pt-4 pb-6 max-w-3xl scroll-mt-4'
              : 'px-6 pt-4 pb-3 scroll-mt-4'
          } ${mobileShellHub ? 'hidden sm:block' : ''}`}
        >
          {openIntakeFeedback ? (
            <p
              className="mb-3 rounded-lg border border-[#D3DED6] bg-white px-3 py-1.5 text-xs leading-relaxed text-[#1E1B4B]/70"
              role="status"
              aria-live="polite"
            >
              {openIntakeFeedback}
            </p>
          ) : null}
          {organizationRecoveryNotice ? (
            <p className="text-xs text-amber-400/90 mb-4 leading-relaxed" role="status">
              {organizationRecoveryNotice}
            </p>
          ) : null}
          {showDocRequestCard && workerDocumentRequestAlert && onReviewDocumentRequest ? (
            <div className="mb-4">
              {docRequestPending ? (
                <>
                  <div className="sm:hidden">
                    <WorkerMobileDocRequestCard
                      firmName={workerDocumentRequestAlert.firmName}
                      categories={workerDocumentRequestAlert.categories}
                      onUploadRequested={onReviewDocumentRequest}
                    />
                  </div>
                  <div className="hidden sm:block">
                    <WorkerDocumentRequestDashboardCard
                      firmName={workerDocumentRequestAlert.firmName}
                      categories={workerDocumentRequestAlert.categories}
                      note={workerDocumentRequestAlert.note}
                      status={workerDocumentRequestAlert.status}
                      onUploadRequested={onReviewDocumentRequest}
                      onViewTimeline={onGoWorkerSummary ? goSummary : undefined}
                      onDismiss={() => setDocRequestDismissed(true)}
                    />
                  </div>
                </>
              ) : (
                <WorkerDocumentRequestDashboardCard
                  firmName={workerDocumentRequestAlert.firmName}
                  categories={workerDocumentRequestAlert.categories}
                  note={workerDocumentRequestAlert.note}
                  status={workerDocumentRequestAlert.status}
                  onUploadRequested={onReviewDocumentRequest}
                  onViewTimeline={onGoWorkerSummary ? goSummary : undefined}
                />
              )}
            </div>
          ) : null}
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">
              Intakes
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#1E1B4B]/64">
              All saved intakes remain available here. Tap + to start a new intake.
            </p>
          </div>
          {sortedIntakeCards.length > 0 ? (
            workerDashboardCompact ? (
              renderCompactIntakeList()
            ) : (
            <div className="space-y-2">
              {sortedIntakeCards.map((card) => {
                const isActive = activeIntakeHub?.intakeId === card.intakeId;
                const lastActivity = formatWorkerIntakeLastActivity(card.updatedAt);
                const routingPeek = firmRoutingPeekLine(card);
                const actionNeeded = workerActionNeededIntakeIds.includes(card.intakeId);
                return (
                  <div
                    key={card.intakeId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenWorkerIntakeWorkspaceForIntake?.(card.intakeId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenWorkerIntakeWorkspaceForIntake?.(card.intakeId);
                      }
                    }}
                    className={`relative rounded-[12px] border bg-white p-3 shadow-sm ${
                      actionNeeded
                        ? 'border-[#BFAEFF] bg-[#FBFAFF] shadow-[0_18px_42px_rgba(109,74,255,0.14)] ring-1 ring-[#CBD6CF]'
                        : isActive
                          ? 'border-slate-300 ring-1 ring-slate-200/80'
                          : 'border-slate-200'
                    } ${onOpenWorkerIntakeWorkspaceForIntake ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#CBD6CF]' : ''}`}
                  >
                    {actionNeeded ? (
                      <span
                        className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#42574E] shadow-[0_0_0_4px_rgba(109,74,255,0.14)]"
                        aria-hidden
                      />
                    ) : null}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          Employment Records Intake
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">Reference: {card.intakeNumber}</p>
                        {card.caseCategory &&
                        (isBetaEmploymentCategory(card.caseCategory) || card.employmentMatterTags?.length) ? (
                          <div className="mt-0.5">
                            <EmploymentMatterTagsLine tags={card.employmentMatterTags ?? []} />
                          </div>
                        ) : card.caseCategory ? (
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                            Category: {displayCaseCategoryLabel(card.caseCategory)}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-[#1E1B4B]/62">
                          {formatWorkerWorkflowStatusForDisplay(card.workflowStatus, card.submissionChannel)}
                          {lastActivity ? ` · ${lastActivity}` : null}
                        </p>
                      </div>
                      {isActive ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-[#475569]">{routingPeek}</p>
                    {card.hasSummary ? (
                      <p className="text-[10px] text-emerald-800/90 mb-2">{WORKER_HUB_COPY.summaryReady}</p>
                    ) : null}
                    <div
                      className="flex flex-wrap items-center gap-2 mb-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {onDeleteWorkerIntake ? (
                        <button
                          type="button"
                          disabled={deleteIntakeBusyId === card.intakeId}
                          onClick={() => {
                            onClearDeleteIntakeError?.();
                            setPendingDeleteIntakeId(card.intakeId);
                          }}
                          className="text-[11px] font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                        >
                          {deleteIntakeBusyId === card.intakeId ? 'Deleting…' : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                    {deleteIntakeError && deleteIntakeErrorIntakeId === card.intakeId ? (
                      <p className="mb-2 text-xs text-red-700">{deleteIntakeError}</p>
                    ) : null}
                    <div onClick={(event) => event.stopPropagation()}>
                      {renderFirmRoutingModule(
                        {
                          channel: card.submissionChannel,
                          workflow: card.workflowStatus,
                          firmName: card.linkedFirmName,
                          firmCode: card.linkedFirmCode,
                          routeStatus: card.routeStatus,
                          intakeId: card.intakeId,
                          previewSent: workerParticipatingPreviewSent(
                            card.submissionChannel,
                            card.workflowStatus
                          ),
                          size: 'compact',
                          firmCodeError:
                            activeIntakeHub?.intakeId === card.intakeId ? firmCodeActionError : null,
                        },
                        card.intakeId
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )
          ) : (
            <p className="py-6 text-center text-sm leading-relaxed text-[#1E1B4B]/64">
              No saved intakes yet. Tap + to start a new intake.
            </p>
          )}
        </section>
      ) : null}

      {pendingDeleteIntakeId && onDeleteWorkerIntake ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-intake-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="delete-intake-title" className="text-lg font-semibold text-slate-900">
              Delete this intake?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Deleting this intake will remove its summary, timeline, uploaded file records, and firm
              connections. one3seven will also request cleanup of associated stored file objects.
              This cannot be undone.
            </p>
            {deleteIntakeError ? (
              <p className="mt-3 text-xs text-red-700">{deleteIntakeError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteIntakeBusyId === pendingDeleteIntakeId}
                onClick={() => {
                  setPendingDeleteIntakeId(null);
                  onClearDeleteIntakeError?.();
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteIntakeBusyId === pendingDeleteIntakeId}
                onClick={() => {
                  void (async () => {
                    const r = await onDeleteWorkerIntake(pendingDeleteIntakeId);
                    if (!r.error) setPendingDeleteIntakeId(null);
                  })();
                }}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleteIntakeBusyId === pendingDeleteIntakeId ? 'Deleting…' : 'Delete intake'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hero Section — hidden for signed-in worker dashboard (Home uses Status Journey instead) */}
      <section
        className={`px-6 bg-gradient-to-b from-slate-50 to-white ${
          showWorkerHub || workerDashboardCompact ? 'hidden' : 'pt-16 pb-20'
        } ${mobileShellHub ? 'hidden sm:block' : ''}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {showStartOrganizingHero ? (
            <>
          <h1
            className={`leading-[1.2] font-semibold text-slate-900 tracking-tight ${
              workerDashboardCompact ? 'text-xl mb-3' : 'text-[32px] mb-5'
            }`}
          >
            {workerDashboardCompact
              ? WORKER_HUB_COPY.hubHeadline
              : firmDirectedContext
              ? `${firmDirectedContext.firmName} asked you to submit your records here.`
              : 'Bring clarity to records that feel scattered or overwhelming.'}
          </h1>

          <p
            className={`text-slate-600 font-normal leading-relaxed ${
              workerDashboardCompact ? 'text-sm mb-4' : 'text-lg mb-10'
            }`}
          >
            {workerDashboardCompact
              ? WORKER_HUB_COPY.hubSubline(hubRecordCount, hubEventCount)
              : firmDirectedContext
              ? `Answer at your own pace — your records will be organized and sent directly to ${firmDirectedContext.firmName}, with no emails or follow-up calls needed.`
              : 'one3seven helps organize scattered records into a structured summary you can review, save, and share when you are ready—across employment, housing, injury, family, and more.'}
          </p>

          <div className={`space-y-3 ${workerDashboardCompact ? 'mb-4' : 'mb-16'}`}>
            <button
              onClick={openOrganizeFlow}
              className="w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-all shadow-sm hover:shadow-md font-medium"
            >
              {firmDirectedContext ? 'Get Started' : 'Start Organizing'}
            </button>
            <button
              onClick={() => onNavigate('howItWorks')}
              className="w-full bg-slate-100 text-slate-900 py-4 px-6 rounded-[14px] hover:bg-slate-200 transition-colors font-medium"
            >
              See How It Works
            </button>
          </div>
            </>
          ) : null}

          {/* Transformation Visualization */}
          {!workerDashboardCompact ? (
          <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 rounded-[18px] p-10 overflow-hidden border border-slate-200/60 min-h-[340px] flex items-center justify-center">
            <div className="absolute inset-0 bg-grid-slate-200 opacity-30"></div>

            <div className="relative w-full">
              {/* Scattered Fragments - Initial State */}
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ delay: 1.2, duration: 1, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="relative w-full h-[240px]">
                  {/* Text bar fragment */}
                  <motion.div
                    initial={{ opacity: 0.6, y: -10 }}
                    animate={{ opacity: [0.6, 0.8, 0.6], y: [-10, -13, -10] }}
                    transition={{ duration: 3.2, repeat: 2, ease: "easeInOut" }}
                    className="absolute top-10 left-8 bg-white/90 rounded px-3 py-1.5 shadow-sm border border-slate-200/70 rotate-[-4deg]"
                  >
                    <div className="w-16 h-1.5 bg-slate-300 rounded"></div>
                  </motion.div>

                  {/* Paystub grid element */}
                  <motion.div
                    initial={{ opacity: 0.6, x: 10 }}
                    animate={{ opacity: [0.6, 0.75, 0.6], x: [10, 14, 10] }}
                    transition={{ duration: 4.5, repeat: 2, ease: "easeInOut" }}
                    className="absolute top-16 right-10 bg-white/90 rounded-md p-2 shadow-sm border border-slate-200/70 rotate-[6deg]"
                  >
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-300 rounded-sm"></div>
                      <div className="w-2 h-2 bg-slate-300 rounded-sm"></div>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <div className="w-2 h-2 bg-slate-300 rounded-sm"></div>
                      <div className="w-2 h-2 bg-slate-300 rounded-sm"></div>
                    </div>
                  </motion.div>

                  {/* Timeline dot fragment */}
                  <motion.div
                    initial={{ opacity: 0.6, y: 5 }}
                    animate={{ opacity: [0.6, 0.8, 0.6], y: [5, 2, 5] }}
                    transition={{ duration: 3.6, repeat: 2, ease: "easeInOut" }}
                    className="absolute top-28 left-[20%] bg-white/90 rounded-full p-2 shadow-sm border border-slate-200/70"
                  >
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  </motion.div>

                  {/* Date marker fragment */}
                  <motion.div
                    initial={{ opacity: 0.6, x: -8 }}
                    animate={{ opacity: [0.6, 0.75, 0.6], x: [-8, -11, -8] }}
                    transition={{ duration: 4.8, repeat: 2, ease: "easeInOut" }}
                    className="absolute bottom-20 left-12 bg-white/90 rounded px-2 py-1 shadow-sm border border-slate-200/70 rotate-[3deg]"
                  >
                    <div className="text-[8px] text-slate-400 font-medium">03/15</div>
                  </motion.div>

                  {/* Message snippet */}
                  <motion.div
                    initial={{ opacity: 0.6, y: 8 }}
                    animate={{ opacity: [0.6, 0.8, 0.6], y: [8, 5, 8] }}
                    transition={{ duration: 3.4, repeat: 2, ease: "easeInOut" }}
                    className="absolute bottom-24 right-[15%] bg-white/90 rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-200/70 rotate-[-6deg]"
                  >
                    <div className="flex gap-1 mb-0.5">
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="w-8 h-1 bg-slate-300 rounded"></div>
                    </div>
                    <div className="w-12 h-0.5 bg-slate-200 rounded"></div>
                  </motion.div>

                  {/* Text snippet fragment */}
                  <motion.div
                    initial={{ opacity: 0.6, x: 6 }}
                    animate={{ opacity: [0.6, 0.75, 0.6], x: [6, 9, 6] }}
                    transition={{ duration: 4.3, repeat: 2, ease: "easeInOut" }}
                    className="absolute top-40 right-[25%] bg-white/90 rounded px-2.5 py-1 shadow-sm border border-slate-200/70 rotate-[8deg]"
                  >
                    <div className="w-14 h-1 bg-slate-300 rounded"></div>
                  </motion.div>

                  {/* Document corner fragment */}
                  <motion.div
                    initial={{ opacity: 0.6, y: -5 }}
                    animate={{ opacity: [0.6, 0.8, 0.6], y: [-5, -8, -5] }}
                    transition={{ duration: 3.7, repeat: 2, ease: "easeInOut" }}
                    className="absolute bottom-12 left-[35%] bg-white/90 rounded-md p-1.5 shadow-sm border border-slate-200/70 rotate-[-7deg]"
                  >
                    <div className="w-3 h-3 border-l-2 border-t-2 border-slate-300"></div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Organizing State - Fragments aligning */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  initial={{ opacity: 1, scale: 0.95 }}
                  animate={{ opacity: 0, scale: 1 }}
                  transition={{ delay: 2.4, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/80 shadow-sm max-w-[260px] w-full"
                >
                  {/* Organizing lines */}
                  <motion.div
                    initial={{ opacity: 0.4, width: '40%' }}
                    animate={{ opacity: 1, width: '100%' }}
                    transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
                    className="h-1.5 bg-slate-200 rounded mb-3"
                  />
                  <motion.div
                    initial={{ opacity: 0.4, width: '60%' }}
                    animate={{ opacity: 1, width: '85%' }}
                    transition={{ delay: 1.6, duration: 0.6, ease: "easeOut" }}
                    className="h-1.5 bg-slate-200 rounded mb-4"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.8, duration: 0.5, ease: "easeOut" }}
                    className="flex gap-2 mb-3"
                  >
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-0.5"></div>
                    <div className="flex-1 h-1 bg-slate-200 rounded"></div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 2, duration: 0.5, ease: "easeOut" }}
                    className="flex gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-0.5"></div>
                    <div className="flex-1 h-1 bg-slate-200 rounded"></div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Final Organized State */}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 3.2, duration: 1, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center justify-center"
              >
                <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800 max-w-[280px] w-full relative overflow-hidden">
                  {/* Header section */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700/50">
                    <FileCheck className="w-5 h-5 text-white flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">Intake Summary Ready</div>
                    </div>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0"></div>
                  </div>

                  {/* Organized content sections */}
                  <div className="space-y-3 relative">
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={{ opacity: [1, 1, 1, 1] }}
                      className="flex items-center gap-2 relative"
                    >
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                      <div className="h-1 bg-slate-700 rounded flex-1"></div>
                      {/* Pulse highlight for first section */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.2, 0] }}
                        transition={{ delay: 4.4, duration: 0.4, ease: "easeInOut" }}
                        className="absolute inset-0 bg-emerald-400/20 rounded"
                      />
                    </motion.div>
                    <motion.div
                      className="flex items-center gap-2 relative"
                    >
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                      <div className="h-1 bg-slate-700 rounded flex-1"></div>
                      {/* Pulse highlight for second section */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.2, 0] }}
                        transition={{ delay: 4.7, duration: 0.4, ease: "easeInOut" }}
                        className="absolute inset-0 bg-emerald-400/20 rounded"
                      />
                    </motion.div>
                    <motion.div
                      className="flex items-center gap-2 relative"
                    >
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                      <div className="h-1 bg-slate-700 rounded flex-1 w-3/4"></div>
                      {/* Pulse highlight for third section */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.2, 0] }}
                        transition={{ delay: 5, duration: 0.4, ease: "easeInOut" }}
                        className="absolute inset-0 bg-emerald-400/20 rounded"
                      />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
          ) : null}
        </motion.div>
      </section>

      {/* Trust / Value Section */}
      <section
        className={`px-6 bg-[#F2F4EC] ${workerDashboardCompact ? 'py-6' : 'py-16'} ${
          mobileShellHub ? 'hidden sm:block' : ''
        }`}
      >
        {workerDashboardCompact ? (
          <details className="group overflow-hidden rounded-2xl border border-[#D3DED6] bg-white/86 shadow-[0_12px_32px_rgba(31,27,75,0.07)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[#1E1B4B] hover:bg-[#F7F3FF]">
              About one3seven
              <span className="text-[11px] font-normal text-[#64748B] group-open:hidden">Show</span>
              <span className="hidden text-[11px] font-normal text-[#64748B] group-open:inline">Hide</span>
            </summary>
            <div className="space-y-3 border-t border-[#D3DED6] px-4 pb-4 pt-3">
              <p className="text-xs leading-relaxed text-[#1E1B4B]/64">
                Organize your records into a calm, reviewable summary—ready when you choose to share with a firm.
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-[#1E1B4B]/64">
                <li>Track intake status and firm activity in one place</li>
                <li>Review timelines and summaries inside each intake</li>
                <li>Prepare cleaner materials for legal conversations</li>
              </ul>
            </div>
          </details>
        ) : (
        <div className="space-y-5">
          <div className="bg-slate-50 rounded-[16px] p-7 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-5">For individuals</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600 leading-relaxed">Keep related records in one organized place</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600 leading-relaxed">Create a clearer timeline of your records</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600 leading-relaxed">Review categorized documents more clearly</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600 leading-relaxed">Prepare cleaner intake materials for future conversations</span>
              </li>
            </ul>
          </div>

          <div className="rounded-[16px] border border-[#D3DED6] bg-white p-7 text-[#1E1B4B] shadow-[0_14px_38px_rgba(31,27,75,0.08)]">
            <h3 className="mb-5 text-base font-semibold">For Participating Firms</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#42574E]" />
                <span className="text-sm leading-relaxed text-[#1E1B4B]/64">Receive more organized intake submissions</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#42574E]" />
                <span className="text-sm leading-relaxed text-[#1E1B4B]/64">Reduce manual document sorting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#42574E]" />
                <span className="text-sm leading-relaxed text-[#1E1B4B]/64">Review structured timelines and categorized records</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#42574E]" />
                <span className="text-sm leading-relaxed text-[#1E1B4B]/64">Improve intake workflow efficiency</span>
              </li>
            </ul>
          </div>
        </div>
        )}
      </section>

      {showWorkerHub ? (
        <WorkerMobileBottomNav
          activeShellScreen="landing"
          mobileHubView={mobileNavSection}
          onNavigate={handleWorkerMobileNav}
        />
      ) : null}

      {/* Footer */}
      <footer
        className={`border-t border-[#D3DED6] bg-[#F2F4EC] px-6 ${workerDashboardCompact ? 'py-8' : 'py-12'} ${
          mobileShellHub ? 'hidden sm:block' : ''
        }`}
      >
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-[#1E1B4B]"><WordMark /></div>
          <p className="mb-8 text-sm leading-relaxed text-[#475569]">
            A workflow organization platform for intake preparation.
          </p>
          <p className="mx-auto mb-6 max-w-lg text-xs leading-relaxed text-[#64748B]">{ONE3SEVEN_NOTICES.positioning}</p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-[#1E1B4B]/64">
            <a
              href="https://one3seven.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              Privacy
            </a>
            <a
              href="https://one3seven.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              Terms
            </a>
            <a
              href="mailto:info@one3seven.com?subject=one3seven%20contact"
              className="hover:text-slate-900 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showLawFirmModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="law-firm-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="bg-white rounded-[18px] max-w-md w-full p-6 shadow-xl border border-slate-200 relative"
            >
              <button
                type="button"
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
                onClick={() => setShowLawFirmModal(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 id="law-firm-modal-title" className="text-lg font-semibold text-slate-900 pr-8 mb-2">
                What would you like to do with your organized records?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                You can share with a participating firm now, or keep your file and decide later. You&apos;re in control.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full border border-[#42574E] text-[#42574E] bg-white py-3.5 rounded-[14px] text-sm font-medium hover:bg-[#F7F3FF]"
                  onClick={() => handleLawFirmChoice('enter_firm_code')}
                >
                  Share with a firm
                </button>
                <button
                  type="button"
                  className="w-full border border-slate-300 text-slate-900 bg-white py-3.5 rounded-[14px] text-sm font-medium hover:bg-slate-50"
                  onClick={() => handleLawFirmChoice('continue_without')}
                >
                  Keep my file for now
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-slate-600 py-2 hover:text-slate-900"
                  onClick={() => setShowLawFirmModal(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
