import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are set (Supabase-backed flows can run). */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Supabase browser client (singleton — not recreated per render).
 * When env is missing, returns a client pointed at placeholder URLs so the app still bundles.
 * Do not call `supabase.from(...)` inside `onAuthStateChange` without deferring: the auth layer
 * holds an internal lock until the callback returns (see POST_AUTH_DEFER_MS in App.tsx).
 * TODO: surface a dedicated "configure Supabase" screen instead of silent failures.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/** TEMPORARY audit: remove after debugging Auth signup. Logs masked anon key + URL host. */
function o3sAuthAuditLogClientInit() {
  if (typeof window === 'undefined') return;
  const key = supabaseAnonKey ?? '';
  const anonSummary =
    !key || key === 'placeholder-anon-key'
      ? '(missing or placeholder)'
      : `${key.slice(0, 8)}…${key.slice(-4)} (len=${key.length})`;
  let urlHost = '(none)';
  try {
    if (supabaseUrl) urlHost = new URL(supabaseUrl).host;
  } catch {
    urlHost = '(invalid URL string)';
  }
  console.info('[o3s-auth-audit] Supabase browser client', {
    envVarsPresent: Boolean(supabaseUrl && supabaseAnonKey),
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    urlHost,
    anonKey: anonSummary,
  });
}
o3sAuthAuditLogClientInit();

