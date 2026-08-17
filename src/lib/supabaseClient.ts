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

/**
 * `supabase.functions.invoke()` throws `FunctionsHttpError` for any non-2xx edge function
 * response with `.message` hardcoded to the generic "Edge Function returned a non-2xx status
 * code" -- the real, server-crafted error message (e.g. "That code is not right.", "Stripe not
 * configured") lives unread in the raw Response on `.context`, since the client library throws
 * before ever parsing the body. Every edge-function caller in this codebase was silently
 * discarding those real messages until this helper existed (worker audit finding, 2026-08-17).
 * Reads `.context`'s body once (cloned, so anything else inspecting `.context` -- e.g. `.status`
 * -- still can) and falls back to the generic message when the body isn't our usual `{error}`
 * JSON shape (network-level errors like FunctionsFetchError/FunctionsRelayError have no Response
 * on `.context` at all, and their own generic messages are already reasonably descriptive).
 */
export async function resolveFunctionsInvokeErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Something went wrong. Try again.';
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== 'object' || typeof (context as Response).json !== 'function') {
    return fallback;
  }
  try {
    const body: unknown = await (context as Response).clone().json();
    const bodyError = (body as { error?: unknown } | null)?.error;
    if (typeof bodyError === 'string' && bodyError.trim()) return bodyError;
  } catch {
    /* body wasn't JSON, or the Response was already consumed elsewhere -- use the fallback */
  }
  return fallback;
}

