import {
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS,
  isParticipatingSubmissionChannel,
  workerParticipatingPreviewSent,
} from '../constants/one3sevenProduct';
import type { AppNotificationItem } from '../components/NotificationsBell';

export function resolveHomeGreeting(
  name: string | null | undefined,
  workflow: string | null | undefined,
  channel: string | null | undefined
): { headline: string; subline: string } {
  const w = (workflow ?? '').trim();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name?.trim().split(/\s+/)[0];

  const headline = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;

  if (!w || w === 'Upload Complete' || w === 'Organizing Records') {
    return {
      headline,
      subline: firstName
        ? 'Your intake is taking shape.'
        : "Let's organize what happened, one step at a time.",
    };
  }
  if (w === 'Intake Summary Generated') {
    return {
      headline,
      subline: "Your records are organized. We'll update you here.",
    };
  }
  if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED) {
    return {
      headline,
      subline: "Additional records have been requested. We'll guide you through the next steps.",
    };
  }
  if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) {
    return {
      headline,
      subline: "Your additional records are under review. We'll keep you informed here.",
    };
  }
  if (
    isParticipatingSubmissionChannel(channel) ||
    workerParticipatingPreviewSent(channel, w) ||
    w === 'Matching Participating Firms' ||
    w === 'Under Review' ||
    w === 'Firm Interest Received' ||
    w === 'Awaiting Worker Approval' ||
    w === 'Shared with Participating Firm'
  ) {
    return {
      headline,
      subline: "A participating firm is reviewing your intake. We'll keep you informed here.",
    };
  }
  if (w === 'Routed to Firm' || w === 'Under Firm Review' || w === 'Shared with Firm') {
    return {
      headline,
      subline: "Your firm is reviewing your intake. We'll keep you informed here.",
    };
  }

  return {
    headline,
    subline: "We'll update you here.",
  };
}

export function buildRecentProcessActivity(opts: {
  workflow?: string | null;
  routeStatus?: string | null;
  docRequestPending?: boolean;
  notifications?: AppNotificationItem[];
}): string[] {
  const items: string[] = [];
  const w = (opts.workflow ?? '').trim();
  const route = (opts.routeStatus ?? '').trim();

  if (route === 'access_requested' || w === 'Awaiting Worker Approval') {
    items.push('Review access requested');
  }
  if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED || opts.docRequestPending) {
    items.push('Additional records requested');
  }
  if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) {
    items.push('Additional records sent for review');
  }
  if (w === 'Intake Summary Generated') {
    items.push('Summary generated');
  }
  if (w === 'Matching Participating Firms') {
    items.push('Preview sent to participating firms');
  }
  if (route === 'full_access' || w === 'Shared with Participating Firm' || w === 'Shared with Firm') {
    items.push('Expanded review access approved');
  }
  if (w === 'Upload Complete' || w === 'Organizing Records') {
    items.push('Records received');
  }

  for (const n of opts.notifications ?? []) {
    const title = n.title?.trim();
    if (!title) continue;
    const lower = title.toLowerCase();
    if (lower.includes('document') && lower.includes('request')) {
      if (!items.includes('Additional records requested')) items.push('Additional records requested');
      continue;
    }
    if (lower.includes('access') && lower.includes('request')) {
      if (!items.includes('Review access requested')) items.push('Review access requested');
      continue;
    }
    if (lower.includes('access') && lower.includes('grant')) {
      if (!items.includes('Expanded review access approved')) {
        items.push('Expanded review access approved');
      }
    }
  }

  return [...new Set(items)].slice(0, 3);
}
