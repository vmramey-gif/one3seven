/** Map API/Supabase errors to short beta-safe copy (console keeps raw details). */
export function toBetaUserMessage(raw: string | undefined | null, fallback: string): string {
  const msg = (raw ?? '').trim();
  if (!msg) return fallback;

  if (/firm code not found/i.test(msg)) return 'That firm code was not found. Check the code and try again.';
  if (/no active intake/i.test(msg)) return 'No active intake. Start organizing from your dashboard first.';
  if (/session|jwt|not authenticated|sign in/i.test(msg)) {
    return 'Your session may have expired. Sign in again and retry.';
  }
  if (/network|failed to fetch|fetch failed/i.test(msg)) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (/permission|policy|rls|403|401|row-level/i.test(msg)) {
    return 'You may not have access to complete this action. Sign in again or contact support.';
  }
  if (/timeout|timed out/i.test(msg)) return 'This took too long. Try again in a moment.';
  if (/JSON object requested|no rows|multiple.*rows|row.level.security/i.test(msg)) {
    return fallback;
  }
  if (/PGRST|postgres|supabase|violates|constraint/i.test(msg) || msg.length > 140) {
    return fallback;
  }
  return msg;
}
