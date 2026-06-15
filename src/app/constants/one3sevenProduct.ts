/**
 * one3Seven product positioning — calm workflow language only.
 */

/** Full UPL-safe disclaimer — single source for footers, exports, and modals. */
export const ONE3SEVEN_UNIVERSAL_DISCLAIMER =
  'one3Seven is not a law firm and does not provide legal advice. Use of one3Seven does not create an attorney-client relationship. Attorneys and firms independently evaluate information submitted through the platform. No outcome, representation, review, attorney response, or claim validity is guaranteed.';

export const ONE3SEVEN_NOTICES = {
  positioning: ONE3SEVEN_UNIVERSAL_DISCLAIMER,
} as const;

/** Upload privacy guidance without duplicating the universal disclaimer. */
export const UPLOAD_REDACTION_NOTICE =
  'Upload only records you feel comfortable sharing. You may redact Social Security numbers, banking details, medical record numbers, minors’ full details, or unrelated personal information before upload.';

export const UPLOAD_PRIVACY_NOTICE = UPLOAD_REDACTION_NOTICE;

/** Worker-facing pipeline labels (exact strings; also stored in intakes.workflow_status when using Supabase). */
export const WORKER_WORKFLOW_STATUSES = [
  'Upload Complete',
  'Organizing Records',
  'Intake Summary Generated',
  'Matching Participating Firms',
  'Under Review',
  'Firm Interest Received',
  'Awaiting Worker Approval',
  'Shared with Participating Firm',
] as const;

export type WorkerWorkflowStatus = (typeof WORKER_WORKFLOW_STATUSES)[number];

export const PARTICIPATING_NETWORK_IDLE = {
  noRequestsYet:
    'Your intake remains active in the participating review network. No firm has requested expanded access yet.',
  expanding: 'Additional participating firms may continue reviewing your limited preview over time.',
  intakeActive:
    'You stay in control: your full organized packet is not shared until you approve a firm’s access request.',
} as const;

/** Worker-facing copy for no–firm-code / participating-network routing (not firm-code direct send). */
export const PARTICIPATING_NETWORK_COPY = {
  channelLabel: 'Participating firm network',
  channelShort:
    'You chose the participating review network—not a direct firm-code link. Firms see a limited preview first.',
  beforeSendTitle: 'Ready to share a limited preview',
  beforeSendBody:
    'After you send, participating firms can review a limited preview of your organized intake. Your full packet and private notes stay with you until you approve expanded access.',
  postSendTitle: 'Your intake is in the participating review pool',
  postSendBody:
    'Participating firms can review a limited preview of your organized summary and timeline. This is not a direct handoff to one firm—you approve expanded access if a firm asks.',
  firmsSeeNow: 'Firms can see now: organized preview, timeline structure, and high-level record categories.',
  firmsDoNotSee:
    'Firms do not see yet: your full file contents, personal narrative, or private notes—unless you approve expanded review access.',
  accessRequestPending:
    'A participating firm requested expanded review access. Approve below when you are ready to share your full organized packet with that firm.',
  accessApproved:
    'You approved expanded review access. That firm can open your full organized intake in one3Seven for continued review.',
  shareModalTitle: 'Send to participating firms',
  shareModalBody:
    'Sends a limited preview to the participating review network. This is separate from entering a firm code for a firm you already work with.',
  zeroRoutesAvailable:
    'No participating firms are currently available in this beta workspace. You can save this intake or connect a firm directly with a firm code.',
} as const;

/** Tracker when submission_channel is participating (distinct from direct firm-code routing). */
export const WORKER_PARTICIPATING_TRACKER_STEPS = [
  'Records organized',
  'Preview sent to participating firms',
  'Under review in the network',
  'Firm interest or access request',
  'You approve expanded access (if needed)',
  'Shared for full firm review',
  'Additional records (if requested)',
] as const;

export function isParticipatingSubmissionChannel(channel: string | null | undefined): boolean {
  return (channel ?? '').trim() === 'participating';
}

export function isFirmCodeSubmissionChannel(channel: string | null | undefined): boolean {
  return (channel ?? '').trim() === 'firm_code';
}

/** Firm dashboard / export labels — never infer firm code from visibility alone. */
export type FirmSubmissionTypeDisplay = 'Firm Code' | 'Participating Firm Review' | 'Not yet routed';

/**
 * Resolve how an intake reached a firm. Requires a saved `submission_channel` of `firm_code`
 * with `linked_firm_id` matching the route's firm. Participating routes use the review pool label.
 */
export function resolveFirmSubmissionTypeDisplay(opts: {
  submissionChannel: string | null | undefined;
  linkedFirmId: string | null | undefined;
  routeFirmId: string | null | undefined;
  hasFirmIntakeRoute?: boolean;
}): FirmSubmissionTypeDisplay {
  if (
    resolveIsFirmCodeRoutedIntake({
      submissionChannel: opts.submissionChannel,
      linkedFirmId: opts.linkedFirmId,
      routeFirmId: opts.routeFirmId,
    })
  ) {
    return 'Firm Code';
  }
  if (opts.hasFirmIntakeRoute !== false && (opts.routeFirmId ?? '').trim()) {
    return 'Participating Firm Review';
  }
  return 'Not yet routed';
}

/** True only when the worker saved firm-code routing for this firm (not mere visibility). */
export function resolveIsFirmCodeRoutedIntake(opts: {
  submissionChannel: string | null | undefined;
  linkedFirmId: string | null | undefined;
  routeFirmId: string | null | undefined;
}): boolean {
  const linked = (opts.linkedFirmId ?? '').trim();
  const routeFirm = (opts.routeFirmId ?? '').trim();
  return isFirmCodeSubmissionChannel(opts.submissionChannel) && Boolean(linked && routeFirm && linked === routeFirm);
}

/** Worker-facing submission channel from persisted intake row only (no linked_firm inference). */
export function normalizePersistedSubmissionChannel(
  submissionChannel: string | null | undefined
): string | null {
  const channel = (submissionChannel ?? '').trim();
  return channel || null;
}

/** True when a firm_intake_routes row exists for the linked firm (intake was shared at least once). */
export function linkedFirmIntakeAlreadyShared(routeStatus: string | null | undefined): boolean {
  return Boolean((routeStatus ?? '').trim());
}

/** Worker-facing “last shared” line (e.g. May 26 at 4:41 PM). */
export function formatLinkedFirmLastSharedAt(iso: string | null | undefined): string | null {
  const raw = (iso ?? '').trim();
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleString(undefined, {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function linkedFirmSendButtonLabel(
  firmName: string | null | undefined,
  alreadyShared: boolean
): string {
  const name = firmName?.trim() || 'your firm';
  return alreadyShared ? `Send Updated Intake to ${name}` : `Send Organized Intake to ${name}`;
}

/** Shorter label for share modal primary CTA. */
export function linkedFirmShareModalButtonLabel(
  firmName: string | null | undefined,
  alreadyShared: boolean
): string {
  const name = firmName?.trim() || 'linked firm';
  return alreadyShared ? `Send updated intake to ${name}` : `Send to ${name}`;
}

export function formatRouteStatusForWorker(
  routeStatus: string | null | undefined,
  channel: string | null | undefined
): string | null {
  const s = (routeStatus ?? '').trim();
  if (isParticipatingSubmissionChannel(channel)) {
    if (!s || s === 'preview_sent') {
      return 'Limited preview active in the participating review pool';
    }
    if (s === 'access_requested') return 'A firm requested expanded review access';
    if (s === 'full_access') return 'Expanded review access you approved';
    if (s === 'accepted') return 'Routed into review workflow';
    return s.replace(/_/g, ' ');
  }
  if (!s) return 'Linked — organize and send when ready';
  if (s === 'preview_sent') return 'Sent to firm for review';
  if (s === 'full_access') return 'Direct full review access';
  return s.replace(/_/g, ' ');
}

export function formatRouteStatusForFirm(
  routeStatus: string | null | undefined,
  isFirmCodeIntake: boolean
): string {
  if (isFirmCodeIntake) {
    return 'Direct firm-code intake — full record review (no access approval step)';
  }
  const s = (routeStatus ?? '').trim();
  if (s === 'preview_sent') return 'Limited preview only — approval required for full access';
  if (s === 'access_requested') return 'Full access requested — awaiting record owner approval';
  if (s === 'full_access') return 'Full access approved — files available';
  if (s === 'accepted') return 'Intake added for follow-up';
  return 'Full intake access';
}

export function getWorkerTrackerSteps(channel: string | null | undefined): readonly string[] {
  return isParticipatingSubmissionChannel(channel)
    ? WORKER_PARTICIPATING_TRACKER_STEPS
    : WORKER_LIVE_STATUS_TRACKER_STEPS;
}

/** User-facing tracker labels (internal workflow_status strings unchanged). */
const WORKER_TRACKER_STEP_DISPLAY: Record<string, string> = {
  'Upload Complete': 'Upload complete',
  'Intake Summary Generated': 'Organized summary ready',
  'Routed to Firm': 'Sent to firm',
  'Under Firm Review': 'Under firm review',
  'Firm Interest Received': 'Firm interest received',
  'Additional Documents Requested': 'Additional records requested',
  'Worker Uploaded Additional Documents': 'Additional records uploaded',
  'Worker Uploaded Requested Documents': 'Requested records submitted',
  'Shared with Firm': 'Shared with firm',
  'Records organized': 'Records organized',
  'Preview sent to participating firms': 'Preview sent to participating firms',
  'Under review in the network': 'Under review in the network',
  'Firm interest or access request': 'Firm interest or access request',
  'You approve expanded access (if needed)': 'You approve expanded access (if needed)',
  'Shared for full firm review': 'Shared for full firm review',
  'Additional records (if requested)': 'Additional records (if requested)',
};

export function formatWorkerTrackerStepForDisplay(step: string): string {
  const key = step.trim();
  return WORKER_TRACKER_STEP_DISPLAY[key] ?? key;
}

export function getWorkerTrackerStepsForDisplay(
  channel: string | null | undefined
): readonly string[] {
  return getWorkerTrackerSteps(channel).map(formatWorkerTrackerStepForDisplay);
}

export const FIRM_ROUTING_COPY = {
  sendOrganizedIntro:
    'Already working with a law firm? Enter their one3Seven Firm Code to route this organized intake directly to their dashboard.',
  firmCodeHelper:
    'Firm Code routing is for people already connected with a law firm. Participating Firms routing allows one3Seven to send a limited preview to matching participating firms.',
  firmCodeFieldHelp:
    "Enter your law firm's one3Seven Firm Code to route this organized intake directly to their dashboard.",
  participatingShort:
    'Share a limited preview with the participating review network (not a direct firm-code link).',
  firmCodeNotFound:
    "We couldn't find that Firm Code yet. Please confirm the code with your law firm or continue without routing.",
} as const;

/** Labeled demo intake for dashboards when sample mode is on and lists are empty. */
export const SAMPLE_INTAKE_NUMBER = '137-DEMO';
/** Premium UI label for sample firm intake preview (internal id remains {@link SAMPLE_INTAKE_NUMBER}). */
export const SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL = 'Limited Intake Preview';
export const SAMPLE_DEMO_LABEL = 'Demo preview';
export const SAMPLE_INTAKE_SUMMARY_LABEL = 'Sample Intake Summary';

/** Single demo intake copy — only shown when `SHOW_SAMPLE_INTAKE` is true. */
export const SAMPLE_INTAKE_SUMMARY_PREVIEW = {
  intakeNumber: SAMPLE_INTAKE_NUMBER,
  status: 'Intake Summary Generated',
  categories: ['Payroll', 'Scheduling', 'HR Communication'] as const,
  timelineSummary:
    'Records span multiple pay periods with corresponding schedule communications. Dates and document types are summarized without conclusions about outcomes.',
  missingDocuments: 'Additional schedule records may help complete the timeline.',
  workerDisplay: 'Sample record owner',
  workerInitials: 'V.R.',
} as const;

/** Worker dashboard live tracker (aligned with firm-side workflow wording). */
export const WORKER_LIVE_STATUS_TRACKER_STEPS = [
  'Upload Complete',
  'Intake Summary Generated',
  'Routed to Firm',
  'Under Firm Review',
  'Firm Interest Received',
  'Additional Documents Requested',
  'Worker Uploaded Additional Documents',
  'Shared with Firm',
] as const;

/** Exact `intakes.workflow_status` values for firm document-request loop (no fuzzy matching). */
export const WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED = 'Additional Documents Requested' as const;
/** Persisted `intakes.workflow_status` after worker confirms additional documents. */
export const WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS =
  'Worker Uploaded Requested Documents' as const;
/** Worker-facing label only (not written to `workflow_status`). */
export const WORKFLOW_WORKER_UPLOADED_ADDITIONAL_DOCUMENTS_DISPLAY =
  'Additional records uploaded' as const;

export function isWorkerUploadedAdditionalDocumentsWorkflow(
  status: string | null | undefined
): boolean {
  const s = (status ?? '').trim();
  return (
    s === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS ||
    s === WORKFLOW_WORKER_UPLOADED_ADDITIONAL_DOCUMENTS_DISPLAY
  );
}

const PARTICIPATING_WORKFLOW_DISPLAY: Record<string, string> = {
  'Matching Participating Firms': 'Your intake has been sent to participating review firms',
  'Under Review': 'A participating firm is reviewing your intake',
  'Firm Interest Received': 'A participating firm expressed interest in reviewing your organized intake',
  'Awaiting Worker Approval': 'A firm wants to review your full intake — your approval is needed',
  'Shared with Participating Firm': 'Your full intake has been shared with a firm',
  'Additional Documents Requested': 'The firm has requested additional documents from you',
};

/** User-facing workflow labels (DB `workflow_status` values stay unchanged). */
const WORKER_WORKFLOW_STATUS_DISPLAY: Record<string, string> = {
  'Upload Complete': 'Your documents have been uploaded',
  'Organizing Records': 'Your records are being organized',
  'Intake Summary Generated': 'Your intake is organized and ready to share',
  'Matching Participating Firms': 'Your intake has been sent to participating review firms',
  'Routed to Firm': 'Your intake has been sent to a firm',
  'Under Review': 'A firm is reviewing your intake',
  'Under Firm Review': 'A firm is reviewing your intake',
  'Firm Interest Received': 'A firm expressed interest in reviewing your organized intake',
  'Awaiting Worker Approval': 'A firm wants to review your full intake — your approval is needed',
  'Shared with Participating Firm': 'Your full intake has been shared with a firm',
  'Shared with Firm': 'Your full intake has been shared with the firm',
  'Additional Documents Requested': 'The firm has requested additional documents from you',
  'Worker Uploaded Requested Documents': 'You have submitted the requested documents',
};

export function formatWorkerWorkflowStatusForDisplay(
  status: string | null | undefined,
  channel?: string | null
): string {
  const s = (status ?? '').trim();
  if (isWorkerUploadedAdditionalDocumentsWorkflow(s)) {
    return WORKFLOW_WORKER_UPLOADED_ADDITIONAL_DOCUMENTS_DISPLAY;
  }
  if (isParticipatingSubmissionChannel(channel) && PARTICIPATING_WORKFLOW_DISPLAY[s]) {
    return PARTICIPATING_WORKFLOW_DISPLAY[s];
  }
  if (WORKER_WORKFLOW_STATUS_DISPLAY[s]) {
    return WORKER_WORKFLOW_STATUS_DISPLAY[s];
  }
  return s;
}

export function workerParticipatingPreviewSent(
  channel: string | null | undefined,
  workflow: string | null | undefined
): boolean {
  if (!isParticipatingSubmissionChannel(channel)) return false;
  const w = (workflow ?? '').trim();
  if (!w) return false;
  if (w === 'Intake Summary Generated') return false;
  if (w === 'Upload Complete' || w === 'Organizing Records') return false;
  return true;
}

const WORKFLOW_TO_TRACKER_INDEX: Record<string, number> = {
  'Upload Complete': 0,
  'Organizing Records': 0,
  'Intake Summary Generated': 1,
  'Matching Participating Firms': 2,
  'Routed to Firm': 2,
  'Under Review': 3,
  'Under Firm Review': 3,
  'Firm Interest Received': 4,
  'Awaiting Worker Approval': 4,
  'Additional Documents Requested': 5,
  'Worker Uploaded Additional Documents': 6,
  'Worker Uploaded Requested Documents': 6,
  'Shared with Participating Firm': 7,
  'Shared with Firm': 7,
};

const PARTICIPATING_WORKFLOW_TO_TRACKER_INDEX: Record<string, number> = {
  'Upload Complete': 0,
  'Organizing Records': 0,
  'Intake Summary Generated': 0,
  'Matching Participating Firms': 1,
  'Under Review': 2,
  'Firm Interest Received': 3,
  'Awaiting Worker Approval': 3,
  'Shared with Participating Firm': 5,
  'Additional Documents Requested': 6,
  'Worker Uploaded Additional Documents': 6,
  'Worker Uploaded Requested Documents': 6,
};

/** Returns index of the active tracker step (firm-code: 0–7; participating: 0–6). */
export function getWorkerIntakeTrackerActiveIndex(
  workflow: string | null | undefined,
  channel?: string | null
): number {
  const w = (workflow ?? '').trim();
  if (!w) return 0;

  if (isParticipatingSubmissionChannel(channel)) {
    if (PARTICIPATING_WORKFLOW_TO_TRACKER_INDEX[w] !== undefined) {
      return PARTICIPATING_WORKFLOW_TO_TRACKER_INDEX[w];
    }
    const lower = w.toLowerCase();
    if (lower.includes('organizing') || lower.includes('summary')) return 0;
    if (lower.includes('matching') || lower.includes('sent')) return 1;
    if (lower.includes('under review')) return 2;
    if (lower.includes('interest') || lower.includes('approval')) return 3;
    if (lower.includes('shared')) return 5;
    if (lower.includes('additional documents') || lower.includes('uploaded requested')) return 6;
    return 1;
  }

  if (WORKFLOW_TO_TRACKER_INDEX[w] !== undefined) return WORKFLOW_TO_TRACKER_INDEX[w];
  const lower = w.toLowerCase();
  if (lower.includes('organizing')) return 0;
  if (lower.includes('summary')) return 1;
  if (lower.includes('matching') || lower.includes('routed')) return 2;
  if (lower.includes('review')) return 3;
  if (lower.includes('interest') || lower.includes('approval')) return 4;
  if (lower.includes('additional documents')) return 5;
  if (lower.includes('uploaded requested')) return 6;
  if (lower.includes('shared')) return 7;
  return 1;
}

/** True when organization was in progress but may have been interrupted (e.g. browser refresh). */
export function isInterruptedOrganizationWorkflowStatus(workflow: string | null | undefined): boolean {
  const w = (workflow ?? '').trim();
  if (!w) return false;
  if (w === 'Organizing Records') return true;
  const lower = w.toLowerCase();
  if (lower === 'processing' || lower === 'organizing') return true;
  if (lower.includes('organizing record')) return true;
  return false;
}
