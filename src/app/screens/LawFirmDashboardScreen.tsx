import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  FileText,
  Filter,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import { Screen } from '../App';
import { IntakeWorkspace } from '../types/IntakeWorkspace';

import type { FirmDashboardRow } from '../../services/intakeDataService';
import { polishFirmFacingProse } from '../../services/firmIntakeDisplay';
import { EmploymentMatterChipList } from '../components/EmploymentMatterTagsLine';
import type { FirmSubmissionTypeDisplay } from '../constants/one3sevenProduct';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import { BETA_HIDE_FIRM_ARCHIVED_TAB } from '../constants/flags';
import { WordMark } from '../components/WordMark';

interface LawFirmDashboardScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectIntake: (
    intakeId: string,
    meta?: { routeId: string; routeStatus: string; intakeNumber: string }
  ) => void;
  submittedIntakes: IntakeWorkspace[];
  dbIntakes?: FirmDashboardRow[];
  onViewSampleIntakeFlow?: () => void;
  firmBellNotifications?: AppNotificationItem[];
  firmBanner?: { firmName: string; firmCode: string; activeCount: number };
  onSignOut?: () => void;
}

type IntakeReadiness = 'ready' | 'needs-docs' | 'incomplete';
type ReviewStatus = 'new' | 'under-review' | 'contacted' | 'accepted' | 'archived';
type FirmCriteriaFilter = 'all' | 'pay-time' | 'communications' | 'separation' | 'terms' | 'needs-docs';
type FirmTab = 'all' | 'new' | 'ready' | 'full' | 'accepted' | 'archived';
type FirmDashboardView = 'firmHome' | 'reviewNew' | 'continueReviews';
type NewIntakeSourceTab = 'connected' | 'participating';

interface IntakeSubmission {
  id: string;
  routeId: string;
  routeStatus: string;
  intakeNumber: string;
  readiness: IntakeReadiness;
  categories: string[];
  documentCount: number;
  uploadDate: string;
  workerLocation: string;
  employerState: string;
  timelineComplete: boolean;
  hasAlerts: boolean;
  lastActivity: string;
  reviewStatus: ReviewStatus;
  summary: string;
  submissionType: FirmSubmissionTypeDisplay;
  timelineSummary: string;
  readinessHints: string[];
  missingHints: string[];
  workflowStatusLabel: string;
  workerLabel: string;
  workerAddedContextPreview?: string;
  requestedDocumentsStatus?: string | null;
  workerDocumentResponse?: { fulfilled: string[]; note: string } | null;
  employmentMatterTags?: import('../constants/employmentMatter').EmploymentMatterTagId[];
}

function formatLastActivity(workspace: IntakeWorkspace): string {
  const lastMod = new Date(workspace.lastModifiedAt);
  const now = new Date();
  const diffMs = now.getTime() - lastMod.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function isAcceptedWorkflowStatus(workflowStatus: string | null | undefined) {
  return (workflowStatus ?? '').trim().toLowerCase() === 'accepted by firm';
}

function statusLineForRoute(
  routeStatus: string,
  submissionType: FirmSubmissionTypeDisplay,
  workflowStatus?: string | null
) {
  if (isAcceptedWorkflowStatus(workflowStatus)) return 'Attorney review in progress';
  if (submissionType === 'Firm Code') return 'Direct full review access';
  if (routeStatus === 'full_access') return 'Worker approved access';
  if (routeStatus === 'access_requested') return 'Review access requested';
  if (routeStatus === 'accepted') return 'Attorney review in progress';
  return 'Preview received';
}

function chronologyGapCount(intake: IntakeSubmission) {
  if (intake.missingHints.length) return Math.min(9, intake.missingHints.length);
  if (intake.readiness === 'ready') return 0;
  if (intake.readiness === 'needs-docs') return 2;
  return 3;
}

function generateFallbackSummary(workspace: IntakeWorkspace): string {
  const docCount = workspace.documents.length;
  const concerns = workspace.reportedConcerns.join(', ') || 'stated concerns';
  return `Available records indicate ${concerns} with ${docCount} supporting ${docCount === 1 ? 'record' : 'records'} uploaded. Timeline organization ${workspace.timelineComplete ? 'is reconstructed' : 'is in progress'}.`;
}

export function LawFirmDashboardScreen({
  onNavigate,
  onSelectIntake,
  submittedIntakes,
  dbIntakes,
  onViewSampleIntakeFlow,
  firmBellNotifications = [],
  firmBanner,
  onSignOut,
}: LawFirmDashboardScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReadiness, setSelectedReadiness] = useState<IntakeReadiness | 'all'>('all');
  const [selectedCriteria, setSelectedCriteria] = useState<FirmCriteriaFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<FirmTab>('all');
  const [dashboardView, setDashboardView] = useState<FirmDashboardView>('firmHome');
  const [newIntakeSourceTab, setNewIntakeSourceTab] = useState<NewIntakeSourceTab>('connected');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (BETA_HIDE_FIRM_ARCHIVED_TAB && activeTab === 'archived') setActiveTab('all');
  }, [activeTab]);

  const intakesFromWorkspaces: IntakeSubmission[] = submittedIntakes.map((workspace) => {
    const readiness: IntakeReadiness =
      workspace.timelineComplete && workspace.documents.length >= 5
        ? 'ready'
        : workspace.documents.length >= 3
          ? 'needs-docs'
          : 'incomplete';
    const reviewStatusMap: Record<string, ReviewStatus> = {
      new: 'new',
      'additional-docs': 'under-review',
      'ready-review': 'new',
      'under-review': 'under-review',
      contacted: 'contacted',
      accepted: 'accepted',
      archived: 'archived',
      'not-pursuing': 'archived',
    };
    return {
      id: workspace.id,
      routeId: workspace.id,
      routeStatus: 'full_access',
      intakeNumber: workspace.id.slice(0, 8).toUpperCase(),
      readiness,
      categories: workspace.reportedConcerns,
      documentCount: workspace.documents.length,
      uploadDate: workspace.submittedAt || workspace.createdAt,
      workerLocation: workspace.workerLocation || 'Location not specified',
      employerState: workspace.employerState || 'Unknown',
      timelineComplete: workspace.timelineComplete,
      hasAlerts: workspace.organizationNotes.some((note) => note.type === 'alert' || note.type === 'neutral'),
      lastActivity: formatLastActivity(workspace),
      reviewStatus: reviewStatusMap[workspace.workflowStatus] || 'new',
      summary: workspace.intakeSummary?.overview || generateFallbackSummary(workspace),
      submissionType: 'Participating Firm Review',
      timelineSummary: workspace.intakeSummary?.chronology ?? '',
      readinessHints: [],
      missingHints: [],
      workflowStatusLabel: workspace.workflowStatus ?? 'new',
      workerLabel: 'Prepared case file',
    };
  });

  const intakesFromDb: IntakeSubmission[] = (dbIntakes ?? []).map((row) => ({
    id: row.intakeId,
    routeId: row.routeId,
    routeStatus: row.routeStatus,
    intakeNumber: row.intakeNumber,
    readiness: row.documentCount >= 5 ? 'ready' : row.documentCount >= 3 ? 'needs-docs' : 'incomplete',
    categories: row.categories,
    documentCount: row.documentCount,
    uploadDate: row.createdAt,
    workerLocation: 'Private until opened',
    employerState: 'Private',
    timelineComplete: row.documentCount >= 3,
    hasAlerts: (row.readiness?.length ?? 0) > 0 || (row.missing?.length ?? 0) > 0,
    lastActivity: row.requestedDocumentsStatus || 'Awaiting review',
    reviewStatus:
      isAcceptedWorkflowStatus(row.workflowStatus)
        ? 'accepted'
        : row.routeStatus === 'access_requested'
        ? 'under-review'
        : row.routeStatus === 'accepted'
          ? 'accepted'
          : row.routeStatus === 'full_access'
            ? 'contacted'
            : 'new',
    summary: row.overview,
    submissionType: row.submissionType,
    timelineSummary: row.timelineSummary,
    readinessHints: row.readiness,
    missingHints: row.missing,
    workflowStatusLabel: row.workflowStatus || 'Awaiting review',
    workerLabel: 'Prepared case file',
    workerAddedContextPreview: row.workerAddedContextSummary,
    requestedDocumentsStatus: row.requestedDocumentsStatus ?? null,
    workerDocumentResponse: row.workerDocumentResponse ?? null,
    employmentMatterTags: row.employmentMatterTags,
  }));

  const liveFirmMode = Boolean(firmBanner);
  const allIntakes = liveFirmMode ? intakesFromDb : [...intakesFromDb, ...intakesFromWorkspaces];
  const noRealFirmIntakes = intakesFromDb.length === 0 && intakesFromWorkspaces.length === 0;
  const firmGreetingName = firmBanner?.firmName?.trim();

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firmIntakeLink = firmBanner?.firmCode
    ? `${window.location.origin}/?fc=${firmBanner.firmCode}`
    : null;

  const [intakeLinkCopied, setIntakeLinkCopied] = useState(false);
  const copyIntakeLink = () => {
    if (!firmIntakeLink) return;
    navigator.clipboard.writeText(firmIntakeLink).then(() => {
      setIntakeLinkCopied(true);
      setTimeout(() => setIntakeLinkCopied(false), 2000);
    });
  };

  const isNewIntakeRoute = (status: string) => status === 'preview_sent' || status === 'under_review';
  const isActiveReview = (intake: IntakeSubmission) =>
    intake.routeStatus === 'full_access' ||
    intake.routeStatus === 'access_requested' ||
    intake.reviewStatus === 'accepted' ||
    intake.workflowStatusLabel === 'Accepted by Firm' ||
    intake.workflowStatusLabel === 'Additional Documents Requested' ||
    intake.workflowStatusLabel === 'Worker Uploaded Requested Documents' ||
    Boolean(intake.requestedDocumentsStatus) ||
    Boolean(intake.workerDocumentResponse);
  const viewSource = allIntakes.filter((intake) => {
    if (dashboardView === 'reviewNew') {
      return newIntakeSourceTab === 'connected'
        ? intake.submissionType === 'Firm Code'
        : intake.submissionType === 'Participating Firm Review';
    }
    if (dashboardView === 'continueReviews') return isActiveReview(intake);
    return true;
  });
  const tabSource = viewSource.filter((intake) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'new') return isNewIntakeRoute(intake.routeStatus);
    if (activeTab === 'ready') return intake.routeStatus === 'access_requested';
    if (activeTab === 'full') return intake.routeStatus === 'full_access';
    if (activeTab === 'accepted') return intake.reviewStatus === 'accepted';
    return false;
  });

  const intakeSearchText = (intake: IntakeSubmission) =>
    [
      intake.intakeNumber,
      ...intake.categories,
      intake.summary,
      intake.timelineSummary,
      ...intake.readinessHints,
      ...intake.missingHints,
      intake.workflowStatusLabel,
      intake.workerAddedContextPreview ?? '',
    ]
      .join(' ')
      .toLowerCase();

  const matchesFirmCriteria = (intake: IntakeSubmission) => {
    if (selectedCriteria === 'all') return true;
    const haystack = intakeSearchText(intake);
    const has = (words: string[]) => words.some((word) => haystack.includes(word));
    if (selectedCriteria === 'pay-time') return has(['pay', 'payroll', 'wage', 'hour', 'timecard', 'overtime', 'schedule']);
    if (selectedCriteria === 'communications') return has(['email', 'message', 'communication', 'hr', 'manager']);
    if (selectedCriteria === 'separation') return has(['termination', 'separation', 'resignation', 'final pay', 'last day']);
    if (selectedCriteria === 'terms') return has(['offer', 'contract', 'classification', 'salary', 'commission']);
    if (selectedCriteria === 'needs-docs') return intake.readiness !== 'ready' || intake.missingHints.length > 0;
    return true;
  };

  const filteredIntakes = tabSource.filter((intake) => {
    if (selectedReadiness !== 'all' && intake.readiness !== selectedReadiness) return false;
    if (!matchesFirmCriteria(intake)) return false;
    if (!searchQuery.trim()) return true;
    return intakeSearchText(intake).includes(searchQuery.toLowerCase().trim());
  });

  const filterPillClass = (active: boolean) =>
    active
      ? 'bg-[#6D4AFF] text-white border-[#6D4AFF] shadow-[0_10px_24px_rgba(109,74,255,0.18)]'
      : 'bg-white text-[#1E1B4B]/70 border-[#DCD3FF] hover:border-[#B8A8FF] hover:bg-[#F7F3FF]';

  return (
    <div className="min-h-screen bg-[#F6F2FF] text-[#1E1B4B]">
      <nav className="sticky top-0 z-50 border-b border-[#E7E1FF] bg-white/90 backdrop-blur">
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[#1E1B4B]"><WordMark /></h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NotificationsBell items={firmBellNotifications} />
              <button
                type="button"
                onClick={() => onNavigate('firmSettings')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E1B4B]/65 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E1B4B]/52 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      <main
        className={
          dashboardView === 'firmHome'
            ? 'mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-5xl items-center px-6 py-10'
            : 'mx-auto min-h-[calc(100vh-5.5rem)] max-w-5xl px-6 py-10'
        }
      >
        {dashboardView === 'firmHome' ? (
          <section className="w-full">
            <div className="mx-auto flex min-h-[min(520px,calc(100vh-14rem))] w-full max-w-[680px] flex-col justify-center rounded-[32px] border border-[#E7E1FF] bg-white/95 px-6 py-10 text-center shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:px-10 sm:py-12">
              <h2 className="font-display text-[clamp(1.75rem,5.8vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-transparent bg-[linear-gradient(110deg,#1E1B4B_0%,#5B35D5_42%,#1E1B4B_78%)] bg-[length:220%_100%] bg-clip-text animate-[pulse_3s_ease-in-out_infinite]">
                {firmGreetingName ? `${timeGreeting}, ${firmGreetingName}.` : `${timeGreeting}.`}
              </h2>

              {allIntakes.length === 0 ? (
                /* ── Zero state: guide firm to their intake link ── */
                <div className="mt-8 w-full text-left">
                  <p className="text-center text-lg font-medium text-[#1E1B4B]/70 mb-6">
                    Your intake queue is ready. Send your link to get started.
                  </p>
                  {firmIntakeLink ? (
                    <div className="rounded-2xl border border-[#E7E1FF] bg-[#F7F3FF] p-5 mb-5">
                      <p className="text-[10px] font-700 uppercase tracking-[0.18em] text-[#6D4AFF] mb-2" style={{ fontWeight: 700 }}>
                        Your client intake link
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 truncate font-mono text-xs text-[#1E1B4B]/70 bg-white border border-[#E7E1FF] rounded-lg px-3 py-2">
                          {firmIntakeLink}
                        </p>
                        <button
                          type="button"
                          onClick={copyIntakeLink}
                          className="shrink-0 rounded-full bg-[#6D4AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B35D5] transition-colors"
                        >
                          {intakeLinkCopied ? 'Copied ✓' : 'Copy link'}
                        </button>
                      </div>
                      <p className="text-[11px] text-[#1E1B4B]/45 mt-2.5 leading-relaxed">
                        Share this with a client. They upload their documents. The organized intake arrives here before your first call.
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => onNavigate('firmSettings')}
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#DCD3FF] bg-white px-7 py-3 text-[14px] font-semibold text-[#1E1B4B] shadow-sm transition hover:border-[#C8BAFF] hover:bg-[#F7F3FF]"
                    >
                      Firm settings
                    </button>
                    {onViewSampleIntakeFlow ? (
                      <button
                        type="button"
                        onClick={onViewSampleIntakeFlow}
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#DCD3FF] bg-white px-7 py-3 text-[14px] font-semibold text-[#5B35D5] shadow-sm transition hover:border-[#C8BAFF] hover:bg-[#F7F3FF]"
                      >
                        View sample intake
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                /* ── Intakes exist: show count + actions ── */
                <>
                  <p className="mx-auto mt-8 max-w-xl text-[1.62rem] font-semibold leading-tight tracking-[-0.02em] text-[#1E1B4B] sm:text-[2rem]">
                    {allIntakes.length === 1
                      ? '1 intake is ready for review.'
                      : `${allIntakes.length} intakes are ready for review.`}
                  </p>
                  {firmIntakeLink ? (
                    <p className="mt-3 text-sm text-[#1E1B4B]/45">
                      Your intake link is in{' '}
                      <button
                        type="button"
                        onClick={() => onNavigate('firmSettings')}
                        className="text-[#6D4AFF] hover:underline"
                      >
                        Firm Settings
                      </button>
                    </p>
                  ) : null}
                  <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardView('reviewNew');
                        setNewIntakeSourceTab('connected');
                        setActiveTab('all');
                      }}
                      className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#6D4AFF] px-9 py-4 text-[15px] font-semibold text-white shadow-[0_18px_48px_rgba(109,74,255,0.30)] transition hover:-translate-y-0.5 hover:bg-[#5B35D5] hover:shadow-[0_20px_54px_rgba(109,74,255,0.36)]"
                    >
                      Review New Intakes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardView('continueReviews');
                        setActiveTab('all');
                      }}
                      className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#DCD3FF] bg-white px-9 py-4 text-[15px] font-semibold text-[#1E1B4B] shadow-[0_14px_38px_rgba(31,27,75,0.10)] transition hover:-translate-y-0.5 hover:border-[#C8BAFF] hover:bg-[#F7F3FF]"
                    >
                      Continue My Reviews
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        {dashboardView !== 'firmHome' ? (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setDashboardView('firmHome')}
                  className="mb-5 rounded-full border border-[#DCD3FF] bg-white px-4 py-2 text-sm text-[#1E1B4B]/70 shadow-[0_10px_28px_rgba(31,27,75,0.08)] hover:border-[#B8A8FF] hover:text-[#1E1B4B]"
                >
                  Back to Firm Home
                </button>
                <p className="text-xs uppercase tracking-[0.22em] text-[#6D4AFF]">Review Workspace</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#1E1B4B]">
                  {dashboardView === 'continueReviews' ? 'Continue My Reviews' : 'Review New Intakes'}
                </h2>
              </div>
              {dashboardView === 'reviewNew' ? (
                <div className="flex rounded-full border border-[#DCD3FF] bg-white p-1 shadow-[0_14px_34px_rgba(31,27,75,0.10)]">
                  {(
                    [
                      ['connected', 'Connected Intakes'],
                      ['participating', 'Participating Pool'],
                    ] as Array<[NewIntakeSourceTab, string]>
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setNewIntakeSourceTab(tab)}
                      className={`rounded-full px-4 py-2 text-sm transition-colors ${
                        newIntakeSourceTab === tab
                          ? 'bg-[#6D4AFF] text-white shadow-[0_10px_24px_rgba(109,74,255,0.22)]'
                          : 'text-[#1E1B4B]/64 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <section className="rounded-[32px] border border-[#E7E1FF] bg-white/95 p-5 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:p-7">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1E1B4B]/38" />
                <input
                  type="text"
                  placeholder="Find a case file by timeline, record type, intake number, or review note"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-[#DCD3FF] bg-[#F8F6FF] py-3 pl-11 pr-4 text-sm text-[#1E1B4B] placeholder:text-[#1E1B4B]/38 focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#DCD3FF] bg-white px-4 py-3 text-sm font-medium text-[#1E1B4B]/72 shadow-[0_10px_24px_rgba(31,27,75,0.07)] hover:border-[#B8A8FF] hover:bg-[#F7F3FF]"
              >
                <Filter className="h-4 w-4" />
                Refine queue
              </button>
            </div>

            {showFilters ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 rounded-2xl border border-[#E7E1FF] bg-[#FBFAFF] p-4"
              >
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-[#1E1B4B]/58">Chronology state</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['all', 'All files'],
                      ['ready', 'Timeline reconstructed'],
                      ['needs-docs', 'May benefit from review'],
                      ['incomplete', 'Continuity developing'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedReadiness(id as IntakeReadiness | 'all')}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${filterPillClass(selectedReadiness === id)}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-[#1E1B4B]/58">Record focus</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', 'All records'],
                        ['pay-time', 'Pay / time records'],
                        ['communications', 'Workplace communications'],
                        ['separation', 'Separation / final pay'],
                        ['terms', 'Terms / classification'],
                        ['needs-docs', 'Chronology gaps'],
                      ] as Array<[FirmCriteriaFilter, string]>
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedCriteria(id)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${filterPillClass(selectedCriteria === id)}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}

            <div className="mb-8 flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All case files'],
                  ['new', 'Preview received'],
                  ['ready', 'Review access requested'],
                  ['full', 'Worker approved access'],
                  ['accepted', 'Attorney review in progress'],
                ] as Array<[FirmTab, string]>
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    activeTab === tab
                      ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white shadow-[0_10px_24px_rgba(109,74,255,0.18)]'
                      : 'border-[#DCD3FF] bg-white text-[#1E1B4B]/60 hover:border-[#B8A8FF] hover:bg-[#F7F3FF]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {activeTab === 'archived' && !BETA_HIDE_FIRM_ARCHIVED_TAB ? (
                <div className="rounded-2xl border border-dashed border-[#DCD3FF] bg-[#F8F6FF] p-8 text-sm text-[#1E1B4B]/62">
                  Closed case files will appear here in a future update.
                </div>
              ) : null}

              {activeTab !== 'archived' &&
                filteredIntakes.map((intake, index) => {
              const gapCount = chronologyGapCount(intake);
              const summary =
                polishFirmFacingProse(intake.timelineSummary || intake.summary) ||
                'Timeline summary will appear as records are organized.';
              const workerLabel = intake.workerLabel.trim() || 'Prepared case file';
              const timelineState = intake.timelineComplete ? 'Timeline reconstructed' : 'Timeline ready for review';
              const recordLine =
                intake.documentCount > 0
                  ? `${intake.documentCount} record${intake.documentCount === 1 ? '' : 's'} connected`
                  : 'Supporting records available';
              const gapLine =
                gapCount > 0
                  ? `${gapCount} chronology gap${gapCount === 1 ? '' : 's'} may benefit from review`
                  : 'Timeline continuity ready for review';
              return (
                <motion.button
                  key={`${intake.id}-${intake.routeId}`}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() =>
                    onSelectIntake(intake.id, {
                      routeId: intake.routeId,
                      routeStatus: intake.routeStatus,
                      intakeNumber: intake.intakeNumber,
                    })
                  }
                  className="group w-full rounded-3xl border border-[#E7E1FF] bg-white p-6 text-left shadow-[0_16px_44px_rgba(31,27,75,0.09)] transition hover:-translate-y-0.5 hover:border-[#B8A8FF] hover:shadow-[0_22px_58px_rgba(31,27,75,0.13)] sm:p-7"
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#1E1B4B]/34">Case file {intake.intakeNumber}</p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#1E1B4B]">{workerLabel}</h3>
                      <p className="mt-3 text-sm font-medium text-[#6D4AFF]">{timelineState}</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#1E1B4B]/72">{recordLine}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#1E1B4B]/58">{gapLine}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#6D4AFF]">
                      Review Timeline
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  <p className="mt-6 max-w-3xl border-t border-[#E7E1FF] pt-5 text-sm leading-relaxed text-[#1E1B4B]/62 line-clamp-2">
                    {summary}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-[#DCD3FF] bg-[#F8F6FF] px-3 py-1 text-xs text-[#1E1B4B]/62">
                      {statusLineForRoute(
                        intake.routeStatus,
                        intake.submissionType,
                        intake.workflowStatusLabel
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#1E1B4B]/48">
                      <Clock className="h-3.5 w-3.5" />
                      Latest activity: {intake.lastActivity}
                    </span>
                    {intake.requestedDocumentsStatus ? (
                      <span className="rounded-full border border-[#6D4AFF]/28 bg-[#F7F3FF] px-3 py-1 text-xs text-[#5B35D5]">
                        {intake.requestedDocumentsStatus}
                      </span>
                    ) : null}
                  </div>

                  {intake.employmentMatterTags?.length ? (
                    <div className="mt-4">
                      <EmploymentMatterChipList tags={intake.employmentMatterTags} />
                    </div>
                  ) : null}
                </motion.button>
              );
                })}
            </div>

            {activeTab !== 'archived' && noRealFirmIntakes ? (
              <div className="max-w-2xl rounded-3xl border border-[#E7E1FF] bg-white p-8 shadow-[0_16px_44px_rgba(31,27,75,0.09)]">
                <FileText className="mb-4 h-7 w-7 text-[#6D4AFF]" />
                <h3 className="text-lg font-semibold text-[#1E1B4B]">No intakes yet</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1E1B4B]/62">
                  Send your intake link to a client. Once they submit their documents, the organized intake appears here before your first call.
                </p>
                {firmIntakeLink ? (
                  <div className="mt-5 rounded-xl border border-[#E7E1FF] bg-[#F7F3FF] p-4">
                    <p className="text-[10px] font-700 uppercase tracking-[0.18em] text-[#6D4AFF] mb-2" style={{ fontWeight: 700 }}>
                      Your client intake link
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="flex-1 truncate font-mono text-xs text-[#1E1B4B]/70 bg-white border border-[#E7E1FF] rounded-lg px-3 py-2">
                        {firmIntakeLink}
                      </p>
                      <button
                        type="button"
                        onClick={copyIntakeLink}
                        className="shrink-0 rounded-full bg-[#6D4AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B35D5] transition-colors"
                      >
                        {intakeLinkCopied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {onViewSampleIntakeFlow ? (
                    <button
                      type="button"
                      onClick={onViewSampleIntakeFlow}
                      className="rounded-full border border-[#DCD3FF] bg-white px-4 py-2.5 text-left text-sm font-medium text-[#5B35D5] hover:bg-[#F7F3FF]"
                    >
                      View sample intake
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onNavigate('firmSettings')}
                    className="rounded-full border border-[#DCD3FF] bg-white px-4 py-2.5 text-left text-sm font-medium text-[#1E1B4B]/70 hover:bg-[#F7F3FF]"
                  >
                    Firm settings
                  </button>
                </div>
              </div>
            ) : activeTab !== 'archived' && !noRealFirmIntakes && filteredIntakes.length === 0 ? (
              <div className="rounded-3xl border border-[#E7E1FF] bg-[#F8F6FF] p-10 text-center">
                <p className="text-sm text-[#1E1B4B]/70">No case files match this review lens.</p>
              </div>
            ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
