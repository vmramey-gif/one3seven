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
    void supabase.from('web_events').insert({
      event,
      path: window.location.pathname,
      referrer: document.referrer || null,
      session_id: sessionId(),
      props: props ?? null,
    });
  } catch {
    /* analytics never breaks the app */
  }
}

export function pageview(): void {
  track('pageview');
}
