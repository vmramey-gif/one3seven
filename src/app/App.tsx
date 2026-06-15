import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GalleryScreen } from './screens/GalleryScreen';
import { DevNavMapScreen } from './screens/DevNavMapScreen';
import { AuthWelcomeScreen } from './screens/AuthWelcomeScreen';
import { PublicMarketingPage } from './screens/PublicMarketingPage';
import { SignInScreen } from './screens/SignInScreen';
import { CreateAccountScreen } from './screens/CreateAccountScreen';
import { RoleSelectionScreen } from './screens/RoleSelectionScreen';
import { WorkerDetailsScreen } from './screens/WorkerDetailsScreen';
import type { WorkerDetailsPayload } from './screens/WorkerDetailsScreen';
import { LandingScreen } from './screens/LandingScreen';
import { EmploymentMatterScreen } from './screens/EmploymentMatterScreen';
import { GuidedIntakeScreen } from './screens/GuidedIntakeScreen';
import {
  CategoryQuestionnaireScreen,
  type CategoryQuestionnaireAnswers,
} from './screens/CategoryQuestionnaireScreen';
import { UploadScreen } from './screens/UploadScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { IntakeSummaryScreen } from './screens/IntakeSummaryScreen';
import { FilePreviewScreen } from './screens/FilePreviewScreen';
import { HowItWorksScreen } from './screens/HowItWorksScreen';
import { LawFirmDashboardScreen } from './screens/LawFirmDashboardScreen';
import { IntakeReviewScreen } from './screens/IntakeReviewScreen';
import { IntakeReviewErrorBoundary } from './components/IntakeReviewErrorBoundary';
import { FirmSettingsScreen } from './screens/FirmSettingsScreen';
import { WorkerSettingsScreen } from './screens/WorkerSettingsScreen';
import { FirmDirectedIntakeScreen, type FirmDirectedIntakeData, FD_SS_KEY } from './screens/FirmDirectedIntakeScreen';
import {
  IntakeWorkspace,
  createEmptyIntakeWorkspace,
  updateIntakeWorkspace,
  markIntakeAsSaved,
  submitIntakeToFirms,
  routeIntakeToFirms,
} from './types/IntakeWorkspace';
import { routeIntakeToEligibleFirms, mockFirmPreferences } from './types/FirmRouting';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as intakeData from '../services/intakeDataService';
import {
  clearPendingOnboardingSession,
  hasMeaningfulPendingOnboardingForDraft,
  hasPendingOnboardingContent,
  hasGuidedIntakeContent,
  isGuidedIntakeCompletedInSession,
  isPendingOnboardingReadyToPersist,
  loadCaseCategoryLocal,
  loadGuidedIntakeFromSession,
  loadPendingOnboardingSession,
  markGuidedIntakeCompletedInSession,
  mergeCaseCategoryIntoLatestIntakeSummary,
  mergeEmploymentMatterIntoLatestIntakeSummary,
  mergeGuidedIntakeIntoLatestIntakeSummary,
  saveCaseCategoryLocal,
  saveGuidedIntakeToSession,
  savePendingOnboardingSession,
  type GuidedIntakeAnswers,
  type PendingWorkerOnboarding,
} from '../services/guidedIntakePersistence';
import { uploadedFileKey } from '../services/employmentTimelineOrganization';
import * as notifications from '../services/notificationService';
import type {
  FirmDashboardRow,
  FirmLiveIntakeView,
  ProfileRow,
  FirmProfileRow,
  PersistentNotificationRow,
} from '../services/intakeDataService';
import type { User } from '@supabase/supabase-js';
import { BETA_ENABLE_PARTICIPATING_ROUTING, SHOW_DEV_GALLERY, SHOW_SAMPLE_INTAKE } from './constants/flags';
import {
  OFFLINE_DEV_GALLERY_ONLY,
  SUPABASE_REQUIRED_USER_MESSAGE,
  isDevOnlyScreenWithoutSupabase,
} from '../lib/supabaseAvailability';
import { toBetaUserMessage } from './utils/betaUserError';
import { NotificationsBell } from './components/NotificationsBell';
import type { AppNotificationItem } from './components/NotificationsBell';
import {
  WorkerMobileBottomNav,
  type WorkerMobileHubView,
  type WorkerMobileNavId,
} from './components/WorkerMobileBottomNav';
import type { WorkerShellScreen } from './components/WorkerAppShell';
import type { WorkerTimelineItem } from './types/workerTimeline';
import {
  parseTimelineSourceTrace,
  stripTimelineSourceTraceBlock,
} from '../services/timelineSourceTraceCodec';
import { enrichWorkerTimelineWithSources } from './utils/workerIntakePresentationUtils';
import { FIRM_ROUTING_COPY, SAMPLE_INTAKE_NUMBER, SAMPLE_INTAKE_SUMMARY_PREVIEW } from './constants/one3sevenProduct';
import {
  CALIFORNIA_BETA_CASE_CATEGORIES,
  type IntakeCaseCategory,
} from './constants/caseCategories';
import {
  formatWorkerIntakeDisplayNumber,
  nextWorkerIntakeDisplaySequence,
  resolveWorkerIntakeDisplayNumber,
} from './utils/workerIntakeDisplayNumber';
import {
  BETA_WORKER_CASE_CATEGORY,
  isBetaEmploymentCategory,
  type EmploymentMatterTagId,
} from './constants/employmentMatter';
import {
  extractEmploymentMatterTagsFromOverview,
  loadEmploymentMatterTagsLocal,
  saveEmploymentMatterTagsLocal,
} from './utils/employmentMatterPersistence';
import {
  getWorkerIntakeMetadata,
  patchWorkerIntakeMetadata,
  type WorkerDocumentResponseDraft,
  type WorkerIntakeMetadata,
} from '../services/workerIntakeMetadata';
import {
  extractStoryFollowUpFromOverview,
  mergeStoryFollowUpIntoLatestIntakeSummary,
} from '../services/storyFollowUpPersistence';
import {
  EMPTY_STORY_FOLLOWUP,
  hasStoryFollowUpContent,
  type StoryFollowUpAnswers,
} from './constants/workerStoryIntake';

function isLegacyNonEmploymentCaseCategory(category: string | null | undefined): boolean {
  const c = (category ?? '').trim();
  if (!c) return false;
  return !isBetaEmploymentCategory(c) && c !== 'Employment';
}

function formatBellNotificationTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function parseNotificationCategories(payload: Record<string, unknown>): string[] {
  const raw = payload.requested_categories;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c).trim()).filter(Boolean);
}

/** Session bell items that duplicate persistent firm_document_request rows. */
function isSessionDocumentRequestNotification(n: AppNotificationItem): boolean {
  return n.id.startsWith('docreq-') || /requested additional documents/i.test(n.title);
}

/** Session-only items safe to show when persistent notification fetch failed. */
function isSafeSessionNotification(n: AppNotificationItem): boolean {
  if (isSessionDocumentRequestNotification(n)) return false;
  return n.id.startsWith('route-') || n.id.startsWith('email-');
}

export type Screen =
  | 'gallery'
  | 'devNavMap'
  | 'publicMarketing'
  | 'authWelcome'
  | 'signIn'
  | 'createAccount'
  | 'roleSelection'
  | 'workerDetails'
  | 'landing'
  | 'workerSettings'
  | 'caseCategory'
  | 'guidedIntake'
  | 'categoryQuestionnaire'
  | 'upload'
  | 'processing'
  | 'summary'
  | 'filePreview'
  | 'howItWorks'
  | 'firmDashboard'
  | 'intakeReview'
  | 'firmSettings'
  | 'comparison'
  | 'firmDirectedIntake';

const AUTH_FLOW_SCREENS: Screen[] = ['publicMarketing', 'authWelcome', 'signIn', 'createAccount', 'roleSelection', 'workerDetails'];

/** Defer post-auth Supabase work until after the auth callback releases the client lock. */
const POST_AUTH_DEFER_MS = 500;

/** Session flags for worker email/password signup and Google OAuth (create account). */
const O3S_SS_WORKER_PENDING_DETAILS = 'o3s_worker_pending_worker_details_v1';
const O3S_SS_WORKER_GOOGLE_SIGNUP = 'o3s_worker_google_oauth_signup_v1';

function o3sWorkerContactLocalKey(userId: string) {
  return `o3s_worker_contact_local_v1_${userId}`;
}

export type UserRole = 'worker' | 'firm' | null;

type WorkerIntakeListEntry = {
  id: string;
  intake_number: string;
  workflow_status: string;
  updated_at: string;
  has_summary: boolean;
  submission_channel?: string | null;
  case_category?: string | null;
};

const EMPTY_CATEGORY_QUESTIONNAIRE_ANSWERS: CategoryQuestionnaireAnswers = [];

/** Align active hub with a real list row (never creates intakes). */
function resolveWorkerLandingIntakeRow(
  intakeId: string | null,
  list: WorkerIntakeListEntry[]
): WorkerIntakeListEntry | null {
  if (!list.length) return null;
  if (intakeId) {
    const hit = list.find((r) => r.id === intakeId);
    if (hit) return hit;
  }
  return list.find((r) => r.has_summary) ?? list[0] ?? null;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    if (OFFLINE_DEV_GALLERY_ONLY) return 'devNavMap';
    // If a firm code is already in sessionStorage, skip the marketing page entirely
    // and go straight to the firm-directed intake. firmDirectedContext will resolve async.
    try {
      if (sessionStorage.getItem('o3s_prefill_fc')) return 'firmDirectedIntake';
    } catch { /* ignore */ }
    return 'publicMarketing';
  });
  const [comparisonView, setComparisonView] = useState<'landing' | 'dashboard' | 'both'>('both');

  // User authentication and role
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthRestoring, setIsAuthRestoring] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const userRoleRef = useRef<UserRole>(null);
  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Shared intake workspace - single source of truth
  const [currentIntakeWorkspace, setCurrentIntakeWorkspace] = useState<IntakeWorkspace>(createEmptyIntakeWorkspace());

  // Submitted intakes (simulates backend storage)
  const [submittedIntakes, setSubmittedIntakes] = useState<IntakeWorkspace[]>([]);

  // Legacy state for backwards compatibility (will be migrated to workspace)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  /** Per-index metadata for files persisted this session (aligned with `uploadedFiles`). */
  const [uploadedFilePersistMeta, setUploadedFilePersistMeta] = useState<
    Array<intakeData.UploadedFilePersistMetaRow | null>
  >([]);
  const uploadedFilePersistMetaRef = useRef(uploadedFilePersistMeta);
  /** While `persistNewFiles` is appending DB metadata, skip padding `meta` to `uploadedFiles.length`. */
  const pendingPersistMetaAppendCountRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<{
    fileName: string;
    category: string;
    timelineEvent: string;
  } | null>(null);
  const [selectedIntakeId, setSelectedIntakeId] = useState<string | null>(null);
  const [selectedRouteMeta, setSelectedRouteMeta] = useState<{
    routeId: string;
    routeStatus: string;
    intakeNumber: string;
  } | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [hasCompletedIntake, setHasCompletedIntake] = useState(false);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [firmProfile, setFirmProfile] = useState<FirmProfileRow | null>(null);
  const [currentIntakeId, setCurrentIntakeId] = useState<string | null>(null);
  const [currentIntakeNumber, setCurrentIntakeNumber] = useState<string | null>(null);
  const [firmDashboardRows, setFirmDashboardRows] = useState<FirmDashboardRow[]>([]);
  const [firmLiveView, setFirmLiveView] = useState<FirmLiveIntakeView | null>(null);
  const [firmLiveViewLoading, setFirmLiveViewLoading] = useState(false);
  /** Worker upload: firm gate behavior after "Start organizing" law-firm choice modal */
  const [workerUploadFirmIntent, setWorkerUploadFirmIntent] = useState<'default' | 'skip_firm_gate' | 'enter_firm_code_first'>(
    'default'
  );
  const [workerLiveSummary, setWorkerLiveSummary] = useState<{
    overview: string;
    timelineSummary: string;
    timeline: WorkerTimelineItem[];
    readiness: string[];
    missing: string[];
  } | null>(null);
  const [workerAccessRequests, setWorkerAccessRequests] = useState<
    Array<{ routeId: string; firmName: string; intakeNumber: string; intakeId: string; barNumber: string | null; barState: string | null }>
  >([]);
  const [participatingPreviewSent, setParticipatingPreviewSent] = useState(false);
  const [firmCodeShareCompleted, setFirmCodeShareCompleted] = useState(false);
  const [workerIntakeWorkflow, setWorkerIntakeWorkflow] = useState<string | null>(null);
  const [workerIntakeChannel, setWorkerIntakeChannel] = useState<string | null>(null);
  const [workerIntakesList, setWorkerIntakesList] = useState<WorkerIntakeListEntry[]>([]);
  const [workerIntakesLoading, setWorkerIntakesLoading] = useState(false);
  const [workerLinkedFirmName, setWorkerLinkedFirmName] = useState<string | null>(null);
  const [workerLinkedFirmCode, setWorkerLinkedFirmCode] = useState<string | null>(null);
  const [workerLinkedRouteStatus, setWorkerLinkedRouteStatus] = useState<string | null>(null);
  const [workerLinkedRouteSharedAt, setWorkerLinkedRouteSharedAt] = useState<string | null>(null);
  const [workerIntakeRoutingCards, setWorkerIntakeRoutingCards] = useState<
    intakeData.WorkerIntakeFirmRoutingCard[]
  >([]);
  const [workerLandingInitialHubView, setWorkerLandingInitialHubView] =
    useState<WorkerMobileHubView>('home');
  const [firmCodeActionBusy, setFirmCodeActionBusy] = useState(false);
  const [firmCodeActionError, setFirmCodeActionError] = useState<string | null>(null);
  const [deleteIntakeBusyId, setDeleteIntakeBusyId] = useState<string | null>(null);
  const [deleteIntakeError, setDeleteIntakeError] = useState<string | null>(null);
  const [deleteIntakeErrorIntakeId, setDeleteIntakeErrorIntakeId] = useState<string | null>(null);
  const [createNewIntakeBusy, setCreateNewIntakeBusy] = useState(false);
  /** True while category/guided/upload run without a persisted intake row yet. */
  const [workerOnboardingPrePersist, setWorkerOnboardingPrePersist] = useState(false);
  const [firmCodeModalSignal, setFirmCodeModalSignal] = useState(0);
  /** Law-firm modal answered once per signed-in worker (sessionStorage). */
  const [lawFirmGateCompleted, setLawFirmGateCompleted] = useState(false);

  // firmDirectedContext is initialised synchronously from sessionStorage so the
  // marketing page renders with firm-aware copy on the very first paint, before
  // the async firm-code lookup completes. It is also written back to sessionStorage
  // every time it changes so it survives the auth redirect.
  const [firmDirectedContext, setFirmDirectedContextState] = useState<{
    firmId: string;
    firmName: string;
    firmCode: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem('o3s_firm_ctx');
      if (raw) return JSON.parse(raw) as { firmId: string; firmName: string; firmCode: string };
    } catch { /* ignore */ }
    return null;
  });
  const setFirmDirectedContext = (
    ctx: { firmId: string; firmName: string; firmCode: string } | null
  ) => {
    try {
      if (ctx) sessionStorage.setItem('o3s_firm_ctx', JSON.stringify(ctx));
      else sessionStorage.removeItem('o3s_firm_ctx');
    } catch { /* ignore */ }
    setFirmDirectedContextState(ctx);
  };
  const [workerNotifications, setWorkerNotifications] = useState<AppNotificationItem[]>([]);
  const [firmNotifications, setFirmNotifications] = useState<AppNotificationItem[]>([]);
  const [persistentWorkerBell, setPersistentWorkerBell] = useState<AppNotificationItem[]>([]);
  const [persistentFirmBell, setPersistentFirmBell] = useState<AppNotificationItem[]>([]);
  const [workerActionNeededIntakeIds, setWorkerActionNeededIntakeIds] = useState<string[]>([]);
  const [persistentNotificationsOk, setPersistentNotificationsOk] = useState(false);
  const [persistentNotificationsLoadFailed, setPersistentNotificationsLoadFailed] = useState(false);
  /** Set when worker opens a firm_document_request notification (upload checklist later). */
  const [workerDocumentRequestPayload, setWorkerDocumentRequestPayload] = useState<{
    requested_categories: string[];
    firm_note: string;
    firm_name: string;
  } | null>(null);
  /** Increment to scroll intake summary to the intake-notes panel when opened from the dashboard. */
  const [intakeNotesScrollSignal, setIntakeNotesScrollSignal] = useState(0);
  const [accessApprovalScrollSignal, setAccessApprovalScrollSignal] = useState(0);
  /** Increment after doc-request upload processing to scroll to confirm-response on summary. */
  const [docRequestConfirmScrollSignal, setDocRequestConfirmScrollSignal] = useState(0);
  /** Display labels for uploaded files on summary (key: stable file fingerprint). */
  const [uploadedFileLabels, setUploadedFileLabels] = useState<Record<string, string>>({});

  /** Upload-screen “Add Context”; flushed into Supabase intake_summaries after org persist, or into workspace when offline. */
  const pendingUploadContextRef = useRef<string | null>(null);
  /** Pre-upload guided intake answers keyed by intake id; merged after first summary row exists. */
  const guidedIntakeByIntakeIdRef = useRef<Record<string, GuidedIntakeAnswers>>({});
  const caseCategoryByIntakeIdRef = useRef<Record<string, IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY>>({});
  const employmentMatterByIntakeIdRef = useRef<Record<string, EmploymentMatterTagId[]>>({});
  const workerMetadataByIntakeIdRef = useRef<Record<string, WorkerIntakeMetadata>>({});
  const [workerIntakeMetadataTick, setWorkerIntakeMetadataTick] = useState(0);
  const nonEmploymentAnswersByIntakeIdRef = useRef<Record<string, CategoryQuestionnaireAnswers>>({});
  const [selectedCaseCategory, setSelectedCaseCategory] = useState<IntakeCaseCategory>('Employment');
  const guidedIntakeCompletedByIntakeRef = useRef<Record<string, true>>({});
  /** Category/guided/questionnaire before first Supabase intake row is created. */
  const pendingOnboardingRef = useRef<PendingWorkerOnboarding | null>(null);
  const [, setPendingOnboardingTick] = useState(0);
  /** Sync guard: blocks DB commit / anchor while local-only onboarding is in progress. */
  const workerOnboardingPrePersistRef = useRef(false);
  /** Set when worker starts organize; drives quick pipeline + post-processing navigation. */
  const processingQuickRef = useRef(false);
  const [processingExitScreen, setProcessingExitScreen] = useState<Screen>('summary');
  const [processingQuickMode, setProcessingQuickMode] = useState(false);

  const currentIntakeIdRef = useRef<string | null>(null);
  /** Prevents landing hub anchor effect from snapping back to a prior intake during create-new. */
  const skipAnchorIntakeSyncRef = useRef(false);
  const currentIntakeWorkspaceIdRef = useRef<string>(currentIntakeWorkspace.id);
  useEffect(() => {
    currentIntakeIdRef.current = currentIntakeId;
  }, [currentIntakeId]);
  useEffect(() => {
    currentIntakeWorkspaceIdRef.current = currentIntakeWorkspace.id;
  }, [currentIntakeWorkspace.id]);

  useEffect(() => {
    if (!profile?.id || profile.role !== 'worker') return;
    try {
      setLawFirmGateCompleted(sessionStorage.getItem(`o3s_worker_law_firm_gate_v1_${profile.id}`) === '1');
    } catch {
      setLawFirmGateCompleted(false);
    }
  }, [profile?.id, profile?.role]);

  /** Any saved intake row means the worker already started organizing — skip the first-run law-firm modal. */
  useEffect(() => {
    if (!profile?.id || profile.role !== 'worker') return;
    if (workerIntakesList.length === 0) return;
    try {
      sessionStorage.setItem(`o3s_worker_law_firm_gate_v1_${profile.id}`, '1');
    } catch {
      /* ignore */
    }
    setLawFirmGateCompleted(true);
  }, [profile?.id, profile?.role, workerIntakesList.length]);

  const currentScreenRef = useRef<Screen>(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  /** Set from Auth welcome "Participating law firm? Sign in here" before navigating to Sign In. */
  const firmSignInIntentRef = useRef(false);
  const postAuthInFlightRef = useRef(false);
  const postAuthUserRef = useRef<User | null>(null);
  /** Set before anonymous sign-in so the app auto-starts intake once auth + routing settle. */
  const pendingAutoStartIntakeRef = useRef(false);

  function routeSafeAfterProfileBootstrapFailure(signedInUser: User, reason: string) {
    try {
      console.error('[o3s-post-auth] profile bootstrap failed — safe route', {
        reason,
        userId: signedInUser.id,
      });
      setProfile(null);
      const firmIntent = firmSignInIntentRef.current;
      const meta = signedInUser.user_metadata?.role;
      if (firmIntent || meta === 'firm') {
        setUserRole('firm');
        firmSignInIntentRef.current = false;
        console.info('[o3s-post-auth] safe route → firmSettings', { firmIntent, meta });
        setCurrentScreen('firmSettings');
        return;
      }
      if (meta === 'worker') {
        setUserRole('worker');
        firmSignInIntentRef.current = false;
        console.info('[o3s-post-auth] safe route → landing', { meta });
        setCurrentScreen('landing');
        return;
      }
      setUserRole(null);
      firmSignInIntentRef.current = false;
      console.info('[o3s-post-auth] safe route → roleSelection');
      setCurrentScreen('roleSelection');
    } catch (safeRouteError: unknown) {
      console.error('[o3s-post-auth] safe route handler failed', safeRouteError);
      setCurrentScreen('roleSelection');
    }
  }

  // Scroll to top when screen changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentScreen]);

  async function refreshFirmDashboardRows(fp: FirmProfileRow) {
    console.info('[o3s-firm-dashboard] firm profile id', {
      firmProfileId: fp.id,
      profileUserId: fp.profile_id,
    });
    const rows = await intakeData.loadFirmDashboardRows(fp.id);
    setFirmDashboardRows(rows);
    return rows;
  }

  async function refreshWorkerRoutingFromIntake(intakeId: string, firmNameHint?: string | null) {
    const routing = await intakeData.fetchWorkerIntakeRoutingDisplay(intakeId);
    setWorkerIntakeWorkflow(routing.workflowStatus);
    const hasFirmLink =
      routing.submissionChannel === 'firm_code' || Boolean(routing.linkedFirmId);
    setWorkerLinkedRouteStatus(routing.routeStatus);
    setWorkerLinkedRouteSharedAt(routing.routeSharedAt);
    if (hasFirmLink) {
      setWorkerIntakeChannel('firm_code');
      const fromDb = (routing.linkedFirmName ?? '').trim();
      const hint = (firmNameHint ?? '').trim();
      const resolvedName = fromDb || hint || null;
      setWorkerLinkedFirmName(resolvedName);
      setWorkerLinkedFirmCode(routing.linkedFirmCode ?? null);
    } else {
      setWorkerIntakeChannel(routing.submissionChannel);
      setWorkerLinkedFirmName(null);
      setWorkerLinkedFirmCode(null);
    }
  }

  async function refreshWorkerSummaryLive(intakeId: string) {
    if (isSupabaseConfigured()) {
      const ensure = await intakeData.ensureTimelineEventsFromUploadedFiles(intakeId);
      if (ensure.error) console.error(ensure.error);
    }
    const bundle = await intakeData.fetchIntakeSummaryBundle(intakeId);
    const intakeRow = bundle.intake as { workflow_status?: string; submission_channel?: string | null } | null;
    setWorkerIntakeWorkflow(intakeRow?.workflow_status ?? null);
    setWorkerIntakeChannel(intakeRow?.submission_channel ?? null);
    const s = bundle.summary as {
      overview?: string;
      timeline_summary?: string;
      readiness_indicators?: string[];
      missing_document_alerts?: string[];
    } | null;
    const overviewRaw = (s?.overview as string) ?? '';
    const matterFromOverview = extractEmploymentMatterTagsFromOverview(overviewRaw);
    if (matterFromOverview.length) {
      employmentMatterByIntakeIdRef.current[intakeId] = matterFromOverview;
      saveEmploymentMatterTagsLocal(intakeId, matterFromOverview);
    }
    const ev = (bundle.events ?? []) as Array<{
      id: string;
      event_date: string;
      title: string;
      category: string;
      ai_summary: string;
      worker_context: string | null;
    }>;
    const fileInventory = (bundle.files ?? []).map((f: { file_name?: string; category?: string | null }) => ({
      fileName: String(f.file_name ?? 'Uploaded file'),
      category: (f.category as string | null)?.trim() || 'Uncategorized',
    }));
    const timeline: WorkerTimelineItem[] = ev.map((e) => {
      const trace = parseTimelineSourceTrace(e.worker_context);
      const sourceNames = trace?.sourceFileNames ?? [];
      const sourceDates = trace?.sourceDates ?? [];
      return {
        date: e.event_date,
        event: e.title,
        category: e.category,
        summary: e.ai_summary,
        relatedDocs: sourceNames.length || 1,
        timelineEventId: e.id,
        workerAddedContext:
          stripTimelineSourceTraceBlock((e.worker_context ?? '').trim()) || null,
        sourceFileNames: sourceNames,
        sourceDates,
        sourceStrength: trace?.sourceStrength ?? null,
        sourceExcerpt: trace?.sourceExcerpt ?? null,
      };
    });
    const enrichedTimeline = enrichWorkerTimelineWithSources(timeline, fileInventory);
    setWorkerLiveSummary({
      overview: s?.overview ?? '',
      timelineSummary: s?.timeline_summary ?? '',
      readiness: s?.readiness_indicators ?? [],
      missing: s?.missing_document_alerts ?? [],
      timeline: enrichedTimeline,
    });
    await refreshWorkerRoutingFromIntake(intakeId);
  }

  async function refreshWorkerAccessRows(forUserId?: string) {
    const id = forUserId ?? profile?.id;
    if (!id) return;
    const rows = await intakeData.listWorkerAccessRequests(id);
    setWorkerAccessRequests(rows);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      console.info('[o3s-auth-audit] onAuthStateChange', {
        event: evt,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
      });
      if (!session?.user) {
        setAuthUser(null);
        setProfile(null);
        setFirmProfile(null);
        setIsAuthenticated(false);
        setIsAuthRestoring(false);
        setUserRole(null);
        setUserEmail(null);
        setCurrentIntakeId(null);
        currentIntakeIdRef.current = null;
        setCurrentIntakeNumber(null);
        setWorkerLiveSummary(null);
        setFirmDashboardRows([]);
        setFirmLiveView(null);
        setSelectedRouteMeta(null);
        setSelectedIntakeId(null);
        setWorkerIntakeWorkflow(null);
        setWorkerIntakeChannel(null);
        setWorkerIntakesList([]);
        setParticipatingPreviewSent(false);
        setFirmCodeShareCompleted(false);
        setWorkerAccessRequests([]);
        setWorkerLinkedFirmName(null);
        setWorkerLinkedFirmCode(null);
        setWorkerLinkedRouteStatus(null);
        setWorkerLinkedRouteSharedAt(null);
        setWorkerIntakeRoutingCards([]);
        setWorkerNotifications([]);
        setFirmNotifications([]);
        setPersistentWorkerBell([]);
        setPersistentFirmBell([]);
        setPersistentNotificationsOk(false);
        setWorkerDocumentRequestPayload(null);
        setCurrentIntakeWorkspace(createEmptyIntakeWorkspace());
        setSubmittedIntakes([]);
        setUploadedFiles([]);
        setUploadedFilePersistMeta([]);
        setSelectedFile(null);
        setShowExitModal(false);
        setHasCompletedIntake(false);
        setWorkerUploadFirmIntent('default');
        setFirmLiveViewLoading(false);
        setCurrentScreen('publicMarketing');
        firmSignInIntentRef.current = false;
        try {
          sessionStorage.removeItem('o3s_offline_role');
          sessionStorage.removeItem(O3S_SS_WORKER_PENDING_DETAILS);
          sessionStorage.removeItem(O3S_SS_WORKER_GOOGLE_SIGNUP);
        } catch {
          /* ignore */
        }
        return;
      }
      const signedInUser = session.user;
      setAuthUser(signedInUser);
      postAuthUserRef.current = signedInUser;
      setUserEmail(signedInUser.email ?? null);
      setIsAuthenticated(true);
      setIsAuthRestoring(false);

      // Defer all Supabase calls until after the auth callback releases the client lock (fetchProfile hang).
      const runPostAuth = () => {
        if (postAuthInFlightRef.current) {
          console.info('[o3s-post-auth] skip duplicate in-flight handler');
          return;
        }
        postAuthInFlightRef.current = true;
        void (async () => {
          try {
            let pendingDetailsProbe = false;
            try {
              pendingDetailsProbe = sessionStorage.getItem(O3S_SS_WORKER_PENDING_DETAILS) === '1';
            } catch {
              pendingDetailsProbe = false;
            }
            console.info('[o3s-post-auth]', {
              phase: 'signed-in-start',
              currentScreen: currentScreenRef.current,
              nextScreen: null,
              routingProfileRole: null,
              pendingDetails: pendingDetailsProbe,
            });

            console.info('[o3s-post-auth]', {
              phase: 'before-ensureUserProfile',
              currentScreen: currentScreenRef.current,
              nextScreen: null,
              routingProfileRole: null,
              pendingDetails: pendingDetailsProbe,
            });

            const meta = signedInUser.user_metadata?.role;
            const roleFromMeta = meta === 'worker' || meta === 'firm' ? meta : undefined;
            const refR = userRoleRef.current;
            const roleFromRef = refR === 'worker' || refR === 'firm' ? refR : undefined;
            const roleHint = roleFromMeta ?? roleFromRef;
            console.info('[o3s-post-auth] ensureUserProfile (before)', {
              userId: signedInUser.id,
            });
            const { profile: p, error: profileEnsureError } = await intakeData.ensureUserProfile(
              signedInUser,
              roleHint !== undefined ? { role: roleHint } : {}
            );
            console.info('[o3s-post-auth] ensureUserProfile (after)', {
              userId: signedInUser.id,
              hasProfile: Boolean(p),
              hasError: Boolean(profileEnsureError),
              profileRole: p?.role ?? null,
            });
            if (profileEnsureError || !p) {
              routeSafeAfterProfileBootstrapFailure(
                signedInUser,
                profileEnsureError ?? 'no profile row'
              );
              return;
            }
            setProfile(p);

            let routingProfile = p;

            if (currentScreenRef.current === 'roleSelection') {
              console.info('[o3s-post-auth] on roleSelection — skip auto-routing until user commits role');
              return;
            }

            try {
              pendingDetailsProbe = sessionStorage.getItem(O3S_SS_WORKER_PENDING_DETAILS) === '1';
            } catch {
              pendingDetailsProbe = false;
            }
            console.info('[o3s-post-auth]', {
              phase: 'after-ensureUserProfile',
              currentScreen: currentScreenRef.current,
              nextScreen: null,
              routingProfileRole: routingProfile?.role ?? null,
              pendingDetails: pendingDetailsProbe,
            });

            let googleSignup = false;
            try {
              googleSignup = sessionStorage.getItem(O3S_SS_WORKER_GOOGLE_SIGNUP) === '1';
            } catch {
              /* ignore */
            }
            if (googleSignup) {
              try {
                sessionStorage.removeItem(O3S_SS_WORKER_GOOGLE_SIGNUP);
              } catch {
                /* ignore */
              }
              const metaGoogle = signedInUser.user_metadata ?? {};
              const display =
                typeof metaGoogle.full_name === 'string'
                  ? metaGoogle.full_name.trim()
                  : typeof metaGoogle.name === 'string'
                    ? metaGoogle.name.trim()
                    : '';
              const pr2 = await intakeData.fetchProfile(signedInUser.id);
              if (display && pr2 && !((pr2.full_name ?? '').trim())) {
                const unp = await intakeData.updateProfileName(signedInUser.id, display);
                if (!unp.error) {
                  const pr3 = await intakeData.fetchProfile(signedInUser.id);
                  setProfile(pr3);
                  routingProfile = pr3;
                }
              }
            }

            let firmProfileForRouting: FirmProfileRow | null = null;
            if (routingProfile?.role === 'firm') {
              setUserRole('firm');
              firmProfileForRouting = await intakeData.ensureFirmProfile(
                signedInUser.id,
                signedInUser.email ?? null
              );
              setFirmProfile(firmProfileForRouting);
              if (firmProfileForRouting && intakeData.isFirmProfileComplete(firmProfileForRouting)) {
                await refreshFirmDashboardRows(firmProfileForRouting);
              }
            } else if (routingProfile?.role === 'worker') {
              setUserRole('worker');
              await refreshWorkerAccessRows(signedInUser.id);
              await refreshWorkerIntakesList(signedInUser.id);
            } else {
              setUserRole(null);
            }

            const screen = currentScreenRef.current;

            let pendingDetails = false;
            try {
              pendingDetails = sessionStorage.getItem(O3S_SS_WORKER_PENDING_DETAILS) === '1';
            } catch {
              /* ignore */
            }
            if (pendingDetails && routingProfile?.role === 'worker') {
              if (AUTH_FLOW_SCREENS.includes(screen) || screen === 'authWelcome') {
                firmSignInIntentRef.current = false;
                setCurrentScreen('workerDetails');
                return;
              }
            }

            if (screen === 'workerDetails' && routingProfile?.role === 'worker') {
              return;
            }

            // Firm-directed magic link return: restore pending intake data and create the intake.
            let handledFirmDirectedReturn = false;
            if (routingProfile?.role === 'worker') {
              let fdRaw: string | null = null;
              try { fdRaw = sessionStorage.getItem(FD_SS_KEY); } catch { /* ignore */ }
              if (fdRaw) {
                try {
                  type FDPayload = FirmDirectedIntakeData & { firmId?: string; firmCode?: string; firmName?: string };
                  const fdData: FDPayload = JSON.parse(fdRaw) as FDPayload;
                  const targetFirmId: string | null = fdData.firmId ?? null;

                  // Update profile name/phone so the worker record is complete.
                  const fullName = [fdData.firstName, fdData.lastName].filter(Boolean).join(' ');
                  if (fullName) await intakeData.updateProfileName(signedInUser.id, fullName);
                  if (fdData.phone) await intakeData.saveWorkerContactDetails(signedInUser.id, { phone: fdData.phone });

                  // Create draft intake linked to firm.
                  const draftResult = await intakeData.createDraftIntake(signedInUser.id, {
                    linked_firm_id: targetFirmId ?? undefined,
                    submission_channel: targetFirmId ? 'firm_code' : null,
                  });

                  try { sessionStorage.removeItem(FD_SS_KEY); } catch { /* ignore */ }
                  try { sessionStorage.removeItem('o3s_prefill_fc'); } catch { /* ignore */ }
                  try { sessionStorage.removeItem('o3s_firm_ctx'); } catch { /* ignore */ }

                  if (draftResult?.id) {
                    setCurrentIntakeId(draftResult.id);
                    currentIntakeIdRef.current = draftResult.id;
                    // Seed the in-memory guided intake ref AND sessionStorage so runOrganizationPipeline
                    // picks up employer + story when the worker uploads files on the same page load.
                    const fdGuidedAnswers: GuidedIntakeAnswers = {
                      topics: fdData.employer ? [`Employer: ${fdData.employer}`] : [],
                      context: fdData.story ?? '',
                      availableRecords: [],
                    };
                    guidedIntakeByIntakeIdRef.current[draftResult.id] = fdGuidedAnswers;
                    saveGuidedIntakeToSession(draftResult.id, fdGuidedAnswers);
                    await refreshWorkerIntakesList(signedInUser.id);
                    setCurrentScreen('upload');
                    handledFirmDirectedReturn = true;
                  }
                } catch (fdErr) {
                  console.error('[o3s-fd-return] failed to restore firm-directed intake', fdErr);
                  try { sessionStorage.removeItem(FD_SS_KEY); } catch { /* ignore */ }
                }
              }
            }

            if (!handledFirmDirectedReturn && AUTH_FLOW_SCREENS.includes(screen)) {
              const firmIntent = firmSignInIntentRef.current;
              if (routingProfile?.role === 'firm') {
                const firmScreen = intakeData.firmProfileNeedsSetup(firmProfileForRouting)
                  ? 'firmSettings'
                  : 'firmDashboard';
                console.log('sign-in role:', routingProfile.role, 'firm intent:', firmIntent, 'routing to:', firmScreen);
                firmSignInIntentRef.current = false;
                setCurrentScreen(firmScreen);
              } else if (routingProfile?.role === 'worker') {
                console.log(
                  'sign-in role:',
                  routingProfile.role,
                  'firm intent:',
                  firmIntent,
                  'routing to:',
                  firmIntent ? 'firmDashboard' : 'landing'
                );
                firmSignInIntentRef.current = false;
                setCurrentScreen(firmIntent ? 'firmDashboard' : 'landing');
              } else {
                console.log(
                  'sign-in role:',
                  routingProfile?.role ?? 'none',
                  'firm intent:',
                  firmIntent,
                  'routing to:',
                  'roleSelection'
                );
                setUserRole(null);
                firmSignInIntentRef.current = false;
                setCurrentScreen('roleSelection');
              }
            }
          } catch (error: unknown) {
            console.error('[o3s-auth] post-auth routing failed', error);
            setFirmLiveViewLoading(false);
            routeSafeAfterProfileBootstrapFailure(
              signedInUser,
              error instanceof Error ? error.message : 'post-auth routing failed'
            );
          } finally {
            postAuthInFlightRef.current = false;
            console.info('[o3s-post-auth] deferred handler finished', {
              currentScreen: currentScreenRef.current,
            });
          }
        })();
      };
      // Double defer: rAF + two timeouts so DB work runs after Supabase auth navigator lock releases.
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            window.setTimeout(runPostAuth, POST_AUTH_DEFER_MS);
          }, POST_AUTH_DEFER_MS);
        });
      } else {
        window.setTimeout(() => {
          window.setTimeout(runPostAuth, POST_AUTH_DEFER_MS);
        }, POST_AUTH_DEFER_MS);
      }
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      postAuthUserRef.current = user;
      if (user) {
        setIsAuthenticated(true);
      }
      setIsAuthRestoring(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Tab focus often releases the auth lock; retry post-auth bootstrap if profile never loaded. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const signedInUser = postAuthUserRef.current;
      if (!signedInUser?.id) return;
      if (profile?.id === signedInUser.id) return;
      const screen = currentScreenRef.current;
      if (!AUTH_FLOW_SCREENS.includes(screen) && screen !== 'firmSettings') return;
      if (postAuthInFlightRef.current) return;
      console.info('[o3s-post-auth] visibility retry — scheduling deferred post-auth', { screen });
      const runRetry = () => {
        if (postAuthInFlightRef.current) return;
        postAuthInFlightRef.current = true;
        void (async () => {
          try {
            const { profile: p, error: profileEnsureError } = await intakeData.ensureUserProfile(signedInUser);
            if (profileEnsureError || !p) {
              routeSafeAfterProfileBootstrapFailure(signedInUser, profileEnsureError ?? 'no profile row');
              return;
            }
            setProfile(p);
            if (currentScreenRef.current === 'roleSelection') return;
            if (p.role === 'firm') {
              setUserRole('firm');
              const fp = await intakeData.fetchFirmProfileForUserWithTimeout(signedInUser.id);
              setFirmProfile(fp);
              if (AUTH_FLOW_SCREENS.includes(currentScreenRef.current)) {
                setCurrentScreen(intakeData.firmProfileNeedsSetup(fp) ? 'firmSettings' : 'firmDashboard');
              }
            } else if (p.role === 'worker') {
              setUserRole('worker');
              if (AUTH_FLOW_SCREENS.includes(currentScreenRef.current)) {
                setCurrentScreen('landing');
              }
            }
          } catch (e) {
            console.error('[o3s-post-auth] visibility retry failed', e);
          } finally {
            postAuthInFlightRef.current = false;
          }
        })();
      };
      window.setTimeout(runRetry, POST_AUTH_DEFER_MS);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile?.id]);

  useEffect(() => {
    if (currentScreen !== 'summary' || !currentIntakeId || !isSupabaseConfigured()) return;
    void refreshWorkerSummaryLive(currentIntakeId);
  }, [currentScreen, currentIntakeId]);

  useEffect(() => {
    if (currentScreen !== 'intakeReview' || !selectedIntakeId || !selectedRouteMeta || !isSupabaseConfigured()) {
      return;
    }
    void reloadFirmLiveViewForSelection();
  }, [currentScreen, selectedIntakeId, selectedRouteMeta?.routeId]);

  useEffect(() => {
    if (currentScreen !== 'intakeReview' || !selectedIntakeId || !selectedRouteMeta || !isSupabaseConfigured()) {
      return;
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reloadFirmLiveViewForSelection();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentScreen, selectedIntakeId, selectedRouteMeta?.routeId]);

  useEffect(() => {
    if (currentScreen !== 'summary' || !currentIntakeId || !isSupabaseConfigured()) return;
    void refreshWorkerAccessRows();
  }, [currentScreen, currentIntakeId, profile?.id]);

  useEffect(() => {
    if (currentScreen !== 'landing' || profile?.role !== 'worker' || !profile?.id || !isSupabaseConfigured()) return;
    void refreshWorkerIntakesList(profile.id);
  }, [currentScreen, profile?.id, profile?.role]);

  useEffect(() => {
    if (currentScreen !== 'processing' || !currentIntakeId || !isSupabaseConfigured()) return;
    void intakeData.updateIntakeWorkflowStatus(currentIntakeId, 'Organizing Records');
  }, [currentScreen, currentIntakeId]);

  useEffect(() => {
    if (!currentIntakeId || !isSupabaseConfigured()) return;
    const pendingHere = workerAccessRequests.filter((r) => r.intakeId === currentIntakeId);
    if (pendingHere.length === 0) return;
    void intakeData.updateIntakeWorkflowStatus(currentIntakeId, 'Awaiting Worker Approval');
  }, [workerAccessRequests, currentIntakeId]);

  // Helper: Update the current intake workspace
  const updateCurrentIntake = (updates: Partial<IntakeWorkspace>) => {
    setCurrentIntakeWorkspace((prev) => updateIntakeWorkspace(prev, updates));
  };

  // Helper: Save intake workspace
  const saveIntakeWorkspace = () => {
    setCurrentIntakeWorkspace((prev) => markIntakeAsSaved(prev));
  };

  // Helper: Submit intake to participating firms (prototype / offline)
  const submitToFirms = () => {
    let submittedIntake = submitIntakeToFirms(currentIntakeWorkspace);
    const eligibleFirmIds = routeIntakeToEligibleFirms(submittedIntake, mockFirmPreferences);
    submittedIntake = routeIntakeToFirms(submittedIntake, eligibleFirmIds);
    setCurrentIntakeWorkspace(submittedIntake);
    setSubmittedIntakes((prev) => [...prev, submittedIntake]);
    setWorkerIntakeChannel('participating');
    setWorkerIntakeWorkflow('Matching Participating Firms');
    setParticipatingPreviewSent(true);
    console.log(`Intake ${submittedIntake.id} routed to ${eligibleFirmIds.length} eligible firms:`, eligibleFirmIds);
  };

  const updateSubmittedIntake = (intakeId: string, updates: Partial<IntakeWorkspace>) => {
    setSubmittedIntakes((prev) =>
      prev.map((intake) =>
        intake.id === intakeId ? { ...intake, ...updates, lastModifiedAt: new Date().toISOString() } : intake
      )
    );
  };

  const getIntakeWorkspace = (intakeId: string): IntakeWorkspace | undefined => {
    return submittedIntakes.find((intake) => intake.id === intakeId);
  };

  const startNewIntake = () => {
    setCurrentIntakeWorkspace(createEmptyIntakeWorkspace());
    setUploadedFiles([]);
    setUploadedFilePersistMeta([]);
    setHasCompletedIntake(false);
    setCurrentIntakeId(null);
    currentIntakeIdRef.current = null;
    setCurrentIntakeNumber(null);
    setWorkerLiveSummary(null);
    setWorkerIntakeWorkflow(null);
    setWorkerIntakeChannel(null);
    setParticipatingPreviewSent(false);
    setFirmCodeShareCompleted(false);
    setWorkerLinkedFirmName(null);
    setWorkerLinkedFirmCode(null);
    setWorkerLinkedRouteStatus(null);
    setWorkerLinkedRouteSharedAt(null);
  };

  /** Clears upload file UI only (keeps summary until replaced for the selected intake). */
  const clearWorkerUploadUiState = useCallback(() => {
    setUploadedFiles([]);
    setUploadedFilePersistMeta([]);
    setUploadedFileLabels({});
    pendingUploadContextRef.current = null;
  }, []);

  /** Clears upload + summary UI (create-new / sign-out; does not delete Supabase rows). */
  const clearWorkerIntakeUiState = useCallback(() => {
    clearWorkerUploadUiState();
    setWorkerLiveSummary(null);
    setWorkerDocumentRequestPayload(null);
  }, [clearWorkerUploadUiState]);

  const syncPendingOnboarding = useCallback((next: PendingWorkerOnboarding | null) => {
    pendingOnboardingRef.current = next;
    savePendingOnboardingSession(next);
    setPendingOnboardingTick((n) => n + 1);
  }, []);

  /** Persist pending onboarding to ref/session without re-rendering App (stable text inputs). */
  const syncPendingOnboardingDraft = useCallback((next: PendingWorkerOnboarding | null) => {
    pendingOnboardingRef.current = next;
    savePendingOnboardingSession(next);
  }, []);

  const getPendingOnboarding = useCallback((): PendingWorkerOnboarding | null => {
    const fromRef = pendingOnboardingRef.current;
    if (fromRef && hasPendingOnboardingContent(fromRef)) return fromRef;
    const fromSession = loadPendingOnboardingSession();
    if (fromSession && hasPendingOnboardingContent(fromSession)) {
      pendingOnboardingRef.current = fromSession;
      return fromSession;
    }
    return null;
  }, []);

  const abandonPendingWorkerOnboarding = useCallback(() => {
    pendingOnboardingRef.current = null;
    clearPendingOnboardingSession();
    setPendingOnboardingTick((n) => n + 1);
    workerOnboardingPrePersistRef.current = false;
    setWorkerOnboardingPrePersist(false);
    skipAnchorIntakeSyncRef.current = false;
  }, []);

  const startBetaEmploymentGuidedIntake = useCallback(
    (base?: PendingWorkerOnboarding | null) => {
      const priorGuided = base?.guidedAnswers;
      const next: PendingWorkerOnboarding = {
        ...(base ?? {}),
        caseCategory: BETA_WORKER_CASE_CATEGORY,
        employmentMatterTags: base?.employmentMatterTags ?? [],
        guidedAnswers: priorGuided
          ? {
              ...priorGuided,
              topics: [],
              caseCategory: BETA_WORKER_CASE_CATEGORY,
              employmentMatterTags: priorGuided.employmentMatterTags ?? base?.employmentMatterTags ?? [],
            }
          : {
              topics: [],
              context: '',
              availableRecords: [],
              caseCategory: BETA_WORKER_CASE_CATEGORY,
              employmentMatterTags: base?.employmentMatterTags ?? [],
              skipped: false,
            },
      };
      pendingOnboardingRef.current = next;
      syncPendingOnboardingDraft(next);
      setSelectedCaseCategory('Employment');
      setCurrentScreen('guidedIntake');
    },
    [syncPendingOnboardingDraft]
  );

  const resumePendingWorkerOnboarding = useCallback(() => {
    const pending = getPendingOnboarding();
    if (!pending) return false;
    if (pending.caseCategory) {
      setSelectedCaseCategory(
        isBetaEmploymentCategory(pending.caseCategory) ? 'Employment' : (pending.caseCategory as IntakeCaseCategory)
      );
    }
    if (pending.guidedFlowCompleted) {
      setCurrentScreen('upload');
      return true;
    }
    if (!pending.caseCategory && !pending.employmentMatterTags?.length) {
      startBetaEmploymentGuidedIntake(pending);
      return true;
    }
    if (isLegacyNonEmploymentCaseCategory(pending.caseCategory)) {
      setCurrentScreen('categoryQuestionnaire');
      return true;
    }
    startBetaEmploymentGuidedIntake(pending);
    return true;
  }, [getPendingOnboarding, startBetaEmploymentGuidedIntake]);

  const syncWorkerIntakeUiToListRow = useCallback(
    (intakeId: string | null) => {
      if (!intakeId) {
        setHasCompletedIntake(false);
        return;
      }
      const row = workerIntakesList.find((r) => r.id === intakeId);
      setHasCompletedIntake(Boolean(row?.has_summary));
      if (!row?.has_summary) {
        setWorkerLiveSummary(null);
      }
    },
    [workerIntakesList]
  );

  const hydrateUploadedFilesForIntake = useCallback(
    async (intakeId: string) => {
      if (!isSupabaseConfigured() || profile?.role !== 'worker') return;
      console.info('[o3s-intake] listUploadedFiles', { intakeId });
      const rows = await intakeData.listUploadedFiles(intakeId);
      if (currentIntakeIdRef.current !== intakeId) {
        console.info('[o3s-intake] hydrate skipped (intake changed)', {
          requested: intakeId,
          activeRef: currentIntakeIdRef.current,
        });
        return;
      }
      const hydratedFiles = rows.map((row) => {
        const name = typeof row.file_name === 'string' && row.file_name.trim() ? row.file_name : 'Uploaded file';
        const type = typeof row.file_type === 'string' ? row.file_type : '';
        const size = typeof row.file_size === 'number' ? row.file_size : 0;
        return new File([new Blob([], { type })], name, { type, lastModified: Date.now() + size });
      });
      setUploadedFiles(hydratedFiles);
      setUploadedFilePersistMeta(
        rows.map((row) =>
          typeof row.id === 'string' && typeof row.file_path === 'string'
            ? {
                uploadedFileId: row.id,
                filePath: row.file_path,
                category:
                  (row.category as string | null)?.trim() ||
                  intakeData.inferCategoryFromFileName(String(row.file_name ?? '')),
              }
            : null
        )
      );
      console.info('[o3s-intake] hydrate complete', {
        intakeId,
        rowCount: rows.length,
        uploadedFilesCount: hydratedFiles.length,
        activeRef: currentIntakeIdRef.current,
      });
    },
    [profile?.role]
  );

  const refreshWorkerIntakeMetadata = useCallback(async (intakeId: string) => {
    if (!isSupabaseConfigured()) return;
    const { metadata, error } = await getWorkerIntakeMetadata(intakeId);
    if (error) console.warn('[o3s-metadata] load failed', { intakeId, error });
    workerMetadataByIntakeIdRef.current[intakeId] = metadata;
    if (metadata.employmentMatterTags?.length) {
      employmentMatterByIntakeIdRef.current[intakeId] = metadata.employmentMatterTags;
      saveEmploymentMatterTagsLocal(intakeId, metadata.employmentMatterTags);
    }
    setWorkerIntakeMetadataTick((t) => t + 1);
  }, []);

  const saveWorkerStoryToIntakeMetadata = useCallback(async (intakeId: string, story: string) => {
    const trimmed = story.trim();
    if (!trimmed || !isSupabaseConfigured()) return;
    const existing = workerMetadataByIntakeIdRef.current[intakeId]?.workerStory?.trim() ?? '';
    if (existing === trimmed) return;
    const patch = await patchWorkerIntakeMetadata(intakeId, { workerStory: trimmed });
    if (patch.error) {
      console.warn('[o3s-metadata] worker story save failed', { intakeId, error: patch.error });
      return;
    }
    if (patch.metadata) {
      workerMetadataByIntakeIdRef.current[intakeId] = patch.metadata;
      setWorkerIntakeMetadataTick((t) => t + 1);
    }
  }, []);

  const selectWorkerIntake = useCallback(
    async (intakeId: string) => {
      console.info('[o3s-intake] selectWorkerIntake', { intakeId });
      abandonPendingWorkerOnboarding();
      workerOnboardingPrePersistRef.current = false;
      currentIntakeIdRef.current = intakeId;
      setCurrentIntakeId(intakeId);
      const card = workerIntakeRoutingCards.find((c) => c.intakeId === intakeId);
      const row = workerIntakesList.find((r) => r.id === intakeId);
      if (card) setCurrentIntakeNumber(card.intakeNumber);
      else if (row) setCurrentIntakeNumber(row.intake_number);

      const matterFromCard = card?.employmentMatterTags;
      if (matterFromCard?.length) {
        employmentMatterByIntakeIdRef.current[intakeId] = matterFromCard;
      } else {
        const fromLocal = loadEmploymentMatterTagsLocal(intakeId);
        if (fromLocal?.length) employmentMatterByIntakeIdRef.current[intakeId] = fromLocal;
      }

      clearWorkerUploadUiState();
      syncWorkerIntakeUiToListRow(intakeId);
      void refreshWorkerIntakeMetadata(intakeId);
      await refreshWorkerRoutingFromIntake(intakeId);

      const screen = currentScreenRef.current;
      if (screen === 'upload' || screen === 'summary') {
        await hydrateUploadedFilesForIntake(intakeId);
        if (card?.hasSummary || row?.has_summary) {
          await refreshWorkerSummaryLive(intakeId);
        } else {
          setWorkerLiveSummary(null);
        }
      }
    },
    [
      workerIntakeRoutingCards,
      workerIntakesList,
      clearWorkerUploadUiState,
      syncWorkerIntakeUiToListRow,
      hydrateUploadedFilesForIntake,
      refreshWorkerIntakeMetadata,
    ]
  );

  const markGuidedIntakeFlowCompleted = useCallback((
    intakeId: string,
    answers: GuidedIntakeAnswers,
    opts?: { persistStory?: boolean }
  ): GuidedIntakeAnswers => {
    const existing =
      guidedIntakeByIntakeIdRef.current[intakeId] ??
      loadGuidedIntakeFromSession(intakeId);
    const existingContext = existing?.context?.trim() ?? '';
    const incomingContext = answers.context.trim();
    const safeAnswers =
      existingContext && !incomingContext
        ? { ...answers, context: existingContext }
        : answers;
    guidedIntakeCompletedByIntakeRef.current[intakeId] = true;
    markGuidedIntakeCompletedInSession(intakeId);
    guidedIntakeByIntakeIdRef.current[intakeId] = safeAnswers;
    saveGuidedIntakeToSession(intakeId, safeAnswers);
    if (opts?.persistStory !== false) {
      void saveWorkerStoryToIntakeMetadata(intakeId, safeAnswers.context);
    }
    if (safeAnswers.caseCategory?.trim()) {
      caseCategoryByIntakeIdRef.current[intakeId] = safeAnswers.caseCategory;
      saveCaseCategoryLocal(intakeId, safeAnswers.caseCategory);
    }
    return safeAnswers;
  }, [saveWorkerStoryToIntakeMetadata]);

  /**
   * Persist pending onboarding as a draft intake (category + guided/questionnaire in session/local refs).
   * No-op when an intake id is already active.
   */
  const commitPendingWorkerIntake = useCallback(async (): Promise<string | null> => {
    if (!isSupabaseConfigured()) return currentIntakeIdRef.current;
    if (!isAuthenticated || !authUser?.id || profile?.role !== 'worker' || !profile?.id) {
      window.alert(
        'Unable to save intake: your profile is still loading. Please wait and try again.'
      );
      return null;
    }
    if (currentIntakeIdRef.current) return currentIntakeIdRef.current;

    const pending = getPendingOnboarding();
    if (!isPendingOnboardingReadyToPersist(pending)) {
      window.alert('Finish the intake questions before saving or organizing.');
      return null;
    }

    const category = pending!.caseCategory ?? BETA_WORKER_CASE_CATEGORY;
    const matterTags =
      pending!.employmentMatterTags ??
      pending!.guidedAnswers?.employmentMatterTags ??
      [];
    const workerId = profile.id;
    const displayIntakeNumber = formatWorkerIntakeDisplayNumber(
      category,
      nextWorkerIntakeDisplaySequence(workerIntakesList)
    );
    console.info('[o3s-intake] commitPendingWorkerIntake createDraftIntake', {
      authUserId: authUser.id,
      profileId: profile.id,
      caseCategory: category,
      displayIntakeNumber,
    });
    const res = await intakeData.createDraftIntake(workerId, {
      intake_number: displayIntakeNumber,
    });
    if (res.error) {
      window.alert(res.error);
      return null;
    }
    const intakeId = res.id ?? null;
    if (!intakeId) {
      window.alert('Could not create intake.');
      return null;
    }

    caseCategoryByIntakeIdRef.current[intakeId] = category;
    saveCaseCategoryLocal(intakeId, category);
    if (matterTags.length) {
      employmentMatterByIntakeIdRef.current[intakeId] = matterTags;
      saveEmploymentMatterTagsLocal(intakeId, matterTags);
      void mergeEmploymentMatterIntoLatestIntakeSummary(intakeId, matterTags);
    }

    let guidedPayload: GuidedIntakeAnswers | null = pending.guidedAnswers ?? null;
    if (!guidedPayload && pending.questionnaireAnswers?.length) {
      const contextSummary = pending.questionnaireAnswers
        .filter((row) => row.answer.trim().length > 0)
        .slice(0, 6)
        .map((row) => `${row.question}: ${row.answer.trim()}`)
        .join('\n');
      guidedPayload = {
        caseCategory: category,
        topics: [category],
        availableRecords: [],
        context: contextSummary,
        scaffoldResponses: pending.questionnaireAnswers,
        skipped: false,
      };
    }
    if (guidedPayload) {
      const savedGuidedAnswers = markGuidedIntakeFlowCompleted(intakeId, {
        ...guidedPayload,
        caseCategory: category,
        employmentMatterTags: matterTags.length ? matterTags : guidedPayload.employmentMatterTags,
      }, { persistStory: false });
      await saveWorkerStoryToIntakeMetadata(intakeId, savedGuidedAnswers.context);
    } else if (pending.guidedFlowCompleted) {
      const savedGuidedAnswers = markGuidedIntakeFlowCompleted(intakeId, {
        topics: isBetaEmploymentCategory(category) ? [] : [String(category)],
        context: '',
        availableRecords: [],
        caseCategory: category,
        employmentMatterTags: matterTags,
        skipped: isBetaEmploymentCategory(category),
      }, { persistStory: false });
      await saveWorkerStoryToIntakeMetadata(intakeId, savedGuidedAnswers.context);
    }
    if (pending.questionnaireAnswers?.length) {
      nonEmploymentAnswersByIntakeIdRef.current[intakeId] = pending.questionnaireAnswers;
    }

    if (hasStoryFollowUpContent(pending.storyFollowUp)) {
      const followUpPatch = await patchWorkerIntakeMetadata(intakeId, {
        storyFollowUp: pending.storyFollowUp!,
      });
      if (followUpPatch.error) {
        console.warn('[o3s-metadata] story follow-up commit failed', {
          intakeId,
          error: followUpPatch.error,
        });
      } else if (followUpPatch.metadata) {
        workerMetadataByIntakeIdRef.current[intakeId] = {
          ...(workerMetadataByIntakeIdRef.current[intakeId] ?? {}),
          ...followUpPatch.metadata,
        };
        setWorkerIntakeMetadataTick((t) => t + 1);
      }
    }

    workerOnboardingPrePersistRef.current = false;
    abandonPendingWorkerOnboarding();
    currentIntakeIdRef.current = intakeId;
    setCurrentIntakeId(intakeId);
    setCurrentIntakeNumber(res.intake_number ?? displayIntakeNumber);
    setParticipatingPreviewSent(false);
    setFirmCodeShareCompleted(false);
    setWorkerIntakeWorkflow(null);
    setWorkerIntakeChannel(null);
    await refreshWorkerIntakesList(workerId);
    setWorkerOnboardingPrePersist(false);
    skipAnchorIntakeSyncRef.current = false;
    return intakeId;
  }, [
    isAuthenticated,
    authUser?.id,
    profile?.id,
    profile?.role,
    getPendingOnboarding,
    abandonPendingWorkerOnboarding,
    markGuidedIntakeFlowCompleted,
    saveWorkerStoryToIntakeMetadata,
    workerIntakesList,
  ]);

  /**
   * Supabase worker: ensure `currentIntakeId` exists (commits pending onboarding if needed).
   * Does not create a row without completed local onboarding.
   */
  const ensureWorkerIntakePersisted = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) return true;
    if (!isAuthenticated || !authUser?.id || profile?.role !== 'worker' || !profile?.id) {
      window.alert(
        'Unable to open upload: your profile is still loading or could not be found. Please wait a moment and try again, or sign out and sign back in.'
      );
      return false;
    }
    if (currentIntakeIdRef.current) return true;
    const pending = getPendingOnboarding();
    if (!isPendingOnboardingReadyToPersist(pending)) {
      window.alert('Finish the intake questions before organizing or uploading.');
      return false;
    }
    return (await commitPendingWorkerIntake()) != null;
  }, [
    isAuthenticated,
    authUser?.id,
    profile?.id,
    profile?.role,
    getPendingOnboarding,
    commitPendingWorkerIntake,
  ]);

  const categoryFromGuidedAnswers = useCallback(
    (intakeId: string): IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY | null => {
      const fromRef = caseCategoryByIntakeIdRef.current[intakeId];
      if (fromRef) return fromRef;
      const fromSession = loadGuidedIntakeFromSession(intakeId)?.caseCategory;
      if (fromSession) {
        if (isBetaEmploymentCategory(fromSession) || fromSession === BETA_WORKER_CASE_CATEGORY) {
          return BETA_WORKER_CASE_CATEGORY;
        }
        if (CALIFORNIA_BETA_CASE_CATEGORIES.some((category) => category.name === fromSession)) {
          return fromSession;
        }
      }
      const fromLocal = loadCaseCategoryLocal(intakeId);
      if (fromLocal) {
        if (isBetaEmploymentCategory(fromLocal) || fromLocal === BETA_WORKER_CASE_CATEGORY) {
          return BETA_WORKER_CASE_CATEGORY;
        }
        if (CALIFORNIA_BETA_CASE_CATEGORIES.some((category) => category.name === fromLocal)) {
          return fromLocal;
        }
      }
      return null;
    },
    []
  );

  const shouldShowGuidedIntake = useCallback(
    async (intakeId: string | null): Promise<boolean> => {
      if (!intakeId || !isSupabaseConfigured()) return false;
      if (guidedIntakeCompletedByIntakeRef.current[intakeId]) return false;
      if (isGuidedIntakeCompletedInSession(intakeId)) {
        guidedIntakeCompletedByIntakeRef.current[intakeId] = true;
        return false;
      }
      const row = workerIntakesList.find((r) => r.id === intakeId);
      if (row?.has_summary) return false;
      const wf = workerIntakeWorkflow;
      if (
        wf === 'Additional Documents Requested' ||
        wf === 'Worker Uploaded Additional Documents' ||
        wf === 'Worker Uploaded Requested Documents'
      ) {
        return false;
      }
      const files = await intakeData.listUploadedFiles(intakeId);
      if (files.length > 0) return false;
      if (currentIntakeId === intakeId && uploadedFiles.length > 0) return false;
      return true;
    },
    [workerIntakesList, workerIntakeWorkflow, currentIntakeId, uploadedFiles.length]
  );

  const completeGuidedIntakeFlow = useCallback(
    async (answers: GuidedIntakeAnswers) => {
      const intakeId = currentIntakeIdRef.current;
      const category =
        (intakeId ? categoryFromGuidedAnswers(intakeId) : null) ??
        getPendingOnboarding()?.caseCategory ??
        selectedCaseCategory ??
        'Employment';
      let persistedIntakeId = intakeId;
      if (intakeId) {
        const savedAnswers = markGuidedIntakeFlowCompleted(
          intakeId,
          { ...answers, caseCategory: category },
          { persistStory: false }
        );
        await saveWorkerStoryToIntakeMetadata(intakeId, savedAnswers.context);
      } else {
        const pending: PendingWorkerOnboarding = {
          ...(getPendingOnboarding() ?? {}),
          caseCategory: category,
          guidedAnswers: { ...answers, caseCategory: category },
          guidedFlowCompleted: true,
        };
        syncPendingOnboarding(pending);
        if (
          isSupabaseConfigured() &&
          isAuthenticated &&
          authUser?.id &&
          profile?.role === 'worker' &&
          profile?.id
        ) {
          const committed = await commitPendingWorkerIntake();
          if (!committed) return;
          persistedIntakeId = committed;
          await saveWorkerStoryToIntakeMetadata(committed, answers.context);
        }
      }
      clearWorkerIntakeUiState();
      console.info('[o3s-intake] completeGuidedIntakeFlow → upload', {
        activeIntakeId: persistedIntakeId,
        pendingOnly: !persistedIntakeId,
      });
      setCurrentScreen('upload');
    },
    [
      markGuidedIntakeFlowCompleted,
      clearWorkerIntakeUiState,
      categoryFromGuidedAnswers,
      getPendingOnboarding,
      syncPendingOnboarding,
      selectedCaseCategory,
      isAuthenticated,
      authUser?.id,
      profile?.id,
      profile?.role,
      commitPendingWorkerIntake,
      saveWorkerStoryToIntakeMetadata,
    ]
  );

  const skipGuidedIntakeFlow = useCallback(() => {
    const intakeId = currentIntakeIdRef.current;
    const category =
      (intakeId ? categoryFromGuidedAnswers(intakeId) : null) ??
      getPendingOnboarding()?.caseCategory ??
      selectedCaseCategory ??
      'Employment';
    const skippedPayload: GuidedIntakeAnswers = {
      topics: [],
      context: '',
      availableRecords: [],
      caseCategory: category,
      skipped: true,
    };
    if (intakeId) {
      markGuidedIntakeFlowCompleted(intakeId, skippedPayload);
    } else {
      syncPendingOnboarding({
        ...(getPendingOnboarding() ?? {}),
        caseCategory: category,
        guidedAnswers: skippedPayload,
        guidedFlowCompleted: true,
      });
    }
    clearWorkerIntakeUiState();
    console.info('[o3s-intake] skipGuidedIntakeFlow → upload', {
      activeIntakeId: intakeId,
      pendingOnly: !intakeId,
    });
    setCurrentScreen('upload');
  }, [
    markGuidedIntakeFlowCompleted,
    clearWorkerIntakeUiState,
    categoryFromGuidedAnswers,
    getPendingOnboarding,
    syncPendingOnboarding,
    selectedCaseCategory,
  ]);

  const resolveEmploymentMatterTags = useCallback(
    (intakeId: string | null): EmploymentMatterTagId[] => {
      if (!intakeId) {
        const pending = getPendingOnboarding();
        return (
          pending?.employmentMatterTags ??
          pending?.guidedAnswers?.employmentMatterTags ??
          []
        );
      }
      const fromRef = employmentMatterByIntakeIdRef.current[intakeId];
      if (fromRef?.length) return fromRef;
      const fromMetadata = workerMetadataByIntakeIdRef.current[intakeId]?.employmentMatterTags;
      if (fromMetadata?.length) return fromMetadata;
      const fromCard = workerIntakeRoutingCards.find((c) => c.intakeId === intakeId)?.employmentMatterTags;
      if (fromCard?.length) return fromCard;
      const fromSession = loadGuidedIntakeFromSession(intakeId)?.employmentMatterTags;
      if (fromSession?.length) return fromSession;
      const fromLocal = loadEmploymentMatterTagsLocal(intakeId);
      if (fromLocal?.length) return fromLocal;
      if (currentIntakeId === intakeId && workerLiveSummary?.overview) {
        const fromOverview = extractEmploymentMatterTagsFromOverview(workerLiveSummary.overview);
        if (fromOverview.length) return fromOverview;
      }
      return [];
    },
    [getPendingOnboarding, workerIntakeRoutingCards, currentIntakeId, workerLiveSummary?.overview, workerIntakeMetadataTick]
  );

  const resolveUploadConsentChecked = useCallback(
    (intakeId: string | null): boolean => {
      if (!intakeId) return false;
      return Boolean(workerMetadataByIntakeIdRef.current[intakeId]?.uploadConsentAt);
    },
    [workerIntakeMetadataTick]
  );

  const resolveDocumentResponseDraft = useCallback(
    (intakeId: string | null): WorkerDocumentResponseDraft | null => {
      if (!intakeId) return null;
      return workerMetadataByIntakeIdRef.current[intakeId]?.documentResponseDraft ?? null;
    },
    [workerIntakeMetadataTick]
  );

  const handleEmploymentMatterContinue = useCallback(
    (tags: EmploymentMatterTagId[]) => {
      const intakeId = currentIntakeIdRef.current;
      const category = BETA_WORKER_CASE_CATEGORY;
      if (intakeId) {
        caseCategoryByIntakeIdRef.current[intakeId] = category;
        saveCaseCategoryLocal(intakeId, category);
        employmentMatterByIntakeIdRef.current[intakeId] = tags;
        saveEmploymentMatterTagsLocal(intakeId, tags);
        void patchWorkerIntakeMetadata(intakeId, { employmentMatterTags: tags });
        void mergeEmploymentMatterIntoLatestIntakeSummary(intakeId, tags);
      } else {
        const priorGuided = getPendingOnboarding()?.guidedAnswers;
        syncPendingOnboarding({
          ...(getPendingOnboarding() ?? {}),
          caseCategory: category,
          employmentMatterTags: tags,
          guidedAnswers: {
            topics: priorGuided?.topics ?? [],
            context: priorGuided?.context ?? '',
            availableRecords: priorGuided?.availableRecords ?? [],
            caseCategory: category,
            employmentMatterTags: tags,
            scaffoldResponses: priorGuided?.scaffoldResponses,
            skipped: priorGuided?.skipped,
          },
        });
      }
      setSelectedCaseCategory('Employment');
      setCurrentScreen('guidedIntake');
    },
    [getPendingOnboarding, syncPendingOnboarding]
  );

  const handleEmploymentMatterDraftChange = useCallback(
    async (tags: EmploymentMatterTagId[]) => {
      const intakeId = currentIntakeIdRef.current;
      if (intakeId) {
        employmentMatterByIntakeIdRef.current[intakeId] = tags;
        saveEmploymentMatterTagsLocal(intakeId, tags);
        if (isSupabaseConfigured()) {
          const patch = await patchWorkerIntakeMetadata(intakeId, { employmentMatterTags: tags });
          if (patch.error) {
            console.warn('[o3s-metadata] employment matter save failed', patch.error);
            throw new Error(patch.error);
          }
          if (patch.metadata) workerMetadataByIntakeIdRef.current[intakeId] = patch.metadata;
          setWorkerIntakeMetadataTick((t) => t + 1);
          if (tags.length) {
            const matterErr = await mergeEmploymentMatterIntoLatestIntakeSummary(intakeId, tags);
            if (matterErr.error) console.warn('[o3s-matter] summary merge failed', matterErr.error);
          }
        }
        return;
      }
      syncPendingOnboardingDraft({
        ...(getPendingOnboarding() ?? {}),
        caseCategory: BETA_WORKER_CASE_CATEGORY,
        employmentMatterTags: tags,
      });
    },
    [getPendingOnboarding, syncPendingOnboardingDraft]
  );

  const handleUploadConsentPersist = useCallback(
    async (checked: boolean) => {
      const intakeId = currentIntakeIdRef.current;
      if (!intakeId || !isSupabaseConfigured()) {
        throw new Error('No active intake to save upload consent.');
      }
      const patch = await patchWorkerIntakeMetadata(intakeId, {
        uploadConsentAt: checked ? new Date().toISOString() : null,
      });
      if (patch.error) throw new Error(patch.error);
      if (patch.metadata) workerMetadataByIntakeIdRef.current[intakeId] = patch.metadata;
      setWorkerIntakeMetadataTick((t) => t + 1);
    },
    []
  );

  const handleDocumentResponseDraftChange = useCallback(
    async (draft: WorkerDocumentResponseDraft) => {
      const intakeId = currentIntakeIdRef.current;
      if (!intakeId || !isSupabaseConfigured()) {
        throw new Error('No active intake to save your selections.');
      }
      const patch = await patchWorkerIntakeMetadata(intakeId, {
        documentResponseDraft: {
          ...draft,
          updatedAt: new Date().toISOString(),
        },
      });
      if (patch.error) throw new Error(patch.error);
      if (patch.metadata) workerMetadataByIntakeIdRef.current[intakeId] = patch.metadata;
      setWorkerIntakeMetadataTick((t) => t + 1);
    },
    []
  );

  const handleStoryFollowUpChange = useCallback(
    (answers: StoryFollowUpAnswers) => {
      const intakeId = currentIntakeIdRef.current;
      const hasIncomingContent = hasStoryFollowUpContent(answers);
      if (intakeId) {
        const existing = workerMetadataByIntakeIdRef.current[intakeId]?.storyFollowUp;
        if (!hasIncomingContent && hasStoryFollowUpContent(existing)) return;
        workerMetadataByIntakeIdRef.current[intakeId] = {
          ...(workerMetadataByIntakeIdRef.current[intakeId] ?? {}),
          storyFollowUp: answers,
        };
        if (isSupabaseConfigured()) {
          void (async () => {
            const patch = await patchWorkerIntakeMetadata(intakeId, { storyFollowUp: answers });
            if (patch.error) {
              console.warn('[o3s-metadata] story follow-up save failed', { intakeId, error: patch.error });
              return;
            }
            if (patch.metadata) {
              workerMetadataByIntakeIdRef.current[intakeId] = patch.metadata;
            }
            // Also merge into intake_summaries so firm-side view stays in sync
            // (no-op if no summary row exists yet — safe to always call)
            if (hasStoryFollowUpContent(answers)) {
              const mergeErr = await mergeStoryFollowUpIntoLatestIntakeSummary(intakeId, answers);
              if (mergeErr.error) console.warn('[o3s-story-follow-up] post-edit merge failed', mergeErr.error);
            }
          })();
        }
        return;
      }

      const pending = getPendingOnboarding();
      if (!hasIncomingContent && hasStoryFollowUpContent(pending?.storyFollowUp)) return;
      syncPendingOnboardingDraft({
        ...(pending ?? {}),
        storyFollowUp: answers,
      });
    },
    [getPendingOnboarding, syncPendingOnboardingDraft]
  );

  const completeNonEmploymentQuestionnaire = useCallback(
    (answers: CategoryQuestionnaireAnswers) => {
      const intakeId = currentIntakeIdRef.current;
      const category =
        (intakeId ? caseCategoryByIntakeIdRef.current[intakeId] : null) ??
        getPendingOnboarding()?.caseCategory ??
        selectedCaseCategory ??
        'Employment';
      if (intakeId) {
        nonEmploymentAnswersByIntakeIdRef.current[intakeId] = answers;
      }
      const contextSummary = answers
        .filter((row) => row.answer.trim().length > 0)
        .slice(0, 6)
        .map((row) => `${row.question}: ${row.answer.trim()}`)
        .join('\n');
      const guidedPayload: GuidedIntakeAnswers = {
        caseCategory: category,
        topics: [category],
        availableRecords: [],
        context: contextSummary,
        scaffoldResponses: answers,
        skipped: false,
      };
      if (intakeId) {
        markGuidedIntakeFlowCompleted(intakeId, guidedPayload);
      } else {
        syncPendingOnboarding({
          ...(getPendingOnboarding() ?? {}),
          caseCategory: category,
          questionnaireAnswers: answers,
          guidedAnswers: guidedPayload,
          guidedFlowCompleted: true,
        });
      }
      clearWorkerIntakeUiState();
      setCurrentScreen('upload');
    },
    [
      selectedCaseCategory,
      markGuidedIntakeFlowCompleted,
      clearWorkerIntakeUiState,
      getPendingOnboarding,
      syncPendingOnboarding,
    ]
  );

  const handleGuidedOnboardingDraftChange = useCallback(
    (answers: GuidedIntakeAnswers) => {
      const intakeId = currentIntakeIdRef.current;
      const category =
        (intakeId ? categoryFromGuidedAnswers(intakeId) : null) ??
        getPendingOnboarding()?.caseCategory ??
        selectedCaseCategory ??
        'Employment';
      const matterTags = resolveEmploymentMatterTags(intakeId);
      const next: GuidedIntakeAnswers = {
        ...answers,
        context:
          !answers.context.trim() && intakeId
            ? (
                guidedIntakeByIntakeIdRef.current[intakeId]?.context ??
                loadGuidedIntakeFromSession(intakeId)?.context ??
                intakeData.extractWorkerStoryFromOverview(workerLiveSummary?.overview) ??
                workerMetadataByIntakeIdRef.current[intakeId]?.workerStory ??
                ''
              )
            : answers.context,
        caseCategory: isBetaEmploymentCategory(category) ? BETA_WORKER_CASE_CATEGORY : category,
        employmentMatterTags: matterTags.length ? matterTags : answers.employmentMatterTags,
      };
      if (intakeId) {
        guidedIntakeByIntakeIdRef.current[intakeId] = next;
        saveGuidedIntakeToSession(intakeId, next);
        return;
      }
      syncPendingOnboardingDraft({
        ...(getPendingOnboarding() ?? {}),
        caseCategory: isBetaEmploymentCategory(category) ? BETA_WORKER_CASE_CATEGORY : category,
        employmentMatterTags: matterTags,
        guidedAnswers: next,
      });
    },
    [
      selectedCaseCategory,
      categoryFromGuidedAnswers,
      getPendingOnboarding,
      syncPendingOnboardingDraft,
      resolveEmploymentMatterTags,
      workerLiveSummary?.overview,
    ]
  );

  const handleCategoryQuestionnaireDraftChange = useCallback(
    (answers: CategoryQuestionnaireAnswers) => {
      const intakeId = currentIntakeIdRef.current;
      if (intakeId) {
        nonEmploymentAnswersByIntakeIdRef.current[intakeId] = answers;
        return;
      }
      syncPendingOnboardingDraft({
        ...(getPendingOnboarding() ?? {}),
        caseCategory: selectedCaseCategory,
        questionnaireAnswers: answers,
      });
    },
    [selectedCaseCategory, getPendingOnboarding, syncPendingOnboardingDraft]
  );

  // Firm-directed intake — routes directly to the intake form, no login required upfront.
  const startFirmDirectedGuestIntake = () => {
    setCurrentScreen('firmDirectedIntake');
  };

  const beginWorkerIntake = async () => {
    if (!isSupabaseConfigured()) return;
    if (resumePendingWorkerOnboarding()) return;

    let intakeId = currentIntakeIdRef.current;
    if (!intakeId && workerIntakesList.length > 0) {
      const anchor = resolveWorkerLandingIntakeRow(null, workerIntakesList);
      if (anchor) {
        intakeId = anchor.id;
        currentIntakeIdRef.current = intakeId;
        setCurrentIntakeId(intakeId);
        setCurrentIntakeNumber(anchor.intake_number);
      }
    }
    if (!intakeId && workerIntakesList.length === 0) {
      pendingOnboardingRef.current = null;
      clearPendingOnboardingSession();
      workerOnboardingPrePersistRef.current = true;
      skipAnchorIntakeSyncRef.current = true;
      setWorkerOnboardingPrePersist(true);
      currentIntakeIdRef.current = null;
      setCurrentIntakeId(null);
      setCurrentIntakeNumber(null);
      setSelectedCaseCategory('Employment');
      startBetaEmploymentGuidedIntake(null);
      return;
    }
    if (!intakeId) {
      window.alert('Select an intake from your dashboard, or start a new intake.');
      return;
    }

    const row = workerIntakesList.find((r) => r.id === intakeId);
    if (row) setCurrentIntakeNumber(row.intake_number);
    if (await shouldShowGuidedIntake(intakeId)) {
      const existing = categoryFromGuidedAnswers(intakeId) ?? BETA_WORKER_CASE_CATEGORY;
      setSelectedCaseCategory(
        isBetaEmploymentCategory(existing) ? 'Employment' : (existing as IntakeCaseCategory)
      );
      if (isLegacyNonEmploymentCaseCategory(existing)) {
        setCurrentScreen('categoryQuestionnaire');
      } else {
        setCurrentScreen('guidedIntake');
      }
      return;
    }
    setCurrentScreen('upload');
  };

  const openWorkerIntakeWorkspaceForIntake = async (intakeId: string) => {
    await selectWorkerIntake(intakeId);
    await beginWorkerIntake();
  };

  /** Start local-only onboarding; Supabase draft is created on organize, save draft, or first upload persist. */
  const createNewWorkerIntake = async () => {
    if (!isSupabaseConfigured()) return;
    if (!isAuthenticated || !authUser?.id || profile?.role !== 'worker' || !profile?.id) {
      window.alert(
        'Unable to create intake: your profile is still loading. Please wait and try again.'
      );
      return;
    }
    setCreateNewIntakeBusy(true);
    skipAnchorIntakeSyncRef.current = true;
    workerOnboardingPrePersistRef.current = true;
    currentIntakeIdRef.current = null;
    setCurrentScreen('guidedIntake');
    try {
      pendingOnboardingRef.current = null;
      clearPendingOnboardingSession();
      setWorkerOnboardingPrePersist(true);
      clearWorkerIntakeUiState();
      setHasCompletedIntake(false);
      setCurrentIntakeId(null);
      setCurrentIntakeNumber(null);
      setWorkerIntakeWorkflow(null);
      setWorkerIntakeChannel(null);
      setParticipatingPreviewSent(false);
      setFirmCodeShareCompleted(false);
      setWorkerLinkedFirmName(null);
      setWorkerLinkedFirmCode(null);
      setWorkerLinkedRouteStatus(null);
      setWorkerLinkedRouteSharedAt(null);
      setSelectedCaseCategory('Employment');
      console.info('[o3s-intake] createNewWorkerIntake (local onboarding only, no DB write)');
      startBetaEmploymentGuidedIntake(null);
    } finally {
      setCreateNewIntakeBusy(false);
    }
  };

  const goToUploadScreen = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    if (profile?.role !== 'worker' || !isAuthenticated) {
      setCurrentScreen('upload');
      return;
    }
    if (currentIntakeIdRef.current) {
      setCurrentScreen('upload');
      return;
    }
    if (getPendingOnboarding()?.guidedFlowCompleted) {
      setCurrentScreen('upload');
      return;
    }
    console.warn(
      '[one3Seven] Upload requested without active intake or completed pending onboarding; returning to home.'
    );
    setCurrentScreen('landing');
  }, [isAuthenticated, profile?.role, getPendingOnboarding]);

  const handleSaveWorkerIntakeDraft = useCallback(async (): Promise<boolean> => {
    const id = await commitPendingWorkerIntake();
    if (!id) return false;
    setCurrentScreen('landing');
    return true;
  }, [commitPendingWorkerIntake]);

  const handlePersistentNotificationClickRef = useRef<
    (row: PersistentNotificationRow) => Promise<void>
  >(async () => {});

  const markPersistentBellItemRead = useCallback((notificationId: string) => {
    const mark = (items: AppNotificationItem[]) =>
      items.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
    setPersistentWorkerBell((prev) => mark(prev));
    setPersistentFirmBell((prev) => mark(prev));
  }, []);

  const markSessionBellItemRead = useCallback((notificationId: string) => {
    const mark = (items: AppNotificationItem[]) =>
      items.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
    setWorkerNotifications((prev) => mark(prev));
    setFirmNotifications((prev) => mark(prev));
  }, []);

  const enrichSessionBellItem = useCallback(
    (n: AppNotificationItem): AppNotificationItem => {
      if (n.isRead === true) return n;
      // Preserve existing onItemClick (e.g. persistent notifications already have navigation wired up)
      if (n.onItemClick) return { ...n, isRead: false };
      return {
        ...n,
        isRead: false,
        onItemClick: async () => {
          markSessionBellItemRead(n.id);
          if (n.id.startsWith('route-')) {
            const intakeId = currentIntakeIdRef.current;
            if (intakeId) {
              setCurrentScreen('summary');
            } else {
              setCurrentScreen('landing');
            }
          }
        },
      };
    },
    [markSessionBellItemRead]
  );

  const handlePersistentNotificationClick = useCallback(
    async (row: PersistentNotificationRow) => {
      const markResult = await intakeData.markNotificationRead(row.id);
      if (markResult.error) {
        console.error('[o3s-notifications] mark read failed', markResult.error);
        return;
      }
      markPersistentBellItemRead(row.id);

      if (row.notification_type === 'worker_full_access_request' && (profile?.role === 'worker' || userRole === 'worker')) {
        if (row.related_intake_id) {
          setCurrentIntakeId(row.related_intake_id);
          currentIntakeIdRef.current = row.related_intake_id;
          const listRow = workerIntakesList.find((r) => r.id === row.related_intake_id);
          if (listRow) setCurrentIntakeNumber(listRow.intake_number);
        }
        await refreshWorkerAccessRows();
        setAccessApprovalScrollSignal((n) => n + 1);
        setCurrentScreen('summary');
        return;
      }

      if (row.notification_type === 'firm_document_request' && (profile?.role === 'worker' || userRole === 'worker')) {
        const payload = row.payload ?? {};
        setWorkerDocumentRequestPayload({
          requested_categories: parseNotificationCategories(payload),
          firm_note: String(payload.firm_note ?? ''),
          firm_name: String(payload.firm_name ?? ''),
        });
        if (row.related_intake_id) {
          setCurrentIntakeId(row.related_intake_id);
          currentIntakeIdRef.current = row.related_intake_id;
          const listRow = workerIntakesList.find((r) => r.id === row.related_intake_id);
          if (listRow) setCurrentIntakeNumber(listRow.intake_number);
        }
        await goToUploadScreen();
        return;
      }

      if (
        (row.notification_type === 'worker_documents_submitted' ||
          row.notification_type === 'firm_full_access_granted') &&
        (profile?.role === 'firm' || userRole === 'firm') &&
        row.related_intake_id
      ) {
        const intakeId = row.related_intake_id;
        let dashRows = firmDashboardRows;
        let meta =
          (row.related_route_id
            ? dashRows.find((r) => r.routeId === row.related_route_id)
            : undefined) ?? dashRows.find((r) => r.intakeId === intakeId);
        if (!meta && firmProfile) {
          dashRows = await refreshFirmDashboardRows(firmProfile);
          meta =
            (row.related_route_id
              ? dashRows.find((r) => r.routeId === row.related_route_id)
              : undefined) ?? dashRows.find((r) => r.intakeId === intakeId);
        }
        setSelectedIntakeId(intakeId);
        if (meta) {
          const routeStatus =
            row.notification_type === 'firm_full_access_granted' ? 'full_access' : meta.routeStatus;
          setSelectedRouteMeta({
            routeId: meta.routeId,
            routeStatus,
            intakeNumber: meta.intakeNumber,
          });
          setFirmLiveViewLoading(true);
          setFirmLiveView(null);
          try {
            const v = await intakeData.loadFirmLiveIntakeView(
              intakeId,
              meta.routeId,
              routeStatus,
              meta.intakeNumber
            );
            setFirmLiveView(v);
          } finally {
            setFirmLiveViewLoading(false);
          }
        } else {
          setSelectedRouteMeta(null);
          setFirmLiveView(null);
        }
        setCurrentScreen('intakeReview');
      }
    },
    [
      profile?.role,
      userRole,
      workerIntakesList,
      firmDashboardRows,
      firmProfile,
      goToUploadScreen,
      markPersistentBellItemRead,
    ]
  );

  handlePersistentNotificationClickRef.current = handlePersistentNotificationClick;

  const refreshPersistentNotifications = useCallback(async () => {
    if (!isSupabaseConfigured() || !isAuthenticated || !authUser?.id) {
      setPersistentNotificationsOk(false);
      setPersistentNotificationsLoadFailed(false);
      setPersistentWorkerBell([]);
      setPersistentFirmBell([]);
      setWorkerActionNeededIntakeIds([]);
      return;
    }
    const { rows, error } = await intakeData.listNotificationsForUser();
    if (error) {
      console.error('[o3s-notifications] persistent fetch failed', error);
      setPersistentNotificationsOk(false);
      setPersistentNotificationsLoadFailed(true);
      setPersistentWorkerBell([]);
      setPersistentFirmBell([]);
      setWorkerActionNeededIntakeIds([]);
      setWorkerNotifications((prev) => prev.filter((n) => isSafeSessionNotification(n)));
      return;
    }
    setPersistentNotificationsLoadFailed(false);
    setPersistentNotificationsOk(true);
    const workerItems: AppNotificationItem[] = [];
    const firmItems: AppNotificationItem[] = [];
    const actionNeededIds = new Set<string>();
    for (const row of rows) {
      if (
        row.recipient_kind === 'worker' &&
        !row.read_at &&
        row.related_intake_id &&
        (row.notification_type === 'firm_document_request' ||
          row.notification_type === 'worker_full_access_request')
      ) {
        actionNeededIds.add(row.related_intake_id);
      }
      const item: AppNotificationItem = {
        id: row.id,
        title: row.title,
        body: row.body ?? undefined,
        createdAt: formatBellNotificationTime(row.created_at),
        isRead: Boolean(row.read_at),
        onItemClick: () => void handlePersistentNotificationClickRef.current(row),
      };
      if (row.recipient_kind === 'worker') workerItems.push(item);
      else if (row.recipient_kind === 'firm') firmItems.push(item);
    }
    setPersistentWorkerBell(workerItems);
    setPersistentFirmBell(firmItems);
    setWorkerActionNeededIntakeIds([...actionNeededIds]);
    setWorkerNotifications((prev) => prev.filter((n) => !isSessionDocumentRequestNotification(n)));
  }, [isAuthenticated, authUser?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !isAuthenticated || !authUser?.id) return;
    void refreshPersistentNotifications();
  }, [isAuthenticated, authUser?.id, profile?.role, userRole, refreshPersistentNotifications]);

  const navigateToScreen = (screen: Screen) => {
    if (OFFLINE_DEV_GALLERY_ONLY && !isDevOnlyScreenWithoutSupabase(screen)) {
      setCurrentScreen('devNavMap');
      return;
    }
    if (!isSupabaseConfigured() && screen !== 'authWelcome') {
      setCurrentScreen('authWelcome');
      return;
    }
    if (screen === 'upload') {
      void goToUploadScreen();
      return;
    }
    const isFirmUser = userRole === 'firm' || profile?.role === 'firm';
    if (isFirmUser && screen === 'firmDashboard' && intakeData.firmProfileNeedsSetup(firmProfile)) {
      setCurrentScreen('firmSettings');
      return;
    }
    setCurrentScreen(screen);
  };

  useEffect(() => {
    if (OFFLINE_DEV_GALLERY_ONLY && !isDevOnlyScreenWithoutSupabase(currentScreen)) {
      setCurrentScreen('devNavMap');
    }
  }, [currentScreen]);

  useEffect(() => {
    if (currentScreen !== 'upload') setWorkerUploadFirmIntent('default');
  }, [currentScreen]);

  useEffect(() => {
    const isFirmUser = userRole === 'firm' || profile?.role === 'firm';
    if (!isFirmUser || !intakeData.firmProfileNeedsSetup(firmProfile)) return;
    if (currentScreen === 'firmDashboard' || currentScreen === 'intakeReview') {
      setCurrentScreen('firmSettings');
    }
  }, [userRole, profile?.role, firmProfile, currentScreen]);

  const refreshWorkerIntakesList = async (userId?: string): Promise<WorkerIntakeListEntry[]> => {
    const id = userId ?? profile?.id;
    if (!id || !isSupabaseConfigured()) return [];
    setWorkerIntakesLoading(true);
    try {
      const rows = await intakeData.listWorkerIntakes(id);
      setWorkerIntakesList(rows);
      const cards = await intakeData.listWorkerIntakeFirmRoutingCards(id);
      setWorkerIntakeRoutingCards(cards);
      return rows;
    } finally {
      setWorkerIntakesLoading(false);
    }
  };

  const handleRemoveFirmCodeForIntake = async (intakeId: string) => {
    if (!isSupabaseConfigured()) return { error: 'Firm code routing requires a connected workspace.' };
    setFirmCodeActionBusy(true);
    setFirmCodeActionError(null);
    const result = await intakeData.removeFirmCodeFromIntake(intakeId);
    if (result.error) {
      setFirmCodeActionBusy(false);
      setFirmCodeActionError(result.error);
      return result;
    }
    if (profile?.id) await refreshWorkerIntakesList(profile.id);
    await refreshWorkerRoutingFromIntake(intakeId);
    setFirmCodeActionBusy(false);
    return {};
  };

  const handleDeleteWorkerIntake = async (intakeId: string) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Delete intake requires a connected workspace.' };
    }
    setDeleteIntakeBusyId(intakeId);
    setDeleteIntakeError(null);
    setDeleteIntakeErrorIntakeId(null);
    const result = await intakeData.deleteWorkerOwnedIntake(intakeId);
    if (result.error) {
      setDeleteIntakeBusyId(null);
      setDeleteIntakeError(result.error);
      setDeleteIntakeErrorIntakeId(intakeId);
      return result;
    }

    const wasActive = currentIntakeIdRef.current === intakeId;
    delete guidedIntakeByIntakeIdRef.current[intakeId];
    delete guidedIntakeCompletedByIntakeRef.current[intakeId];
    delete caseCategoryByIntakeIdRef.current[intakeId];
    delete employmentMatterByIntakeIdRef.current[intakeId];
    delete nonEmploymentAnswersByIntakeIdRef.current[intakeId];

    const remaining =
      profile?.id != null ? await refreshWorkerIntakesList(profile.id) : [];

    if (wasActive) {
      const next = resolveWorkerLandingIntakeRow(null, remaining);
      if (next) {
        setCurrentIntakeId(next.id);
        currentIntakeIdRef.current = next.id;
        setCurrentIntakeNumber(next.intake_number);
        clearWorkerIntakeUiState();
        void refreshWorkerRoutingFromIntake(next.id);
      } else {
        setCurrentIntakeId(null);
        currentIntakeIdRef.current = null;
        setCurrentIntakeNumber(null);
        clearWorkerIntakeUiState();
        setHasCompletedIntake(false);
        setWorkerIntakeWorkflow(null);
        setWorkerIntakeChannel(null);
        setWorkerLinkedFirmName(null);
        setWorkerLinkedFirmCode(null);
        setWorkerLinkedRouteStatus(null);
        setWorkerLinkedRouteSharedAt(null);
        setParticipatingPreviewSent(false);
        setFirmCodeShareCompleted(false);
      }
      if (currentScreen !== 'landing') {
        setCurrentScreen('landing');
      }
    }

    setDeleteIntakeBusyId(null);
    return {};
  };

  const requestAddFirmCodeForIntake = (intakeId: string) => {
    setFirmCodeActionError(null);
    setCurrentIntakeId(intakeId);
    currentIntakeIdRef.current = intakeId;
    const card = workerIntakeRoutingCards.find((c) => c.intakeId === intakeId);
    if (card) setCurrentIntakeNumber(card.intakeNumber);
    else {
      const row = workerIntakesList.find((r) => r.id === intakeId);
      if (row) setCurrentIntakeNumber(row.intake_number);
    }
    setFirmCodeModalSignal((n) => n + 1);
    setCurrentScreen('summary');
  };

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) return;
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) window.alert(error.message);
  };

  /** Link firm on intake row only (upload gate / modal). Does not submit or create firm route. */
  const linkFirmCodeForActiveIntake = async (firmId: string) => {
    const pending = getPendingOnboarding();
    if (!currentIntakeIdRef.current && isPendingOnboardingReadyToPersist(pending)) {
      const committed = await commitPendingWorkerIntake();
      if (!committed) return { error: 'Could not save intake before linking firm code.' };
    }
    const intakeId = currentIntakeIdRef.current;
    if (!intakeId) return { error: 'No active intake.' };
    const link = await intakeData.linkFirmCodeToIntake(intakeId, firmId);
    if (link.error) {
      return { error: toBetaUserMessage(link.error, 'Could not link this firm code. Try again.') };
    }
    setWorkerIntakeChannel('firm_code');
    const display = await intakeData.fetchWorkerIntakeRoutingDisplay(intakeId);
    await refreshWorkerRoutingFromIntake(intakeId, display.linkedFirmName);
    if (profile?.id) await refreshWorkerIntakesList(profile.id);
    return {};
  };

  /** Pre-organization firm code: link intake row only (no preview route / no organize). */
  const prelinkFirmCodeForActiveIntake = async (
    code: string
  ): Promise<{ error?: string; firmName?: string }> => {
    const pending = getPendingOnboarding();
    if (!currentIntakeIdRef.current && isPendingOnboardingReadyToPersist(pending)) {
      const committed = await commitPendingWorkerIntake();
      if (!committed) return { error: 'Could not save intake before linking firm code.' };
    }
    const intakeId = currentIntakeIdRef.current;
    if (!intakeId) return { error: 'No active intake.' };
    const firm = await intakeData.fetchFirmByCodeForWorker(code);
    if (!firm) return { error: 'Firm code not found. Check the code and try again.' };
    const link = await intakeData.linkFirmCodeToIntake(intakeId, firm.id);
    if (link.error) {
      return { error: toBetaUserMessage(link.error, 'Could not link this firm code. Try again.') };
    }
    setWorkerIntakeChannel('firm_code');
    await refreshWorkerRoutingFromIntake(intakeId, firm.firm_name);
    setWorkerLinkedFirmCode(firm.firm_code ?? code.trim().toUpperCase());
    if (profile?.id) await refreshWorkerIntakesList(profile.id);
    return { firmName: firm.firm_name, firmCode: firm.firm_code };
  };

  // Auto-apply a firm code stored from a /?fc=FIRMCODE intake link.
  // Fires once when: worker role confirmed + active intake exists + no firm linked yet.
  useEffect(() => {
    if (profile?.role !== 'worker') return;
    if (!currentIntakeId) return;
    if (workerLinkedFirmCode?.trim()) return; // already linked
    let code: string | null = null;
    try { code = sessionStorage.getItem('o3s_prefill_fc'); } catch { /* ignore */ }
    if (!code?.trim()) return;
    const trimmed = code.trim().toUpperCase();
    void (async () => {
      const result = await prelinkFirmCodeForActiveIntake(trimmed);
      if (!result.error) {
        try {
          sessionStorage.removeItem('o3s_prefill_fc');
          sessionStorage.removeItem('o3s_firm_ctx'); // intake is linked — context no longer needed
        } catch { /* ignore */ }
        setFirmDirectedContext(null);
        pushWorkerNotification({
          id: `prefill-fc-${Date.now()}`,
          title: 'Firm connected via intake link',
          body: result.firmName
            ? `Your intake is linked to ${result.firmName}. Share it from your dashboard when ready.`
            : 'Your intake has been linked to the firm. Share it from your dashboard when ready.',
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, currentIntakeId, workerLinkedFirmCode]);

  // Firm-directed entry — resolve ?fc= firm code into context on mount (once).
  // If o3s_firm_ctx is already in sessionStorage (restored above in useState init),
  // skip the async lookup — context is already set. Otherwise resolve from o3s_prefill_fc.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    // Already restored synchronously from sessionStorage — nothing to do.
    let existing: unknown = null;
    try { existing = sessionStorage.getItem('o3s_firm_ctx'); } catch { /* ignore */ }
    if (existing) return;

    let code: string | null = null;
    try { code = sessionStorage.getItem('o3s_prefill_fc'); } catch { /* ignore */ }
    if (!code?.trim()) return;
    const trimmed = code.trim().toUpperCase();
    void (async () => {
      const firm = await intakeData.fetchFirmByCodeForWorker(trimmed);
      if (firm?.id && firm.firm_name) {
        setFirmDirectedContext({
          firmId: firm.id,
          firmName: firm.firm_name,
          firmCode: firm.firm_code ?? trimmed,
        });
      }
    })();
  // Intentionally runs once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?fc= links are for workers only. If a firm user lands on one, clear everything
  // so their normal firm routing is unaffected.
  useEffect(() => {
    if (profile?.role !== 'firm') return;
    try {
      sessionStorage.removeItem('o3s_prefill_fc');
      sessionStorage.removeItem('o3s_firm_ctx');
    } catch { /* ignore */ }
    if (firmDirectedContext) setFirmDirectedContext(null);
  }, [profile?.role, firmDirectedContext]);

  // Auto-start intake after anonymous sign-in settles on the landing screen.
  useEffect(() => {
    if (!pendingAutoStartIntakeRef.current) return;
    if (!isAuthenticated || profile?.role !== 'worker' || currentScreen !== 'landing') return;
    pendingAutoStartIntakeRef.current = false;
    void beginWorkerIntake();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profile?.role, currentScreen]);

  // Stripe billing return — surface notification when firm returns from checkout or portal
  useEffect(() => {
    if (profile?.role !== 'firm') return;
    let result: string | null = null;
    try { result = sessionStorage.getItem('o3s_billing_return'); } catch { /* ignore */ }
    if (!result) return;
    try { sessionStorage.removeItem('o3s_billing_return'); } catch { /* ignore */ }
    if (result === 'success') {
      setPersistentFirmBell((prev) => [
        {
          id: `billing-success-${Date.now()}`,
          title: 'Subscription started',
          body: 'Your 30-day free trial is active. You can manage billing anytime from Settings.',
          read: false,
        },
        ...prev,
      ]);
    } else if (result === 'canceled') {
      setPersistentFirmBell((prev) => [
        {
          id: `billing-canceled-${Date.now()}`,
          title: 'Checkout canceled',
          body: 'No charges were made. You can upgrade anytime from Settings.',
          read: false,
        },
        ...prev,
      ]);
    }
  }, [profile?.role]);

  const persistNewFiles = async (files: File[]) => {
    const configured = isSupabaseConfigured();
    const hasAuthId = Boolean(authUser?.id);
    let intakeId = currentIntakeId;
    const pending = getPendingOnboarding();
    if (
      !intakeId &&
      configured &&
      profile?.role === 'worker' &&
      isPendingOnboardingReadyToPersist(pending)
    ) {
      const committed = await commitPendingWorkerIntake();
      if (!committed) return;
      intakeId = committed;
    }
    const role = profile?.role ?? null;

    console.info('[o3s-upload] persistNewFiles start', {
      fileCount: files.length,
      authUserIdPresent: hasAuthId,
      profileRole: role,
      currentIntakeId: intakeId,
      isSupabaseConfigured: configured,
    });

    if (!configured) {
      console.warn('[o3s-upload] persistNewFiles skipped: isSupabaseConfigured is false');
      window.alert('Uploads cannot persist: Supabase is not configured (missing env).');
      return;
    }
    if (!hasAuthId) {
      console.warn('[o3s-upload] persistNewFiles skipped: authUser id missing');
      window.alert('Uploads cannot persist: you are not signed in.');
      return;
    }
    if (!intakeId) {
      console.warn('[o3s-upload] persistNewFiles skipped: currentIntakeId missing');
      window.alert('Uploads cannot persist: no active intake. Try leaving upload and starting again.');
      return;
    }

    pendingPersistMetaAppendCountRef.current = files.length;
    let failedCount = 0;
    let duplicateCount = 0;
    try {
      for (const f of files) {
        console.info('[o3s-upload] uploadIntakeFile (before)', { fileName: f.name, size: f.size });
        const r = await intakeData.uploadIntakeFile(authUser.id, intakeId, f);
        console.info('[o3s-upload] uploadIntakeFile (after)', {
          fileName: f.name,
          error: r.error ?? null,
          path: r.path ?? null,
          uploadedFileId: r.uploadedFileId ?? null,
          duplicate: r.duplicate ?? false,
        });
        if (r.error) {
          console.error(r.error);
          failedCount += 1;
          window.alert(
            `Upload failed for “${f.name}”: ${toBetaUserMessage(r.error, 'Could not upload this file. Try again.')}`
          );
        } else if (r.duplicate) {
          duplicateCount += 1;
        }
      }
      if (failedCount > 0) {
        throw new Error(
          `${failedCount} file${failedCount === 1 ? '' : 's'} could not be uploaded.`
        );
      }
      if (duplicateCount > 0) {
        console.info('[o3s-upload] persistNewFiles skipped duplicate uploads', {
          duplicateCount,
          intakeId,
        });
      }
    } finally {
      pendingPersistMetaAppendCountRef.current = 0;
      await hydrateUploadedFilesForIntake(intakeId);
      console.info('[o3s-upload] persistNewFiles complete', {
        intakeId,
        attemptedCount: files.length,
        failedCount,
        duplicateCount,
      });
    }
  };

  useEffect(() => {
    uploadedFilePersistMetaRef.current = uploadedFilePersistMeta;
  }, [uploadedFilePersistMeta]);

  useEffect(() => {
    if (pendingPersistMetaAppendCountRef.current > 0) return;
    setUploadedFilePersistMeta((prev) => {
      const n = uploadedFiles.length;
      if (prev.length === n) return prev;
      if (prev.length > n) return prev.slice(0, n);
      return [...prev, ...Array(n - prev.length).fill(null)];
    });
  }, [uploadedFiles.length]);

  const prevWorkerIntakeIdForUploadClearRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isSupabaseConfigured() || profile?.role !== 'worker') return;
    const prev = prevWorkerIntakeIdForUploadClearRef.current;
    if (prev !== undefined && prev !== currentIntakeId) {
      clearWorkerUploadUiState();
    }
    prevWorkerIntakeIdForUploadClearRef.current = currentIntakeId;
    syncWorkerIntakeUiToListRow(currentIntakeId);
  }, [currentIntakeId, clearWorkerUploadUiState, syncWorkerIntakeUiToListRow, profile?.role]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !currentIntakeId) return;
    const row = workerIntakesList.find((r) => r.id === currentIntakeId);
    if (row?.has_summary) {
      void refreshWorkerSummaryLive(currentIntakeId);
    }
  }, [currentIntakeId, workerIntakesList]);

  useEffect(() => {
    syncWorkerIntakeUiToListRow(currentIntakeId);
  }, [workerIntakesList, currentIntakeId, syncWorkerIntakeUiToListRow]);

  useEffect(() => {
    if (!isSupabaseConfigured() || profile?.role !== 'worker' || !currentIntakeId) return;
    void refreshWorkerIntakeMetadata(currentIntakeId);
  }, [currentIntakeId, profile?.role, refreshWorkerIntakeMetadata]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const shouldHydrateUploadedFiles = currentScreen === 'upload' || currentScreen === 'summary';
    if (!shouldHydrateUploadedFiles || !currentIntakeId || profile?.role !== 'worker') return;
    if (pendingPersistMetaAppendCountRef.current > 0) return;

    const hydrateForIntakeId = currentIntakeId;
    let cancelled = false;
    void (async () => {
      await hydrateUploadedFilesForIntake(hydrateForIntakeId);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [currentScreen, currentIntakeId, profile?.role, hydrateUploadedFilesForIntake]);

  const onDeleteUploadedFile = useCallback(async (index: number): Promise<{ error?: string }> => {
    const m = uploadedFilePersistMetaRef.current[index];
    if (m?.uploadedFileId && m?.filePath && isSupabaseConfigured()) {
      const r = await intakeData.deleteUploadedFileAndStorage(m.uploadedFileId, m.filePath);
      if (r.error) {
        return { error: toBetaUserMessage(r.error, 'Could not remove this file. Try again.') };
      }
    }
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedFilePersistMeta((prev) => prev.filter((_, i) => i !== index));
    return {};
  }, []);

  const onRenameUploadedFile = useCallback(async (index: number, newName: string): Promise<{ error?: string }> => {
    const trimmed = newName.trim();
    if (!trimmed) return {};
    const m = uploadedFilePersistMetaRef.current[index];
    const intakeId = currentIntakeIdRef.current;
    let resolvedCategory: string | undefined;
    if (m?.uploadedFileId && isSupabaseConfigured()) {
      const r = await intakeData.updateUploadedFileName(m.uploadedFileId, trimmed);
      if (r.error) {
        return { error: toBetaUserMessage(r.error, 'Could not rename this file. Try again.') };
      }
      resolvedCategory = r.category;
      if (intakeId) {
        const sync = await intakeData.refreshDerivedIntakeLabelsAfterFileRename(intakeId);
        if (sync.error) console.error(sync.error);
        await refreshWorkerSummaryLive(intakeId);
      }
    }
    if (resolvedCategory) {
      setUploadedFilePersistMeta((prev) => {
        const next = [...prev];
        const row = next[index];
        if (!row) return prev;
        next[index] = { ...row, category: resolvedCategory };
        return next;
      });
    }
    setUploadedFiles((prev) => {
      const next = [...prev];
      const file = next[index];
      if (!file) return prev;
      next[index] = new File([file], trimmed, { type: file.type });
      return next;
    });
    return {};
  }, []);

  const waitForExtractionReadiness = async (intakeId: string, quick = false) => {
    const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    if (quick) {
      const status = await intakeData.getExtractionStatusForIntake(intakeId);
      if (status.error) console.warn('[o3s-extraction] status check failed', status.error);
      return;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await intakeData.getExtractionStatusForIntake(intakeId);
      if (status.error) {
        console.warn('[o3s-extraction] status check failed', status.error);
        return;
      }

      const active = status.pending + status.processing;
      const statusRowsNotReadyYet = status.missing > 0 && status.completed + status.failed === 0 && attempt < 3;
      if (active === 0 && !statusRowsNotReadyYet) return;

      await pause(1000);
    }
  };

  const handleConfirmDocumentRequestResponse = async (payload: {
    fulfilledCategories: string[];
    noteToFirm: string;
  }) => {
    if (!currentIntakeId || !isSupabaseConfigured()) {
      return { error: 'No active intake.' };
    }
    const result = await intakeData.confirmWorkerDocumentRequestResponse(currentIntakeId, payload);
    if (result.error) {
      await refreshWorkerSummaryLive(currentIntakeId);
      return {
        error: toBetaUserMessage(
          result.error,
          'Could not save your response to the firm. Try again in a moment.'
        ),
      };
    }
    await refreshWorkerSummaryLive(currentIntakeId);
    const persisted = await intakeData.getPersistedWorkerDocumentRequestState(currentIntakeId);
    if (
      !intakeData.isWorkerDocumentRequestResponseComplete(
        persisted.workflowStatus,
        persisted.response
      )
    ) {
      return {
        error:
          'Your response did not save completely. The request is still active — select categories and try again.',
      };
    }
    void patchWorkerIntakeMetadata(currentIntakeId, { documentResponseDraft: null });
    workerMetadataByIntakeIdRef.current[currentIntakeId] = {
      ...(workerMetadataByIntakeIdRef.current[currentIntakeId] ?? {}),
      documentResponseDraft: undefined,
    };
    setWorkerIntakeMetadataTick((t) => t + 1);
    if (profile?.id) void refreshWorkerIntakesList(profile.id);
    void refreshPersistentNotifications();
    return {};
  };

  const runOrganizationPipeline = useCallback(async () => {
    const intakeId = currentIntakeIdRef.current;
    const pending = (pendingUploadContextRef.current ?? '').trim();
    const guidedPending = intakeId ? guidedIntakeByIntakeIdRef.current[intakeId] : undefined;
    const storyFollowUpPending = intakeId
      ? workerMetadataByIntakeIdRef.current[intakeId]?.storyFollowUp
      : undefined;
    const quick = processingQuickRef.current;
    if (!intakeId || !isSupabaseConfigured()) {
      pendingUploadContextRef.current = null;
      return;
    }
    await waitForExtractionReadiness(intakeId, quick);
    const persistMs = quick ? 20_000 : 45_000;
    try {
      await Promise.race([
        (async () => {
          const matterTags = employmentMatterByIntakeIdRef.current[intakeId];
          const err = await intakeData.persistPlaceholderOrganizationForIntake(intakeId, {
            employmentMatterTags: matterTags,
          });
          if (err.error) console.error(err.error);
          const selectedCategory = caseCategoryByIntakeIdRef.current[intakeId];
          if (selectedCategory) {
            const catErr = await mergeCaseCategoryIntoLatestIntakeSummary(intakeId, selectedCategory);
            if (catErr.error) console.error('[o3s-case-category] merge failed', catErr.error);
          }
          if (matterTags?.length) {
            const matterErr = await mergeEmploymentMatterIntoLatestIntakeSummary(intakeId, matterTags);
            if (matterErr.error) console.error('[o3s-matter] merge failed', matterErr.error);
          }
          if (guidedPending && hasGuidedIntakeContent(guidedPending)) {
            const guidedErr = await mergeGuidedIntakeIntoLatestIntakeSummary(intakeId, guidedPending);
            if (guidedErr.error) {
              console.error('[o3s-guided-intake] merge failed', guidedErr.error);
            } else {
              delete guidedIntakeByIntakeIdRef.current[intakeId];
            }
          }
          if (storyFollowUpPending && hasStoryFollowUpContent(storyFollowUpPending)) {
            const followUpErr = await mergeStoryFollowUpIntoLatestIntakeSummary(intakeId, storyFollowUpPending);
            if (followUpErr.error) console.error('[o3s-story-follow-up] merge failed', followUpErr.error);
          }
          if (pending) {
            const mergeErr = await intakeData.mergeUploadContextIntoLatestIntakeSummary(intakeId, pending);
            if (mergeErr.error) console.error(mergeErr.error);
          }
        })(),
        new Promise<void>((_, reject) => {
          window.setTimeout(() => reject(new Error('Organization timed out')), persistMs);
        }),
      ]);
    } catch (e) {
      console.error('[o3s-processing] organization pipeline', e);
    }
    pendingUploadContextRef.current = null;
  }, []);

  const handleProcessingFinished = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    const intakeId = currentIntakeIdRef.current;
    if (!intakeId || !isSupabaseConfigured()) {
      return { ok: false, error: 'No active intake to open.' };
    }
    const hasSummaryRow = await intakeData.workerIntakeHasSummaryRow(intakeId);
    if (!hasSummaryRow) {
      return {
        ok: false,
        error:
          'Your intake summary was not saved. Stay on this screen and try Begin Organizing again, or return to upload.',
      };
    }
    await refreshWorkerSummaryLive(intakeId);
    void intakeData.ensureLinkedFirmPreviewRoute(intakeId);
    if (profile?.id) {
      const rows = await refreshWorkerIntakesList(profile.id);
      const row = rows.find((r) => r.id === intakeId);
      setHasCompletedIntake(Boolean(row?.has_summary));
      syncWorkerIntakeUiToListRow(intakeId);
    }
    const wf = workerIntakeWorkflow;
    if (wf === 'Additional Documents Requested') {
      setDocRequestConfirmScrollSignal((n) => n + 1);
    }
    return { ok: true };
  }, [profile?.id, workerIntakeWorkflow, syncWorkerIntakeUiToListRow]);

  const handleUploadProcessingStart = (detail?: { uploadContext?: string }) => {
    const intakeId = currentIntakeIdRef.current;
    const intakeRow = intakeId ? workerIntakesList.find((r) => r.id === intakeId) : undefined;
    const wf = workerIntakeWorkflow;
    const docRequestResponseFlow =
      wf === 'Additional Documents Requested' ||
      wf === 'Worker Uploaded Additional Documents' ||
      wf === 'Worker Uploaded Requested Documents';
    const isReorganization =
      Boolean(intakeRow?.has_summary) || docRequestResponseFlow;
    processingQuickRef.current = isReorganization;
    setProcessingQuickMode(isReorganization);
    setProcessingExitScreen('summary');
    const raw = (detail?.uploadContext ?? '').trim();
    if (!raw) {
      pendingUploadContextRef.current = null;
      return;
    }
    pendingUploadContextRef.current = raw;
    if (!isSupabaseConfigured() || !currentIntakeId) {
      setCurrentIntakeWorkspace((prev) =>
        updateIntakeWorkspace(prev, {
          workerContext: {
            ...prev.workerContext,
            mainContext: [prev.workerContext.mainContext?.trim(), raw].filter(Boolean).join('\n\n'),
          },
        })
      );
      pendingUploadContextRef.current = null;
    }
  };

  const shareParticipating = async () => {
    if (!currentIntakeId) return { error: 'No active intake. Start organizing from the home screen.' };
    if (!isSupabaseConfigured()) {
      return { error: SUPABASE_REQUIRED_USER_MESSAGE, count: 0 };
    }
    const r = await intakeData.routePreviewToParticipatingFirms(currentIntakeId);
    if (r.error) {
      return {
        error: toBetaUserMessage(
          r.error,
          'Could not send previews to participating firms. Try again or use a firm code.'
        ),
      };
    }
    const n = r.count ?? 0;
    if (n < 1) {
      return {
        error:
          'No participating firms are currently available in this beta workspace. You can save this intake or connect a firm directly with a firm code.',
        count: 0,
      };
    }
    await intakeData.markIntakeSubmitted(currentIntakeId, { workflow_status: 'Matching Participating Firms' });
    if (profile?.id) {
      await notifications.notifyWorkerOfRoutingExpansion({
        workerId: profile.id,
        intakeId: currentIntakeId,
        firmCount: n,
      });
    }
    setParticipatingPreviewSent(true);
    return { count: n };
  };

  const shareFirmCode = async (code: string) => {
    if (!currentIntakeId) return { error: 'No active intake.' };
    const routing = await intakeData.fetchWorkerIntakeRoutingDisplay(currentIntakeId);
    const r =
      routing.submissionChannel === 'firm_code' && routing.linkedFirmId
        ? await intakeData.sendOrganizedIntakeToLinkedFirm(currentIntakeId)
        : await intakeData.routeIntakeToFirmCode(currentIntakeId, code);
    console.info('[o3s-firm-routing] shareFirmCode result', { intakeId: currentIntakeId, result: r });
    if (r.error) {
      return {
        error: toBetaUserMessage(r.error, 'Could not route this intake with that firm code. Try again.'),
      };
    }
    await refreshWorkerRoutingFromIntake(currentIntakeId, r.firmName ?? null);
    if (profile?.id) await refreshWorkerIntakesList(profile.id);
    setWorkerIntakeWorkflow('Under Firm Review');
    setFirmCodeShareCompleted(true);
    setFirmNotifications((prev) =>
      [
        {
          id: `firm-code-${Date.now()}`,
          title: 'Firm code submission received',
          body: `An intake was routed to your dashboard using your firm code (${r.firmName ?? code}).`,
        },
        ...prev,
      ].slice(0, 40)
    );
    return { firmName: r.firmName ?? null };
  };

  const approveWorkerAccess = async (routeId: string) => {
    if (!profile?.id) return { error: 'Not signed in' };
    const res = await intakeData.workerApproveFullAccess(routeId, profile.id);
    if (!res.error) {
      await refreshWorkerAccessRows();
      if (currentIntakeId) await refreshWorkerSummaryLive(currentIntakeId);
      void refreshPersistentNotifications();
    }
    return res;
  };

  const handleSignIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: SUPABASE_REQUIRED_USER_MESSAGE };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const handleCreateAccount = async (email: string, password: string) => {
    const configured = isSupabaseConfigured();
    console.info('[o3s-auth-audit] handleCreateAccount', { supabaseConfigured: configured });

    if (!configured) {
      console.warn('[o3s-auth-audit] signUp blocked: Supabase env not configured');
      return { error: SUPABASE_REQUIRED_USER_MESSAGE };
    }

    try {
      sessionStorage.removeItem(O3S_SS_WORKER_PENDING_DETAILS);
    } catch {
      /* ignore */
    }

    console.info('[o3s-auth-audit] calling supabase.auth.signUp', { emailLen: email.trim().length });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    console.info('[o3s-auth-audit] signUp returned', {
      hasError: Boolean(error),
      errorMessage: error?.message ?? null,
      errorName: error?.name ?? null,
      hasUser: Boolean(data?.user),
      userId: data?.user?.id ?? null,
      hasSession: Boolean(data?.session),
      /** When false with no error, user often must confirm email before session exists (user may still exist in Auth). */
      identitiesCount: data?.user?.identities?.length ?? 0,
    });

    if (error) return { error: error.message };

    if (!data.session?.user) {
      console.info(
        '[o3s-auth-audit] signUp: no session returned (common when "Confirm email" is enabled). Check Auth → Users and user email inbox.',
        { userId: data?.user?.id ?? null }
      );
      return { needsEmailConfirmation: true };
    }

    if (data.session?.user) {
      const user = data.session.user;
      setAuthUser(user);
      setUserEmail(user.email ?? null);
      setIsAuthenticated(true);
      setCurrentScreen('roleSelection');
      // Profile load/create runs in deferred onAuthStateChange — do not await Supabase here.
    }

    return {};
  };

  const handleWorkerGoogleSignUpCreate = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      sessionStorage.setItem(O3S_SS_WORKER_GOOGLE_SIGNUP, '1');
    } catch {
      /* ignore */
    }
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    console.info('[o3s-auth-audit] calling supabase.auth.signInWithOAuth google', { redirectTo });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      console.error('[o3s-auth-audit] signInWithOAuth error', { message: error.message, name: error.name });
      try {
        sessionStorage.removeItem(O3S_SS_WORKER_GOOGLE_SIGNUP);
      } catch {
        /* ignore */
      }
      window.alert(error.message);
    }
  };

  const handleWorkerDetailsComplete = async (details: WorkerDetailsPayload) => {
    if (!authUser?.id) return { error: 'Not signed in' };
    const parts = [details.firstName, details.middleInitial || undefined, details.lastName].filter(
      Boolean
    ) as string[];
    const fullName = parts.join(' ').trim();
    // Save full name to profiles
    const r = await intakeData.updateProfileName(authUser.id, fullName);
    if (r.error) return { error: r.error };
    // Save contact details to profiles table (persistent, device-independent)
    const contactSave = await intakeData.saveWorkerContactDetails(authUser.id, {
      middle_initial: details.middleInitial,
      phone: details.phone,
      address_line1: details.addressLine1,
      address_line2: details.addressLine2,
      city: details.city,
      state: details.state,
      zip: details.zip,
    });
    if (contactSave.error) {
      console.warn('[o3s-worker-details] contact save error (non-blocking):', contactSave.error);
    }
    try {
      sessionStorage.removeItem(O3S_SS_WORKER_PENDING_DETAILS);
    } catch {
      /* ignore */
    }
    const pr = await intakeData.fetchProfile(authUser.id);
    setProfile(pr);
    setCurrentScreen('landing');
    return {};
  };

  const handleCommitRole = async (role: 'worker' | 'firm') => {
    console.info('[o3s-role-commit] firm/worker CTA commit start', { role, userId: authUser?.id ?? null });
    if (!authUser?.id) return { error: 'Not authenticated' };

    intakeData.resetEnsureUserProfileInflight();
    console.info('[o3s-role-commit] before commitProfileRoleForUser', { role });
    const commit = await intakeData.commitProfileRoleForUser(authUser, role);
    console.info('[o3s-role-commit] after commitProfileRoleForUser', {
      role,
      hasProfile: Boolean(commit.profile),
      timedOut: Boolean(commit.timedOut),
      error: commit.error ?? null,
    });
    if (commit.error && !commit.profile) {
      return { error: toBetaUserMessage(commit.error, 'Could not save your role. Try again.') };
    }

    const p = commit.profile ?? intakeData.profileRowFromAuthUser(authUser, role);
    setProfile(p);
    setUserRole(role);
    try {
      sessionStorage.removeItem(O3S_SS_WORKER_PENDING_DETAILS);
    } catch {
      /* ignore */
    }
    if (role === 'firm') {
      let fp: intakeData.FirmProfileRow | null = null;
      if (!commit.timedOut) {
        console.info('[o3s-role-commit] before fetchFirmProfileForUserWithTimeout', { role });
        fp = await intakeData.fetchFirmProfileForUserWithTimeout(authUser.id);
      } else {
        console.info('[o3s-role-commit] skipping firm profile fetch after profile commit timeout', { role });
      }
      setFirmProfile(fp);
      console.info('[o3s-role-commit] after firm profile resolve', {
        hasFirmProfile: Boolean(fp),
        needsSetup: intakeData.firmProfileNeedsSetup(fp),
      });
      if (fp && intakeData.isFirmProfileComplete(fp)) {
        try {
          await refreshFirmDashboardRows(fp);
        } catch (e) {
          console.error('[o3s-role-commit] refreshFirmDashboardRows failed', e);
        }
      }
      const firmNext = intakeData.firmProfileNeedsSetup(fp) ? 'firmSettings' : 'firmDashboard';
      console.info('[o3s-role-commit] before setCurrentScreen (firm path)', { firmNext });
      setCurrentScreen(firmNext);
    }
    return {};
  };

  const handleSelectRole = (role: UserRole) => {
    setUserRole(role);
  };

  const handleSelectRoleWithPersist = (role: UserRole) => {
    handleSelectRole(role);
  };

  const ensureWorkerIntakeIdForHub = (): string | null => {
    if (
      currentIntakeId &&
      workerIntakeRoutingCards.some((c) => c.intakeId === currentIntakeId)
    ) {
      const row = workerIntakesList.find((r) => r.id === currentIntakeId);
      const card = workerIntakeRoutingCards.find((c) => c.intakeId === currentIntakeId);
      if (row && currentIntakeNumber !== row.intake_number) {
        setCurrentIntakeNumber(row.intake_number);
      } else if (card && currentIntakeNumber !== card.intakeNumber) {
        setCurrentIntakeNumber(card.intakeNumber);
      }
      return currentIntakeId;
    }
    const anchor = resolveWorkerLandingIntakeRow(currentIntakeId, workerIntakesList);
    if (!anchor) return null;
    if (currentIntakeId !== anchor.id) {
      setCurrentIntakeId(anchor.id);
      currentIntakeIdRef.current = anchor.id;
      setCurrentIntakeNumber(anchor.intake_number);
    } else if (currentIntakeNumber !== anchor.intake_number) {
      setCurrentIntakeNumber(anchor.intake_number);
    }
    return anchor.id;
  };

  const openWorkerSummaryFromHub = async () => {
    const id = ensureWorkerIntakeIdForHub();
    if (!id) {
      window.alert('Start organizing first. Your intake summary appears after processing.');
      return;
    }
    await refreshWorkerAccessRows(profile?.id);
    setCurrentScreen('summary');
  };

  const openWorkerSummaryForIntake = async (intakeId: string) => {
    const card = workerIntakeRoutingCards.find((c) => c.intakeId === intakeId);
    const row = workerIntakesList.find((r) => r.id === intakeId);

    currentIntakeIdRef.current = intakeId;
    setCurrentIntakeId(intakeId);
    if (card) setCurrentIntakeNumber(card.intakeNumber);
    else if (row) setCurrentIntakeNumber(row.intake_number);

    clearWorkerUploadUiState();
    syncWorkerIntakeUiToListRow(intakeId);
    setWorkerLiveSummary(null);
    await refreshWorkerSummaryLive(intakeId);
    await refreshWorkerAccessRows(profile?.id);
    setCurrentScreen('summary');
  };

  const openWorkerFirmNotesFromHub = async () => {
    const id = ensureWorkerIntakeIdForHub();
    if (!id) {
      window.alert('Start organizing first. Firm notes attach to your active intake after you have one.');
      return;
    }
    await refreshWorkerSummaryLive(id);
    await refreshWorkerAccessRows(profile?.id);
    setIntakeNotesScrollSignal((s) => s + 1);
    setCurrentScreen('summary');
  };

  const goWorkerDashboard = () => {
    setCurrentScreen('landing');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    if (profile?.id && isSupabaseConfigured()) void refreshWorkerIntakesList(profile.id);
  };

  const pushWorkerNotification = (n: AppNotificationItem) => {
    setWorkerNotifications((prev) => [n, ...prev].slice(0, 40));
  };

  const reloadFirmLiveViewForSelection = async () => {
    if (!selectedRouteMeta || !selectedIntakeId || !isSupabaseConfigured()) return;
    setFirmLiveViewLoading(true);
    try {
      const v = await intakeData.loadFirmLiveIntakeView(
        selectedIntakeId,
        selectedRouteMeta.routeId,
        selectedRouteMeta.routeStatus,
        selectedRouteMeta.intakeNumber
      );
      setFirmLiveView(v);
    } finally {
      setFirmLiveViewLoading(false);
    }
  };

  const handleFirmRequestAdditionalDocuments = async (payload: {
    intakeId: string;
    categories: string[];
    noteToWorker: string;
  }): Promise<{ error?: string }> => {
    const categories = payload.categories.map((c) => c.trim()).filter(Boolean);
    if (!categories.length) return { error: 'Select at least one document category.' };

    if (!isSupabaseConfigured()) {
      return { error: SUPABASE_REQUIRED_USER_MESSAGE };
    }
    if (!selectedRouteMeta?.routeId) {
      return { error: 'Open this intake from your firm dashboard before sending a request.' };
    }
    const result = await intakeData.firmRequestAdditionalDocuments(
      selectedRouteMeta.routeId,
      categories,
      payload.noteToWorker
    );
    if (result.error) {
      return {
        error: toBetaUserMessage(
          result.error,
          'Could not send the document request. Open this intake from your dashboard and try again.'
        ),
      };
    }
    if (firmProfile) void refreshFirmDashboardRows(firmProfile);
    await reloadFirmLiveViewForSelection();
    return {};
  };

  const handleAfterWorkerIntakeRouting = (detail: {
    kind: 'firm_code' | 'participating';
    firmName?: string | null;
    participatingRouteCount?: number;
  }) => {
    const routedName = detail.kind === 'firm_code' ? detail.firmName ?? workerLinkedFirmName : null;
    const participatingCount = detail.participatingRouteCount ?? 0;
    if (detail.kind === 'firm_code') {
      setWorkerIntakeChannel('firm_code');
      setWorkerIntakeWorkflow('Under Firm Review');
      if (detail.firmName?.trim()) setWorkerLinkedFirmName(detail.firmName.trim());
    } else if (participatingCount > 0) {
      setWorkerIntakeChannel('participating');
      setWorkerIntakeWorkflow('Matching Participating Firms');
      setParticipatingPreviewSent(true);
    }
    if (detail.kind === 'firm_code' || participatingCount > 0) {
      pushWorkerNotification({
        id: `route-${Date.now()}-${detail.kind}`,
        title:
          detail.kind === 'firm_code'
            ? 'Intake sent to your linked firm'
            : 'Intake shared with participating firms',
        body:
          detail.kind === 'firm_code'
            ? `Your organized intake was sent${routedName ? ` to ${routedName}` : ' to your law firm dashboard'}. They can open it from their firm dashboard.`
            : `Your limited preview is now in the participating review pool${participatingCount > 0 ? ` (${participatingCount} route${participatingCount === 1 ? '' : 's'})` : ''}. Firms see a preview only until you approve expanded access. Track status on your dashboard.`,
      });
    }
    if (profile?.id && isSupabaseConfigured()) void refreshWorkerIntakesList(profile.id);
    if (currentIntakeId && isSupabaseConfigured()) {
      void refreshWorkerRoutingFromIntake(currentIntakeId, detail.firmName ?? null);
    }
    setCurrentScreen('landing');
    const scrollDashboardToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    queueMicrotask(scrollDashboardToTop);
    requestAnimationFrame(() => {
      scrollDashboardToTop();
      requestAnimationFrame(scrollDashboardToTop);
    });
  };

  const openFirmSampleIntakeFlow = () => {
    setSelectedIntakeId('sample-137-demo');
    setSelectedRouteMeta({
      routeId: 'sample-route',
      routeStatus: 'preview_sent',
      intakeNumber: SAMPLE_INTAKE_NUMBER,
    });
    setFirmLiveViewLoading(false);
    const demoView: FirmLiveIntakeView = {
      previewOnly: true,
      routeId: 'sample-route',
      routeStatus: 'preview_sent',
      intakeNumber: SAMPLE_INTAKE_NUMBER,
      overview:
        'Illustrative firm-side intake layout. This preview is not linked to a live worker submission and is for orientation only.',
      timelineSummary: SAMPLE_INTAKE_SUMMARY_PREVIEW.timelineSummary,
      events: [
        {
          id: 'sample-ev-1',
          event_date: 'Jan – Mar 2026',
          title: 'Payroll and schedule alignment window',
          category: 'Payroll',
          ai_summary: SAMPLE_INTAKE_SUMMARY_PREVIEW.timelineSummary,
          worker_context: '',
        },
      ],
      files: [
        { file_name: 'Sample pay record (preview)', category: 'Pay Records / Payroll' },
        { file_name: 'Sample schedule note (preview)', category: 'Time Records' },
      ],
      readiness: ['Preview layout'],
      missing: [SAMPLE_INTAKE_SUMMARY_PREVIEW.missingDocuments],
      documentRequest: null,
      documentResponse: null,
      intakeWorkflowStatus: 'Intake Summary Generated',
      submissionChannel: 'participating',
      isFirmCodeIntake: false,
    };
    setFirmLiveView(demoView);
    setCurrentScreen('intakeReview');
  };

  const handleSignOut = async () => {
    setCurrentIntakeWorkspace(createEmptyIntakeWorkspace());
    setSubmittedIntakes([]);
    setUploadedFiles([]);
    setUploadedFilePersistMeta([]);
    setSelectedFile(null);
    setSelectedIntakeId(null);
    setSelectedRouteMeta(null);
    setShowExitModal(false);
    setHasCompletedIntake(false);
    setCurrentIntakeId(null);
    currentIntakeIdRef.current = null;
    setCurrentIntakeNumber(null);
    abandonPendingWorkerOnboarding();
    setWorkerOnboardingPrePersist(false);
    setFirmDashboardRows([]);
    setFirmLiveView(null);
    setWorkerLiveSummary(null);
    setWorkerAccessRequests([]);
    setParticipatingPreviewSent(false);
    setFirmCodeShareCompleted(false);
    setWorkerIntakeWorkflow(null);
    setWorkerIntakeChannel(null);
    setWorkerIntakesList([]);
    setWorkerUploadFirmIntent('default');
    setFirmLiveViewLoading(false);
    setWorkerLinkedFirmName(null);
    setWorkerNotifications([]);
    setFirmNotifications([]);
    setPersistentWorkerBell([]);
    setPersistentFirmBell([]);
    setPersistentNotificationsOk(false);
    setWorkerDocumentRequestPayload(null);
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setAuthUser(null);
    setIsAuthenticated(false);
    setUserRole(null);
    setUserEmail(null);
    setProfile(null);
    setFirmProfile(null);
    firmSignInIntentRef.current = false;
    try {
      sessionStorage.removeItem('o3s_offline_role');
    } catch {
      /* ignore */
    }
    setCurrentScreen('authWelcome');
  };

  const handleLogoClick = () => {
    if (currentScreen === 'landing') {
      return;
    }
    const onboardingScreens: Screen[] = ['caseCategory', 'guidedIntake', 'categoryQuestionnaire'];
    if (
      (profile?.role === 'worker' || userRole === 'worker') &&
      onboardingScreens.includes(currentScreen)
    ) {
      abandonPendingWorkerOnboarding();
      setCurrentScreen('landing');
      return;
    }
    const workerScreens: Screen[] = [
      'upload',
      'processing',
      'summary',
      'workerSettings',
      'filePreview',
      'howItWorks',
    ];
    if ((profile?.role === 'worker' || userRole === 'worker') && workerScreens.includes(currentScreen)) {
      const pendingUnpersisted =
        isSupabaseConfigured() && !currentIntakeIdRef.current && Boolean(getPendingOnboarding());
      const hasUnsavedProgress =
        uploadedFiles.length > 0 || hasCompletedIntake || pendingUnpersisted;
      if (hasUnsavedProgress && (currentScreen === 'upload' || currentScreen === 'processing')) {
        setShowExitModal(true);
      } else {
        if (pendingUnpersisted) abandonPendingWorkerOnboarding();
        setCurrentScreen('landing');
      }
      return;
    }
    const hasUnsavedProgress = uploadedFiles.length > 0 || hasCompletedIntake;
    if (hasUnsavedProgress) {
      setShowExitModal(true);
    } else {
      setCurrentScreen('landing');
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    if (isSupabaseConfigured() && !currentIntakeIdRef.current && getPendingOnboarding()) {
      abandonPendingWorkerOnboarding();
    }
    setCurrentScreen('landing');
  };

  const isFirmView = currentScreen === 'firmDashboard' || currentScreen === 'intakeReview' || currentScreen === 'firmSettings';
  const isMarketingView = currentScreen === 'publicMarketing';
  const isComparisonView = currentScreen === 'comparison';
  const isAuthView =
    currentScreen === 'authWelcome' ||
    currentScreen === 'signIn' ||
    currentScreen === 'createAccount' ||
    currentScreen === 'roleSelection' ||
    currentScreen === 'workerDetails';
  const isGalleryView = currentScreen === 'gallery' || currentScreen === 'devNavMap';
  const workerBottomNavShellScreen: WorkerShellScreen | null =
    currentScreen === 'upload'
      ? 'upload'
      : currentScreen === 'summary'
        ? 'summary'
        : currentScreen === 'processing'
          ? 'processing'
          : currentScreen === 'workerSettings'
            ? 'workerSettings'
            : null;
  const showWorkerBottomNavFallback =
    Boolean(workerBottomNavShellScreen) &&
    (profile?.role === 'worker' || userRole === 'worker') &&
    isAuthenticated;
  const handleWorkerBottomNavFallback = useCallback(
    (id: WorkerMobileNavId) => {
      if (id === 'add') {
        void createNewWorkerIntake();
        return;
      }
      if (id === 'summary') {
        void openWorkerSummaryFromHub();
        return;
      }
      if (id === 'home' || id === 'statusJourney' || id === 'intakes') {
        setWorkerLandingInitialHubView(id);
      }
      setCurrentScreen('landing');
    },
    []
  );

  const workerLandingIntakeRow = resolveWorkerLandingIntakeRow(currentIntakeId, workerIntakesList);

  const workerIntakeChronologicalSequenceById = useMemo(() => {
    const sorted = [...workerIntakesList].sort(
      (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );
    const map = new Map<string, number>();
    sorted.forEach((row, index) => map.set(row.id, 300 + index));
    return map;
  }, [workerIntakesList]);

  const resolveIntakeDisplayNumber = useCallback(
    (intakeId: string | null | undefined, storedNumber: string | null | undefined): string | null => {
      if (!intakeId) return null;
      const row = workerIntakesList.find((r) => r.id === intakeId);
      const category =
        caseCategoryByIntakeIdRef.current[intakeId] ??
        (row?.case_category as IntakeCaseCategory | null | undefined) ??
        categoryFromGuidedAnswers(intakeId) ??
        null;
      const seq = workerIntakeChronologicalSequenceById.get(intakeId);
      return resolveWorkerIntakeDisplayNumber(storedNumber, category, seq);
    },
    [workerIntakesList, workerIntakeChronologicalSequenceById, categoryFromGuidedAnswers]
  );

  const workerHubIntakeLabel = workerOnboardingPrePersist
    ? null
    : currentIntakeId
      ? resolveIntakeDisplayNumber(currentIntakeId, currentIntakeNumber)
      : workerLandingIntakeRow
        ? resolveIntakeDisplayNumber(
            workerLandingIntakeRow.id,
            workerLandingIntakeRow.intake_number
          )
        : hasCompletedIntake
          ? `Local · ${currentIntakeWorkspace.id.replace(/^intake-/, '').slice(0, 12)}`
          : null;

  const workerActiveHubEligible =
    (profile?.role === 'worker' || userRole === 'worker') &&
    isAuthenticated &&
    !workerOnboardingPrePersist &&
    Boolean(currentIntakeId && workerIntakesList.some((r) => r.id === currentIntakeId)) &&
    !!workerHubIntakeLabel;

  const workerActiveHub = workerActiveHubEligible
    ? {
        intakeId: currentIntakeId,
        intakeNumber: workerHubIntakeLabel,
        caseCategory:
          (currentIntakeId ? caseCategoryByIntakeIdRef.current[currentIntakeId] : null) ??
          (currentIntakeId ? categoryFromGuidedAnswers(currentIntakeId) : null) ??
          workerLandingIntakeRow?.case_category ??
          (workerLandingIntakeRow?.has_summary ? 'Employment' : null) ??
          null,
        employmentMatterTags: currentIntakeId ? resolveEmploymentMatterTags(currentIntakeId) : [],
        workflow: workerIntakeWorkflow ?? workerLandingIntakeRow?.workflow_status ?? 'Upload Complete',
        channel: workerIntakeChannel,
        firmName: workerLinkedFirmName,
        firmCode: workerLinkedFirmCode,
        routeStatus: workerLinkedRouteStatus,
        routeSharedAt: workerLinkedRouteSharedAt,
      }
    : undefined;

  const workerRoutingCardsForDisplay = workerIntakeRoutingCards.map((card) => {
        const caseCategory =
          card.caseCategory ??
          caseCategoryByIntakeIdRef.current[card.intakeId] ??
          loadGuidedIntakeFromSession(card.intakeId)?.caseCategory ??
          (card.hasSummary ? 'Employment' : null) ??
          null;
        const seq = workerIntakeChronologicalSequenceById.get(card.intakeId);
        return {
          ...card,
          caseCategory,
          employmentMatterTags: resolveEmploymentMatterTags(card.intakeId),
          intakeNumber: resolveWorkerIntakeDisplayNumber(card.intakeNumber, caseCategory, seq),
        };
      });

  /** When the active intake card is visible with a Supabase row, keep `currentIntakeId` aligned (no new intakes). */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!(profile?.role === 'worker' || userRole === 'worker') || !isAuthenticated) return;
    if (workerOnboardingPrePersist || workerOnboardingPrePersistRef.current) return;
    if (currentScreen !== 'landing' && currentScreen !== 'summary') return;
    if (!workerActiveHubEligible) return;
    if (skipAnchorIntakeSyncRef.current) return;
    if (
      currentIntakeId &&
      workerIntakeRoutingCards.some((c) => c.intakeId === currentIntakeId) &&
      !workerIntakesList.some((r) => r.id === currentIntakeId)
    ) {
      return;
    }
    const anchor = resolveWorkerLandingIntakeRow(currentIntakeId, workerIntakesList);
    if (!anchor) return;
    if (currentIntakeId !== anchor.id) {
      setCurrentIntakeId(anchor.id);
      currentIntakeIdRef.current = anchor.id;
      setCurrentIntakeNumber(anchor.intake_number);
    } else if (currentIntakeNumber !== anchor.intake_number) {
      setCurrentIntakeNumber(anchor.intake_number);
    }
  }, [
    profile?.role,
    userRole,
    isAuthenticated,
    workerOnboardingPrePersist,
    currentScreen,
    workerActiveHubEligible,
    workerIntakesList,
    workerIntakeRoutingCards,
    currentIntakeId,
    currentIntakeNumber,
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (currentScreen !== 'landing' && currentScreen !== 'summary') return;
    if (!(profile?.role === 'worker' || userRole === 'worker') || !isAuthenticated) return;
    if (!workerActiveHubEligible || !currentIntakeId) return;
    void refreshWorkerRoutingFromIntake(currentIntakeId);
  }, [
    currentScreen,
    profile?.role,
    userRole,
    isAuthenticated,
    workerActiveHubEligible,
    currentIntakeId,
    workerIntakesList,
  ]);

  useEffect(() => {
    if (currentScreen !== 'landing') return;
    if (!(profile?.role === 'worker' || userRole === 'worker') || !isAuthenticated) return;
    const anchor = resolveWorkerLandingIntakeRow(currentIntakeId, workerIntakesList);
    if (!anchor) return;
    if (anchor.workflow_status) setWorkerIntakeWorkflow(anchor.workflow_status);
    if (anchor.submission_channel !== undefined && anchor.submission_channel !== null) {
      setWorkerIntakeChannel(anchor.submission_channel);
    }
  }, [currentScreen, profile?.role, userRole, isAuthenticated, currentIntakeId, workerIntakesList]);

  const authRestoringSplash =
    isSupabaseConfigured() && isAuthRestoring && !isAuthenticated;

  const isWorkerRole = profile?.role === 'worker' || userRole === 'worker';
  const workerFirstOrganizeGateActive =
    isWorkerRole &&
    isAuthenticated &&
    isSupabaseConfigured() &&
    !workerIntakesLoading &&
    workerIntakesList.length === 0 &&
    !lawFirmGateCompleted &&
    !firmDirectedContext; // firm-directed workers skip the modal — firm is already known
  const workerHasOrganizingActivity =
    workerIntakesList.length > 0 ||
    uploadedFiles.length > 0 ||
    hasCompletedIntake ||
    Boolean(getPendingOnboarding()?.guidedFlowCompleted);

  const pendingWorkerOnboarding = getPendingOnboarding();
  const storyFollowUpForActiveIntake = useMemo((): StoryFollowUpAnswers => {
    const fromOverview = extractStoryFollowUpFromOverview(workerLiveSummary?.overview);
    if (hasStoryFollowUpContent(fromOverview)) return fromOverview!;
    if (currentIntakeId) {
      const fromMetadata = workerMetadataByIntakeIdRef.current[currentIntakeId]?.storyFollowUp;
      if (hasStoryFollowUpContent(fromMetadata)) return fromMetadata!;
    }
    if (hasStoryFollowUpContent(pendingWorkerOnboarding?.storyFollowUp)) {
      return pendingWorkerOnboarding!.storyFollowUp!;
    }
    return EMPTY_STORY_FOLLOWUP;
  }, [
    currentIntakeId,
    currentScreen,
    pendingWorkerOnboarding?.storyFollowUp,
    workerLiveSummary?.overview,
    workerIntakeMetadataTick,
  ]);
  const guidedInitialAnswersForActiveIntake = useMemo((): GuidedIntakeAnswers | null => {
    if (!currentIntakeId) return pendingWorkerOnboarding?.guidedAnswers ?? null;
    const savedStory = intakeData.extractWorkerStoryFromOverview(workerLiveSummary?.overview)?.trim() ?? '';
    const metadataStory = workerMetadataByIntakeIdRef.current[currentIntakeId]?.workerStory?.trim() ?? '';
    const existing =
      guidedIntakeByIntakeIdRef.current[currentIntakeId] ??
      loadGuidedIntakeFromSession(currentIntakeId);
    const durableStory = savedStory || metadataStory;
    if (!durableStory) return existing;
    return {
      topics: existing?.topics ?? [],
      context: durableStory,
      availableRecords: existing?.availableRecords ?? [],
      caseCategory:
        existing?.caseCategory ??
        categoryFromGuidedAnswers(currentIntakeId) ??
        BETA_WORKER_CASE_CATEGORY,
      employmentMatterTags:
        existing?.employmentMatterTags ??
        resolveEmploymentMatterTags(currentIntakeId),
      scaffoldResponses: existing?.scaffoldResponses,
      skipped: false,
    };
  }, [
    currentIntakeId,
    pendingWorkerOnboarding?.guidedAnswers,
    workerLiveSummary?.overview,
    categoryFromGuidedAnswers,
    resolveEmploymentMatterTags,
    workerIntakeMetadataTick,
  ]);
  const showSaveWorkerIntakeDraft =
    isSupabaseConfigured() &&
    !currentIntakeId &&
    Boolean(
      pendingWorkerOnboarding && isPendingOnboardingReadyToPersist(pendingWorkerOnboarding)
    );

  const sessionWorkerBellForDisplay = workerNotifications
    .filter((n) =>
      persistentNotificationsOk
        ? !isSessionDocumentRequestNotification(n)
        : isSafeSessionNotification(n)
    )
    .map(enrichSessionBellItem);
  const displayWorkerBellNotifications = persistentNotificationsOk
    ? [...persistentWorkerBell, ...sessionWorkerBellForDisplay]
    : sessionWorkerBellForDisplay;
  const displayFirmBellNotifications = (
    persistentNotificationsOk ? [...persistentFirmBell, ...firmNotifications] : firmNotifications
  ).map(enrichSessionBellItem);
  const workerBellPanelNotice = persistentNotificationsLoadFailed
    ? 'Notifications are temporarily unavailable. Only recent on-device activity is shown.'
    : undefined;

  if (authRestoringSplash) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">one3Seven</p>
          <p className="mt-2 text-sm text-slate-600">Restoring your secure session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {OFFLINE_DEV_GALLERY_ONLY ? (
        <div
          className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900"
          role="status"
        >
          Dev UI gallery only — Supabase is not configured. Set{' '}
          <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
          <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> to run real auth and workflows.
        </div>
      ) : null}
      {/* Dev-only: screen gallery with mock data */}
      {SHOW_DEV_GALLERY && currentScreen !== 'devNavMap' && currentScreen !== 'gallery' && (
        <div className="fixed top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setCurrentScreen('devNavMap')}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg"
          >
            Dev: Screen map
          </button>
        </div>
      )}

      <div className={`${isGalleryView || isComparisonView || isMarketingView || isFirmView ? 'max-w-full' : isAuthView ? 'max-w-full' : 'max-w-[390px]'} mx-auto bg-white min-h-screen ${isAuthView || isGalleryView ? 'shadow-sm' : isMarketingView || isFirmView ? '' : 'shadow-2xl'} ${isAuthView || isGalleryView || isComparisonView || isMarketingView ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <AnimatePresence mode="wait">
          {currentScreen === 'devNavMap' && (
            <motion.div
              key="devNavMap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <DevNavMapScreen onNavigate={navigateToScreen} />
            </motion.div>
          )}
          {currentScreen === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <GalleryScreen onNavigate={navigateToScreen} submittedIntakes={submittedIntakes} />
            </motion.div>
          )}
          {currentScreen === 'publicMarketing' && (
            <motion.div
              key="publicMarketing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <PublicMarketingPage
                onWorkerStart={
                  firmDirectedContext
                    ? () => void startFirmDirectedGuestIntake()
                    : () => setCurrentScreen('authWelcome')
                }
                onFirmStart={() => {
                  firmSignInIntentRef.current = true;
                  setCurrentScreen('signIn');
                }}
                onSignIn={() => {
                  firmSignInIntentRef.current = false;
                  setCurrentScreen('signIn');
                }}
                firmDirectedContext={firmDirectedContext}
              />
            </motion.div>
          )}
          {currentScreen === 'firmDirectedIntake' && !firmDirectedContext && (
            <motion.div key="firmDirectedIntakeLoading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex min-h-screen items-center justify-center bg-[#F6F2FF]">
              <span className="text-sm text-[#1E1B4B]/40">Loading…</span>
            </motion.div>
          )}
          {currentScreen === 'firmDirectedIntake' && firmDirectedContext && (
            <motion.div
              key="firmDirectedIntake"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <FirmDirectedIntakeScreen
                firmName={firmDirectedContext.firmName}
                onSubmit={async (data) => {
                  if (!isSupabaseConfigured()) return { error: 'Service unavailable.' };
                  try {
                    // Persist form data to sessionStorage before OTP so it survives the redirect.
                    const payload = { ...data, firmId: firmDirectedContext.firmId, firmCode: firmDirectedContext.firmCode, firmName: firmDirectedContext.firmName };
                    sessionStorage.setItem(FD_SS_KEY, JSON.stringify(payload));
                    const { error: otpError } = await supabase.auth.signInWithOtp({
                      email: data.email,
                      options: {
                        shouldCreateUser: true,
                        emailRedirectTo: 'https://one3seven.com',
                      },
                    });
                    if (otpError) {
                      try { sessionStorage.removeItem(FD_SS_KEY); } catch { /* ignore */ }
                      return { error: otpError.message };
                    }
                    return {};
                  } catch (e: unknown) {
                    try { sessionStorage.removeItem(FD_SS_KEY); } catch { /* ignore */ }
                    return { error: e instanceof Error ? e.message : 'Something went wrong.' };
                  }
                }}
              />
            </motion.div>
          )}
          {currentScreen === 'authWelcome' && (
            <motion.div
              key="authWelcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <AuthWelcomeScreen
                onNavigate={navigateToScreen}
                onOpenSignIn={() => {
                  firmSignInIntentRef.current = false;
                  setCurrentScreen('signIn');
                }}
                onFirmSignIn={() => {
                  firmSignInIntentRef.current = true;
                  setCurrentScreen('signIn');
                }}
                onOpenCreateAccount={() => {
                  firmSignInIntentRef.current = false;
                  setCurrentScreen('createAccount');
                }}
              />
            </motion.div>
          )}
          {currentScreen === 'signIn' && (
            <motion.div
              key="signIn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <SignInScreen
                onNavigate={(s) => {
                  if (s === 'createAccount') firmSignInIntentRef.current = false;
                  setCurrentScreen(s);
                }}
                onSignIn={handleSignIn}
                onGoogleAuth={isSupabaseConfigured() ? handleGoogleSignIn : undefined}
              />
            </motion.div>
          )}
          {currentScreen === 'createAccount' && (
            <motion.div
              key="createAccount"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <CreateAccountScreen
                onNavigate={navigateToScreen}
                onCreateAccount={handleCreateAccount}
                onGoogleAuth={handleWorkerGoogleSignUpCreate}
              />
            </motion.div>
          )}
          {currentScreen === 'roleSelection' && (
            <motion.div
              key="roleSelection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <RoleSelectionScreen
                onNavigate={navigateToScreen}
                onSelectRole={handleSelectRoleWithPersist}
                onCommitRole={
                  isSupabaseConfigured()
                    ? handleCommitRole
                    : async () => ({ error: SUPABASE_REQUIRED_USER_MESSAGE })
                }
              />
            </motion.div>
          )}
          {currentScreen === 'workerDetails' && (
            <motion.div
              key="workerDetails"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <WorkerDetailsScreen
                onNavigate={navigateToScreen}
                onComplete={handleWorkerDetailsComplete}
                initialDetails={profile ? {
                  firstName: profile.full_name?.split(' ')[0] ?? '',
                  middleInitial: profile.middle_initial ?? '',
                  lastName: profile.full_name?.split(' ').slice(-1)[0] ?? '',
                  phone: profile.phone ?? '',
                  addressLine1: profile.address_line1 ?? '',
                  addressLine2: profile.address_line2 ?? '',
                  city: profile.city ?? '',
                  state: profile.state ?? '',
                  zip: profile.zip ?? '',
                } : null}
              />
            </motion.div>
          )}
          {currentScreen === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <LandingScreen
                onNavigate={navigateToScreen}
                requireLawFirmChoiceBeforeOrganizing={workerFirstOrganizeGateActive}
                firmCodeRoutingAvailable={isSupabaseConfigured()}
                firmDirectedContext={firmDirectedContext}
                onContinueOrganizing={(choice) => {
                  if (profile?.id) {
                    try {
                      sessionStorage.setItem(`o3s_worker_law_firm_gate_v1_${profile.id}`, '1');
                    } catch {
                      /* ignore */
                    }
                    setLawFirmGateCompleted(true);
                  }
                  if (choice === 'continue_without') setWorkerUploadFirmIntent('skip_firm_gate');
                  else setWorkerUploadFirmIntent('enter_firm_code_first');
                  void beginWorkerIntake();
                }}
                onStartOrganizing={workerFirstOrganizeGateActive ? undefined : () => void beginWorkerIntake()}
                showStartOrganizingHero={
                  !(isWorkerRole && isAuthenticated && workerHasOrganizingActivity)
                }
                onOpenSettings={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => setCurrentScreen('workerSettings')
                    : undefined
                }
                showWorkerHub={(profile?.role === 'worker' || userRole === 'worker') && isAuthenticated}
                workerGreetingName={profile?.full_name ?? null}
                mobileHubView={workerLandingInitialHubView}
                onGoWorkerSummary={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void openWorkerSummaryFromHub()
                    : undefined
                }
                onOpenWorkerSummaryForIntake={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? (intakeId) => void openWorkerSummaryForIntake(intakeId)
                    : undefined
                }
                onOpenWorkerIntakeWorkspaceForIntake={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? (intakeId) => void openWorkerIntakeWorkspaceForIntake(intakeId)
                    : undefined
                }
                onOpenWorkerFirmNotes={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void openWorkerFirmNotesFromHub()
                    : undefined
                }
                onWorkerSignOut={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void handleSignOut()
                    : undefined
                }
                onGoWorkerDashboard={goWorkerDashboard}
                workerBellNotifications={displayWorkerBellNotifications}
                workerActionNeededIntakeIds={workerActionNeededIntakeIds}
                notificationsPanelNotice={workerBellPanelNotice}
                activeIntakeHub={workerActiveHub}
                workerIntakeRoutingCards={workerRoutingCardsForDisplay}
                firmCodeActionBusy={firmCodeActionBusy}
                firmCodeActionError={firmCodeActionError}
                onAddFirmCodeForIntake={
                  isSupabaseConfigured() ? requestAddFirmCodeForIntake : undefined
                }
                onRemoveFirmCodeForIntake={
                  isSupabaseConfigured() ? handleRemoveFirmCodeForIntake : undefined
                }
                onCreateNewIntake={
                  isSupabaseConfigured() ? () => void createNewWorkerIntake() : undefined
                }
                createNewIntakeBusy={createNewIntakeBusy}
                onDeleteWorkerIntake={
                  isSupabaseConfigured() ? handleDeleteWorkerIntake : undefined
                }
                deleteIntakeBusyId={deleteIntakeBusyId}
                deleteIntakeError={deleteIntakeError}
                deleteIntakeErrorIntakeId={deleteIntakeErrorIntakeId}
                onClearDeleteIntakeError={() => {
                  setDeleteIntakeError(null);
                  setDeleteIntakeErrorIntakeId(null);
                }}
                onSelectWorkerIntake={(intakeId) => {
                  void selectWorkerIntake(intakeId);
                }}
              />
            </motion.div>
          )}
          {currentScreen === 'guidedIntake' && (
            <motion.div
              key="guidedIntake"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <GuidedIntakeScreen
                intakeNumber={
                  workerOnboardingPrePersist
                    ? null
                    : resolveIntakeDisplayNumber(currentIntakeId, currentIntakeNumber)
                }
                initialAnswers={
                  guidedInitialAnswersForActiveIntake
                }
                onComplete={completeGuidedIntakeFlow}
                onSkip={skipGuidedIntakeFlow}
                onDraftChange={handleGuidedOnboardingDraftChange}
                onBackToLanding={() => {
                  abandonPendingWorkerOnboarding();
                  setCurrentScreen('landing');
                }}
              />
            </motion.div>
          )}
          {currentScreen === 'caseCategory' && (
            <motion.div
              key="caseCategory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <EmploymentMatterScreen
                intakeNumber={
                  workerOnboardingPrePersist
                    ? null
                    : resolveIntakeDisplayNumber(currentIntakeId, currentIntakeNumber)
                }
                initialTags={resolveEmploymentMatterTags(currentIntakeIdRef.current)}
                onContinue={handleEmploymentMatterContinue}
                onDraftChange={handleEmploymentMatterDraftChange}
                onBackToLanding={() => {
                  abandonPendingWorkerOnboarding();
                  setCurrentScreen('landing');
                }}
              />
            </motion.div>
          )}
          {currentScreen === 'categoryQuestionnaire' && (
            <motion.div
              key="categoryQuestionnaire"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <CategoryQuestionnaireScreen
                category={selectedCaseCategory}
                intakeNumber={
                  workerOnboardingPrePersist
                    ? null
                    : resolveIntakeDisplayNumber(currentIntakeId, currentIntakeNumber)
                }
                initialAnswers={
                  currentIntakeId
                    ? (nonEmploymentAnswersByIntakeIdRef.current[currentIntakeId] ??
                      EMPTY_CATEGORY_QUESTIONNAIRE_ANSWERS)
                    : (pendingWorkerOnboarding?.questionnaireAnswers ??
                      EMPTY_CATEGORY_QUESTIONNAIRE_ANSWERS)
                }
                onBackToCategories={() => setCurrentScreen('caseCategory')}
                onDraftChange={handleCategoryQuestionnaireDraftChange}
                onContinueToUpload={completeNonEmploymentQuestionnaire}
              />
            </motion.div>
          )}
          {currentScreen === 'upload' && (
            <motion.div
              key={`upload-${currentIntakeId ?? 'none'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <UploadScreen
                onNavigate={navigateToScreen}
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                onLogoClick={handleLogoClick}
                hasCompletedIntake={hasCompletedIntake}
                onProcessingComplete={handleUploadProcessingStart}
                onPersistNewFiles={
                  isSupabaseConfigured() &&
                  Boolean(authUser?.id) &&
                  profile?.role === 'worker' &&
                  isAuthenticated &&
                  (currentIntakeId || pendingWorkerOnboarding?.guidedFlowCompleted)
                    ? persistNewFiles
                    : undefined
                }
                onEnsureWorkerIntakePersisted={
                  isSupabaseConfigured() && profile?.role === 'worker' && isAuthenticated
                    ? ensureWorkerIntakePersisted
                    : undefined
                }
                showSaveIntakeDraft={showSaveWorkerIntakeDraft}
                onSaveIntakeDraft={showSaveWorkerIntakeDraft ? handleSaveWorkerIntakeDraft : undefined}
                onRenameUploadedFile={onRenameUploadedFile}
                onDeleteUploadedFile={onDeleteUploadedFile}
                uploadedFilePersistMeta={uploadedFilePersistMeta}
                activeIntakeId={isSupabaseConfigured() ? currentIntakeId : undefined}
                supabaseWorkerIntakeMissing={
                  isSupabaseConfigured() &&
                  profile?.role === 'worker' &&
                  isAuthenticated &&
                  !currentIntakeId
                }
                onLookupFirmCode={isSupabaseConfigured() ? (code) => intakeData.fetchFirmByCodeForWorker(code) : undefined}
                onLinkFirmToIntake={
                  isSupabaseConfigured() && (currentIntakeId || pendingWorkerOnboarding?.guidedFlowCompleted)
                    ? linkFirmCodeForActiveIntake
                    : undefined
                }
                onPrelinkFirmCode={
                  isSupabaseConfigured() && (currentIntakeId || pendingWorkerOnboarding?.guidedFlowCompleted)
                    ? prelinkFirmCodeForActiveIntake
                    : undefined
                }
                activeIntakeLinkedFirmName={workerLinkedFirmName}
                intakeHasGeneratedSummary={Boolean(
                  currentIntakeId && workerIntakesList.find((r) => r.id === currentIntakeId)?.has_summary
                )}
                suppressUploadFirmGate={
                  lawFirmGateCompleted ||
                  Boolean(
                    currentIntakeId && workerIntakesList.find((r) => r.id === currentIntakeId)?.has_summary
                  )
                }
                workerFirmOrganizeIntent={workerUploadFirmIntent}
                onOpenWorkerSettings={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => setCurrentScreen('workerSettings')
                    : undefined
                }
                onWorkerSignOut={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void handleSignOut()
                    : undefined
                }
                workerBellNotifications={displayWorkerBellNotifications}
                notificationsPanelNotice={workerBellPanelNotice}
                documentRequestPayload={
                  currentIntakeId &&
                  workerIntakesList.find((r) => r.id === currentIntakeId)?.has_summary
                    ? workerDocumentRequestPayload
                    : null
                }
                liveOverview={
                  currentIntakeId &&
                  workerIntakesList.find((r) => r.id === currentIntakeId)?.has_summary
                    ? workerLiveSummary?.overview
                    : undefined
                }
                liveMissing={
                  currentIntakeId &&
                  workerIntakesList.find((r) => r.id === currentIntakeId)?.has_summary
                    ? workerLiveSummary?.missing
                    : undefined
                }
                workerWorkflowStatus={workerIntakeWorkflow}
                initialUploadConsentChecked={
                  currentIntakeId ? resolveUploadConsentChecked(currentIntakeId) : false
                }
                onUploadConsentPersist={
                  isSupabaseConfigured() && currentIntakeId ? handleUploadConsentPersist : undefined
                }
                storyFollowUp={storyFollowUpForActiveIntake}
                onStoryFollowUpChange={handleStoryFollowUpChange}
              />
            </motion.div>
          )}
          {currentScreen === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ProcessingScreen
                onNavigate={navigateToScreen}
                uploadedFiles={uploadedFiles}
                onRunOrganization={isSupabaseConfigured() ? runOrganizationPipeline : undefined}
                destinationAfterComplete={processingExitScreen}
                quickMode={processingQuickMode}
                onProcessingFinished={handleProcessingFinished}
                onOpenWorkerSettings={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => setCurrentScreen('workerSettings')
                    : undefined
                }
                onWorkerSignOut={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void handleSignOut()
                    : undefined
                }
                workerBellNotifications={displayWorkerBellNotifications}
                notificationsPanelNotice={workerBellPanelNotice}
              />
            </motion.div>
          )}
          {currentScreen === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <IntakeSummaryScreen
                onNavigate={navigateToScreen}
                uploadedFiles={uploadedFiles}
                onLogoClick={
                  profile?.role === 'worker' || userRole === 'worker' ? () => setCurrentScreen('landing') : handleLogoClick
                }
                intakeWorkspace={currentIntakeWorkspace}
                onSaveIntake={saveIntakeWorkspace}
                onSubmitToFirms={isSupabaseConfigured() ? submitToFirms : undefined}
                uploadedFileLabels={uploadedFileLabels}
                onUploadedFileLabelChange={(key, label) =>
                  setUploadedFileLabels((prev) => ({ ...prev, [key]: label.slice(0, 14) }))
                }
                onRemoveUploadedFile={(index) => {
                  const file = uploadedFiles[index];
                  if (!file) return;
                  const key = uploadedFileKey(file);
                  void (async () => {
                    const r = await onDeleteUploadedFile(index);
                    if (r.error) {
                      window.alert(`Could not remove file: ${r.error}`);
                      return;
                    }
                    setUploadedFileLabels((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                  })();
                }}
                uploadedFilePersistMeta={uploadedFilePersistMeta}
                liveOverview={workerLiveSummary?.overview}
                liveTimelineSummary={workerLiveSummary?.timelineSummary}
                liveTimelineEvents={workerLiveSummary?.timeline}
                liveReadiness={workerLiveSummary?.readiness}
                liveMissing={workerLiveSummary?.missing}
                liveAccessRequests={workerAccessRequests.map((w) => ({
                  routeId: w.routeId,
                  firmName: w.firmName,
                  barNumber: w.barNumber,
                  barState: w.barState,
                }))}
                onApproveAccess={isSupabaseConfigured() ? approveWorkerAccess : undefined}
                onShareFirmCode={
                  isSupabaseConfigured() && currentIntakeId
                    ? shareFirmCode
                    : undefined
                }
                onShareParticipating={
                  BETA_ENABLE_PARTICIPATING_ROUTING &&
                  isSupabaseConfigured() &&
                  currentIntakeId &&
                  !workerLinkedFirmCode?.trim() &&
                  !(workerIntakeChannel === 'participating' && participatingPreviewSent)
                    ? shareParticipating
                    : undefined
                }
                workerWorkflowStatus={workerIntakeWorkflow}
                connectedFirmName={workerLinkedFirmName}
                connectedFirmCode={workerLinkedFirmCode}
                connectedRouteStatus={workerLinkedRouteStatus}
                connectedRouteSharedAt={workerLinkedRouteSharedAt}
                firmCodeActionBusy={firmCodeActionBusy}
                firmCodeActionError={firmCodeActionError}
                onAddFirmCode={
                  isSupabaseConfigured() && currentIntakeId
                    ? () => requestAddFirmCodeForIntake(currentIntakeId)
                    : undefined
                }
                onRemoveFirmCode={
                  isSupabaseConfigured() && currentIntakeId
                    ? () => handleRemoveFirmCodeForIntake(currentIntakeId)
                    : undefined
                }
                openFirmCodeModalSignal={firmCodeModalSignal}
                participatingRoutingActive={participatingPreviewSent}
                intakeNumber={currentIntakeNumber}
                exportIntakeId={isSupabaseConfigured() ? currentIntakeId : null}
                preferLiveDataOnly={Boolean(isSupabaseConfigured() && currentIntakeId)}
                submissionChannel={workerIntakeChannel}
                backScreen="landing"
                onOpenWorkerSettings={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => setCurrentScreen('workerSettings')
                    : undefined
                }
                onWorkerSignOut={
                  (profile?.role === 'worker' || userRole === 'worker') && isAuthenticated
                    ? () => void handleSignOut()
                    : undefined
                }
                onAfterRoutingSuccess={handleAfterWorkerIntakeRouting}
                onEmailActivitySaved={() =>
                  pushWorkerNotification({
                    id: `email-${Date.now()}`,
                    title: 'Note saved with intake',
                    body: 'Email delivery will be connected before external beta. Your note is saved with this intake.',
                  })
                }
                showDemoSampleWatermark={SHOW_SAMPLE_INTAKE && currentIntakeNumber === SAMPLE_INTAKE_NUMBER}
                workerBellNotifications={displayWorkerBellNotifications}
                notificationsPanelNotice={workerBellPanelNotice}
                documentRequestPayload={workerDocumentRequestPayload}
                intakeNotesScrollSignal={intakeNotesScrollSignal}
                accessApprovalScrollSignal={accessApprovalScrollSignal}
                docRequestConfirmScrollSignal={docRequestConfirmScrollSignal}
                workerStoryPreview={
                  currentIntakeId
                    ? intakeData.extractWorkerStoryFromOverview(workerLiveSummary?.overview) ??
                      loadGuidedIntakeFromSession(currentIntakeId)?.context?.trim() ??
                      null
                    : null
                }
                employmentMatterTags={
                  currentIntakeId ? resolveEmploymentMatterTags(currentIntakeId) : []
                }
                onSaveWorkerIntakeNotes={
                  isSupabaseConfigured() && currentIntakeId
                    ? async (notes: string) => {
                        const r = await intakeData.setWorkerIntakeNotesInLatestIntakeSummary(
                          currentIntakeId,
                          notes
                        );
                        if (!r.error) await refreshWorkerSummaryLive(currentIntakeId);
                        return r;
                      }
                    : undefined
                }
                onConfirmDocumentRequestResponse={
                  isSupabaseConfigured() && currentIntakeId
                    ? handleConfirmDocumentRequestResponse
                    : undefined
                }
                documentResponseDraft={
                  currentIntakeId ? resolveDocumentResponseDraft(currentIntakeId) : null
                }
                onDocumentResponseDraftChange={
                  isSupabaseConfigured() && currentIntakeId
                    ? handleDocumentResponseDraftChange
                    : undefined
                }
              />
            </motion.div>
          )}
          {currentScreen === 'filePreview' && selectedFile && (
            <motion.div
              key="filePreview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <FilePreviewScreen
                onNavigate={navigateToScreen}
                fileName={selectedFile.fileName}
                category={selectedFile.category}
                timelineEvent={selectedFile.timelineEvent}
              />
            </motion.div>
          )}
          {currentScreen === 'howItWorks' && (
            <motion.div
              key="howItWorks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <HowItWorksScreen onNavigate={navigateToScreen} />
            </motion.div>
          )}
          {currentScreen === 'firmDashboard' && (
            <motion.div
              key="firmDashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <LawFirmDashboardScreen
                onNavigate={navigateToScreen}
                onSelectIntake={(intakeId, meta) => {
                  setSelectedIntakeId(intakeId);
                  setSelectedRouteMeta(meta ?? null);
                  const loadLive = Boolean(meta && isSupabaseConfigured());
                  setFirmLiveViewLoading(loadLive);
                  setFirmLiveView(null);
                  void (async () => {
                    try {
                      if (meta && isSupabaseConfigured()) {
                        const v = await intakeData.loadFirmLiveIntakeView(
                          intakeId,
                          meta.routeId,
                          meta.routeStatus,
                          meta.intakeNumber
                        );
                        setFirmLiveView(v);
                      } else {
                        setFirmLiveView(null);
                      }
                    } finally {
                      setFirmLiveViewLoading(false);
                    }
                  })();
                  setCurrentScreen('intakeReview');
                }}
                submittedIntakes={SHOW_DEV_GALLERY ? submittedIntakes : []}
                dbIntakes={firmDashboardRows}
                onViewSampleIntakeFlow={SHOW_SAMPLE_INTAKE ? openFirmSampleIntakeFlow : undefined}
                firmBellNotifications={displayFirmBellNotifications}
                firmBanner={
                  firmProfile && intakeData.isFirmProfileComplete(firmProfile)
                    ? {
                        firmName: firmProfile.firm_name,
                        firmCode: firmProfile.firm_code,
                        activeCount: firmDashboardRows.length,
                      }
                    : undefined
                }
                onSignOut={() => void handleSignOut()}
              />
            </motion.div>
          )}
          {currentScreen === 'intakeReview' && selectedIntakeId && (
            <motion.div
              key="intakeReview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <IntakeReviewErrorBoundary onBackToDashboard={() => navigateToScreen('firmDashboard')}>
              <IntakeReviewScreen
                onNavigate={navigateToScreen}
                intakeId={selectedIntakeId}
                intakeWorkspace={getIntakeWorkspace(selectedIntakeId)}
                onUpdateWorkspace={(updates) => updateSubmittedIntake(selectedIntakeId, updates)}
                firmLiveView={firmLiveView}
                firmLiveViewLoading={firmLiveViewLoading}
                onRequestFullAccess={
                  selectedRouteMeta && isSupabaseConfigured() && !firmLiveView?.isFirmCodeIntake
                    ? async () => {
                        const result = await intakeData.firmRequestFullAccess(selectedRouteMeta.routeId);
                        if (!result.error) {
                          setSelectedRouteMeta((prev) =>
                            prev && prev.routeId === selectedRouteMeta.routeId
                              ? { ...prev, routeStatus: 'access_requested' }
                              : prev
                          );
                          setFirmLiveView((prev) =>
                            prev && prev.routeId === selectedRouteMeta.routeId
                              ? { ...prev, routeStatus: 'access_requested' }
                              : prev
                          );
                          if (firmProfile) void refreshFirmDashboardRows(firmProfile);
                        }
                        return result;
                      }
                    : undefined
                }
                onOpenFirmSettings={() => setCurrentScreen('firmSettings')}
                onFirmSignOut={() => void handleSignOut()}
                firmDisplayName={
                  firmProfile && intakeData.isFirmProfileComplete(firmProfile)
                    ? firmProfile.firm_name
                    : undefined
                }
                firmBellNotifications={displayFirmBellNotifications}
                onAcceptIntake={
                  selectedRouteMeta && isSupabaseConfigured()
                    ? async () => {
                        const result = await intakeData.firmAcceptIntake(selectedRouteMeta.routeId);
                        if (!result.error) {
                          await reloadFirmLiveViewForSelection();
                          if (firmProfile) void refreshFirmDashboardRows(firmProfile);
                        }
                        return result;
                      }
                    : undefined
                }
                onDeclineIntake={
                  selectedRouteMeta && isSupabaseConfigured()
                    ? async () => {
                        const result = await intakeData.firmDeclineIntake(selectedRouteMeta.routeId);
                        if (!result.error) {
                          await reloadFirmLiveViewForSelection();
                          if (firmProfile) void refreshFirmDashboardRows(firmProfile);
                        }
                        return result;
                      }
                    : undefined
                }
                onRequestAdditionalDocuments={handleFirmRequestAdditionalDocuments}
                onReloadFirmLiveView={
                  selectedRouteMeta && isSupabaseConfigured()
                    ? () => reloadFirmLiveViewForSelection()
                    : undefined
                }
              />
              </IntakeReviewErrorBoundary>
            </motion.div>
          )}
          {currentScreen === 'firmSettings' && (
            <motion.div
              key="firmSettings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <FirmSettingsScreen
                onNavigate={navigateToScreen}
                firmProfile={firmProfile ?? undefined}
                firmBellNotifications={displayFirmBellNotifications}
                profileUserId={authUser?.id}
                profileEmail={authUser?.email ?? profile?.email ?? null}
                profileFullName={profile?.full_name ?? null}
                setupRequired={intakeData.firmProfileNeedsSetup(firmProfile)}
                onFirmProfileUpdated={(fp) => {
                  setFirmProfile(fp);
                  if (intakeData.isFirmProfileComplete(fp)) void refreshFirmDashboardRows(fp);
                }}
                onFirmProfileSaved={() => setCurrentScreen('firmDashboard')}
              />
            </motion.div>
          )}
          {currentScreen === 'workerSettings' &&
            (profile?.role === 'worker' || userRole === 'worker') &&
            isAuthenticated &&
            !!authUser?.id && (
            <motion.div
              key="workerSettings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <WorkerSettingsScreen
                onNavigate={navigateToScreen}
                userEmail={userEmail}
                profileId={authUser?.id ?? profile?.id ?? 'local-session'}
                onSignOut={() => void handleSignOut()}
              />
            </motion.div>
          )}
          {currentScreen === 'comparison' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="min-h-screen bg-slate-100 p-4"
            >
              {/* Toggle Controls */}
              <div className="mb-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setComparisonView('landing')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    comparisonView === 'landing'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Landing Page
                </button>
                <button
                  onClick={() => setComparisonView('both')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    comparisonView === 'both'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Side by Side
                </button>
                <button
                  onClick={() => setComparisonView('dashboard')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    comparisonView === 'dashboard'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Law Firm Dashboard
                </button>
              </div>

              {/* Content Area */}
              <div className={`${comparisonView === 'both' ? 'grid grid-cols-2 gap-6' : 'max-w-[1400px] mx-auto'}`}>
                {/* Landing Page */}
                {(comparisonView === 'landing' || comparisonView === 'both') && (
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {comparisonView === 'both' && (
                      <div className="bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                        Landing Page (Worker View)
                      </div>
                    )}
                    <div className="overflow-auto" style={{ height: comparisonView === 'both' ? 'calc(100vh - 140px)' : 'calc(100vh - 80px)' }}>
                      <div className={comparisonView === 'both' ? 'scale-[0.65] origin-top-left' : ''} style={comparisonView === 'both' ? { width: '153.85%' } : {}}>
                        <LandingScreen onNavigate={navigateToScreen} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Law Firm Dashboard */}
                {(comparisonView === 'dashboard' || comparisonView === 'both') && (
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {comparisonView === 'both' && (
                      <div className="bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                        Law Firm Dashboard
                      </div>
                    )}
                    <div className="overflow-auto" style={{ height: comparisonView === 'both' ? 'calc(100vh - 140px)' : 'calc(100vh - 80px)' }}>
                      <div className={comparisonView === 'both' ? 'scale-[0.65] origin-top-left' : ''} style={comparisonView === 'both' ? { width: '153.85%' } : {}}>
                        <LawFirmDashboardScreen
                          onNavigate={navigateToScreen}
                          onSelectIntake={(intakeId, meta) => {
                            setSelectedIntakeId(intakeId);
                            setSelectedRouteMeta(meta ?? null);
                            setCurrentScreen('intakeReview');
                          }}
                          submittedIntakes={SHOW_DEV_GALLERY ? submittedIntakes : []}
                          dbIntakes={undefined}
                          onViewSampleIntakeFlow={SHOW_SAMPLE_INTAKE ? openFirmSampleIntakeFlow : undefined}
                          firmBellNotifications={[]}
                          firmBanner={{
                            firmName: 'Sample Firm',
                            firmCode: 'EXAMPLE123',
                            activeCount: 0,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showWorkerBottomNavFallback && workerBottomNavShellScreen ? (
          <WorkerMobileBottomNav
            activeShellScreen={workerBottomNavShellScreen}
            mobileHubView="home"
            onNavigate={handleWorkerBottomNavFallback}
          />
        ) : null}

        {/* Exit Confirmation Modal */}
        <AnimatePresence>
          {showExitModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
              onClick={() => setShowExitModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md mx-4 mb-0 sm:mb-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">Leaving Workspace</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    You're leaving your current intake workspace. Progress that hasn't been saved may not be preserved.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={handleConfirmExit}
                      className="w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-colors font-medium"
                    >
                      Continue Leaving
                    </button>
                    <button
                      onClick={() => setShowExitModal(false)}
                      className="w-full bg-slate-100 text-slate-900 py-4 px-6 rounded-[14px] hover:bg-slate-200 transition-colors font-medium"
                    >
                      Stay Here
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
