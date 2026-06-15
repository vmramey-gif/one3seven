import {
  isFirmCodeSubmissionChannel,
  isParticipatingSubmissionChannel,
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  workerParticipatingPreviewSent,
} from '../constants/one3sevenProduct';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { formatSourceFileChipLabel } from './workerIntakePresentationUtils';
import {
  isWorkerTimelineGapMoment,
  isWorkerTimelineKeyStoryMoment,
  presentWorkerTimelineRow,
  presentWorkerTimelineSourceCount,
} from './workerTimelineNarrative';

export type LiveTimelineMarkerKind = 'significant' | 'connected' | 'neutral' | 'gap' | 'action';

export type LiveTimelineMoment = {
  id: string;
  datePrimary: string;
  dateSecondary?: string;
  title: string;
  summary: string;
  sourceCount?: number;
  sourceFiles?: string[];
  markerKind: LiveTimelineMarkerKind;
  timelineEvent?: WorkerTimelineItem;
};

export type BuildWorkerLiveTimelineOpts = {
  events: WorkerTimelineItem[];
  recordCount: number;
  eventCount: number;
  gapCount?: number;
  workflow?: string | null;
  channel?: string | null;
  firmName?: string | null;
  firmCode?: string | null;
  routeSharedAt?: string | null;
  routeStatus?: string | null;
  docRequestPending?: boolean;
  accessApprovalPending?: boolean;
};

function formatMomentDate(dateStr: string | null | undefined): { primary: string; secondary?: string } {
  const raw = (dateStr ?? '').trim();
  if (!raw) return { primary: 'Recent' };
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts.slice(1).join(' ') };
  }
  return { primary: raw };
}

function workflowLiveMoment(
  workflow: string,
  ctx: { firmName?: string | null; channel?: string | null; recordCount: number; eventCount: number }
): Omit<LiveTimelineMoment, 'id'> | null {
  const w = workflow.trim();
  if (!w) return null;

  const firm = (ctx.firmName ?? '').trim() || 'your firm';

  const map: Record<string, { title: string; summary: string; markerKind: LiveTimelineMarkerKind }> = {
    'Upload Complete': {
      title: 'Records uploaded',
      summary: `${ctx.recordCount} record${ctx.recordCount === 1 ? '' : 's'} saved and ready to organize.`,
      markerKind: 'connected',
    },
    'Organizing Records': {
      title: 'Records organizing',
      summary: 'Your chronology is being assembled from uploaded files.',
      markerKind: 'connected',
    },
    'Intake Summary Generated': {
      title: 'Timeline reconstructed',
      summary: `${ctx.eventCount} key event${ctx.eventCount === 1 ? '' : 's'} identified across your records.`,
      markerKind: 'significant',
    },
    'Matching Participating Firms': {
      title: 'Submitted to participating firms',
      summary: 'Your intake remains active within the participating network.',
      markerKind: 'significant',
    },
    'Routed to Firm': {
      title: 'Sent to firm',
      summary: `Your packet was routed to ${firm}.`,
      markerKind: 'significant',
    },
    'Under Review': {
      title: 'Attorney review in progress',
      summary: `${firm} is reviewing your organized materials.`,
      markerKind: 'significant',
    },
    'Under Firm Review': {
      title: 'Attorney review in progress',
      summary: `${firm} is reviewing your organized records.`,
      markerKind: 'significant',
    },
    'Firm Interest Received': {
      title: 'Firm interest received',
      summary: 'A participating firm signaled interest in your intake.',
      markerKind: 'significant',
    },
    'Awaiting Worker Approval': {
      title: 'Review access requested',
      summary: `${firm} asked to open your full organized packet for review.`,
      markerKind: 'action',
    },
    'Shared with Participating Firm': {
      title: 'Worker approved access',
      summary: 'Expanded review access was approved for your connected firm.',
      markerKind: 'significant',
    },
    'Shared with Firm': {
      title: 'Shared with firm',
      summary: `Your organized packet was shared with ${firm}.`,
      markerKind: 'significant',
    },
    [WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED]: {
      title: 'Additional documents requested',
      summary: `${firm} asked for more records before continuing review.`,
      markerKind: 'action',
    },
    'Worker Uploaded Requested Documents': {
      title: 'Worker uploaded requested documents',
      summary: 'Requested records were submitted back to your firm for review.',
      markerKind: 'connected',
    },
  };

  const row = map[w];
  if (!row) return null;

  const { primary, secondary } = formatMomentDate(null);
  return {
    datePrimary: primary,
    dateSecondary: secondary,
    title: row.title,
    summary: row.summary,
    markerKind: row.markerKind,
  };
}

function timelineEventToMoment(event: WorkerTimelineItem, index: number): LiveTimelineMoment {
  const { title, summary } = presentWorkerTimelineRow(event);
  const sourceCount = presentWorkerTimelineSourceCount(event);
  const sourceFiles = (event.sourceFileNames ?? []).filter(Boolean);
  const { primary, secondary } = formatMomentDate(event.date ?? '');

  let markerKind: LiveTimelineMarkerKind = 'neutral';
  if (isWorkerTimelineGapMoment(event, title)) markerKind = 'gap';
  else if (isWorkerTimelineKeyStoryMoment(title, index)) markerKind = 'significant';
  else if (sourceCount > 0 || event.sourceStrength === 'strong' || event.sourceStrength === 'partial') {
    markerKind = 'connected';
  }

  return {
    id: event.timelineEventId ?? `event-${event.date}-${event.event}-${index}`,
    datePrimary: primary,
    dateSecondary: secondary,
    title,
    summary,
    sourceCount: sourceCount > 0 ? sourceCount : undefined,
    sourceFiles: sourceFiles.length > 0 ? sourceFiles : undefined,
    markerKind,
    timelineEvent: event,
  };
}

export function buildWorkerLiveTimelineMoments(opts: BuildWorkerLiveTimelineOpts): LiveTimelineMoment[] {
  const {
    events,
    recordCount,
    eventCount,
    workflow,
    channel,
    firmName,
    firmCode,
    routeSharedAt,
    routeStatus,
    docRequestPending,
    accessApprovalPending,
  } = opts;

  const moments: LiveTimelineMoment[] = [];
  const seenTitles = new Set<string>();

  const push = (moment: LiveTimelineMoment) => {
    const key = moment.title.toLowerCase();
    if (seenTitles.has(key)) return;
    seenTitles.add(key);
    moments.push(moment);
  };

  if (docRequestPending) {
    const firm = (firmName ?? '').trim() || 'Your firm';
    const date = formatMomentDate(routeSharedAt);
    push({
      id: 'status-doc-request',
      datePrimary: date.primary,
      dateSecondary: date.secondary,
      title: 'Additional documents requested',
      summary: `${firm} asked for more records before continuing review.`,
      markerKind: 'action',
    });
  }

  if (routeStatus === 'access_requested') {
    const firm = (firmName ?? '').trim() || 'A participating firm';
    push({
      id: 'status-route-access-requested',
      datePrimary: 'Recent',
      title: 'Review access requested',
      summary: `${firm} asked to open your full organized packet for review.`,
      markerKind: 'action',
    });
  }

  if (routeStatus === 'full_access') {
    push({
      id: 'status-route-full-access',
      datePrimary: 'Recent',
      title: 'Worker approved access',
      summary: 'Expanded review access is open for the connected firm.',
      markerKind: 'significant',
    });
  }

  if (routeStatus === 'accepted') {
    const firm = (firmName ?? '').trim() || 'Your firm';
    push({
      id: 'status-route-attorney-review',
      datePrimary: 'Recent',
      title: 'Attorney review in progress',
      summary: `${firm} is reviewing your organized materials.`,
      markerKind: 'significant',
    });
  }

  if (accessApprovalPending) {
    const firm = (firmName ?? '').trim() || 'A participating firm';
    push({
      id: 'status-access-request',
      datePrimary: 'Recent',
      title: 'Review access requested',
      summary: `${firm} asked to open your full organized packet for review.`,
      markerKind: 'action',
    });
  }

  const workflowRow = workflow ? workflowLiveMoment(workflow, { firmName, channel, recordCount, eventCount }) : null;
  if (workflowRow) {
    const date = formatMomentDate(routeSharedAt);
    push({
      id: `status-${workflow}`,
      ...workflowRow,
      datePrimary: date.primary !== 'Recent' ? date.primary : workflowRow.datePrimary,
      dateSecondary: date.secondary ?? workflowRow.dateSecondary,
    });
  }

  if ((firmCode ?? '').trim() && isFirmCodeSubmissionChannel(channel)) {
    const firm = (firmName ?? '').trim() || 'your firm';
    push({
      id: 'status-firm-code',
      datePrimary: formatMomentDate(routeSharedAt).primary,
      dateSecondary: formatMomentDate(routeSharedAt).secondary,
      title: 'Firm code added',
      summary: `Your intake is connected to ${firm}.`,
      markerKind: 'significant',
    });
  }

  if (
    isParticipatingSubmissionChannel(channel) &&
    workerParticipatingPreviewSent(channel, workflow ?? '') &&
    workflow !== 'Matching Participating Firms'
  ) {
    push({
      id: 'status-participating-sent',
      datePrimary: formatMomentDate(routeSharedAt).primary,
      title: 'Submitted to participating firms',
      summary: 'Your intake remains active within the participating network.',
      markerKind: 'significant',
    });
  }

  for (let i = 0; i < events.length; i++) {
    push(timelineEventToMoment(events[i], i));
  }

  if (moments.length === 0 && recordCount > 0) {
    push({
      id: 'status-records-uploaded',
      datePrimary: 'Recent',
      title: 'Records uploaded',
      summary: `${recordCount} record${recordCount === 1 ? '' : 's'} saved — your chronology will appear as events are identified.`,
      markerKind: 'connected',
      sourceCount: recordCount,
    });
  }

  return moments.slice(0, 16);
}

export function formatLiveTimelineFileLabel(name: string): string {
  return formatSourceFileChipLabel(name);
}
