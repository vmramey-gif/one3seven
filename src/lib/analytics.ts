/**
 * First-party, cookieless funnel analytics. Fire-and-forget inserts into web_events.
 * No PII is ever collected — only event names + path/referrer + a per-tab random session id.
 * Honors Do-Not-Track. Never throws (analytics must not break UX).
 */
import { supabase } from './supabaseClient';
import { isSupabaseConfigured } from './supabaseClient';

const SID_KEY = 'o3s_sid';

function dntEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return 'no-session';
  }
}

/** Log a named funnel event. Props must never contain PII (no form values, names, emails). */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined' || dntEnabled() || !isSupabaseConfigured()) return;
    // supabase-js queries are lazy — the request only fires when the builder is
    // awaited or .then()'d. A bare `void insert(...)` NEVER sends. Attach a
    // no-op .then() so the insert actually executes (and never rejects loudly).
    supabase
      .from('web_events')
      .insert({
        event,
        path: window.location.pathname,
        referrer: document.referrer || null,
        session_id: sessionId(),
        props: props ?? null,
      })
      .then(undefined, () => { /* analytics never breaks the app */ });
  } catch {
    /* analytics never breaks the app */
  }
}

export function pageview(): void {
  track('pageview');
}

/**
 * Log a pageview with an explicit logical path (for SPA in-app navigation, where
 * window.location.pathname doesn't change). Used for screen-level analytics.
 */
export function pageviewPath(path: string): void {
  try {
    if (typeof window === 'undefined' || dntEnabled() || !isSupabaseConfigured()) return;
    supabase
      .from('web_events')
      .insert({
        event: 'pageview',
        path,
        referrer: document.referrer || null,
        session_id: sessionId(),
        props: null,
      })
      .then(undefined, () => { /* analytics never breaks the app */ });
  } catch {
    /* analytics never breaks the app */
  }
}

let heartbeatStarted = false;
/**
 * Periodic heartbeat so session length is measurable: a session's duration is the time
 * between its first and last web_events row. Only beats while the tab is visible. Idempotent.
 */
export function startHeartbeat(): void {
  try {
    if (heartbeatStarted || typeof window === 'undefined' || dntEnabled() || !isSupabaseConfigured()) return;
    heartbeatStarted = true;
    const beat = () => { if (document.visibilityState === 'visible') track('heartbeat'); };
    window.setTimeout(beat, 15000);
    window.setInterval(beat, 30000);
  } catch {
    /* analytics never breaks the app */
  }
}
