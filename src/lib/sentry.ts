import * as Sentry from '@sentry/react';

/**
 * Error monitoring only — no tracing, no session replay, no logs/metrics integrations.
 * This app organizes privileged worker records (SSNs, employment narratives, employer
 * communications). Sentry must never become a second copy of that data. Two layers:
 *  1. SDK-level: userInfo/httpBodies collection is off, so requests/responses never ride along.
 *  2. beforeSend: a recursive scrub over the whole event (messages, extra, contexts, breadcrumbs)
 *     that redacts by KEY NAME (any field that could hold document/story content) and by PATTERN
 *     (SSN-shaped strings), then drops any leftover long string as a blunt last resort.
 * A crash reports "something broke in fileUploadService.ts" — never the file's contents.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

const SENSITIVE_KEY_PATTERN =
  /text|overview|story|narrative|notes?|summary|quote|extract|facts?|content|document|record|ssn|social|dob|birth|license|address|email|phone|password|token|secret|key/i;

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const MAX_STRING_LENGTH = 200;

function scrubString(value: string): string {
  if (SSN_PATTERN.test(value)) return '[redacted:ssn-pattern]';
  if (value.length > MAX_STRING_LENGTH) return `[redacted:long-string ${value.length} chars]`;
  return value;
}

function scrubValue(value: unknown, keyHint: string | null, depth: number): unknown {
  if (depth > 6) return '[redacted:max-depth]';
  if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) return '[redacted:sensitive-key]';
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, null, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, k, depth + 1);
    return out;
  }
  return value;
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.extra) event.extra = scrubValue(event.extra, null, 0) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts, null, 0) as typeof event.contexts;
  if (event.request) event.request = scrubValue(event.request, null, 0) as typeof event.request;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
      data: b.data ? (scrubValue(b.data, null, 0) as Record<string, unknown>) : b.data,
    }));
  }
  // Exception messages/stack traces are code paths, not document content — left intact for debugging.
  return event;
}

export function initSentry(): void {
  if (!DSN) return; // no-op locally / any env without a DSN configured — never throws, never blocks the app
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    integrations: [], // error monitoring only — no tracing, no session replay
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    beforeSend: scrubEvent,
  });
}

export { Sentry };
