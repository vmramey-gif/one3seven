import { supabase } from '../lib/supabaseClient';

/** Shorter per-step timeout for diagnostic probes (does not affect production save timeouts). */
export const DB_DIAG_STEP_TIMEOUT_MS = 8_000;

export type DbDiagStepResult = {
  step: string;
  durationMs: number;
  ok: boolean;
  timedOut: boolean;
  error?: string;
  detail?: Record<string, unknown>;
};

async function withDiagTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`[o3s-db-diag] ${label} timed out after ${DB_DIAG_STEP_TIMEOUT_MS}ms`)),
      DB_DIAG_STEP_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/**
 * TEMPORARY: sequential Supabase health probes after sign-in (console-only).
 * Remove when auth-lock / local dev DB latency is resolved.
 */
export async function runSupabaseSetupDiagnostics(
  userId: string,
  opts?: { email?: string | null; label?: string }
): Promise<{ results: DbDiagStepResult[]; summary: string }> {
  const label = opts?.label ?? 'post-sign-in';
  const results: DbDiagStepResult[] = [];
  console.info('[o3s-db-diag] sequence start', { label, userId });

  const runStep = async (step: string, fn: () => Promise<Record<string, unknown> | void>) => {
    const t0 = performance.now();
    let timedOut = false;
    let error: string | undefined;
    let detail: Record<string, unknown> | undefined;
    try {
      const out = await withDiagTimeout(step, fn());
      if (out && typeof out === 'object') detail = out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error = msg;
      timedOut = msg.includes('timed out');
    }
    const durationMs = Math.round(performance.now() - t0);
    const ok = !error && !timedOut;
    const row: DbDiagStepResult = { step, durationMs, ok, timedOut, error, detail };
    results.push(row);
    console.info('[o3s-db-diag] step', { label, ...row });
  };

  await runStep('auth.getSession', async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      hasSession: Boolean(data.session),
      sessionUserId: data.session?.user?.id ?? null,
      matchesUserId: data.session?.user?.id === userId,
    };
  });

  await runStep('profiles.select', async () => {
    const { data, error } = await supabase.from('profiles').select('id, role, email').eq('id', userId).maybeSingle();
    if (error) throw error;
    return { hasRow: Boolean(data), role: (data as { role?: string } | null)?.role ?? null };
  });

  await runStep('profiles.upsertRole', async () => {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, email: opts?.email ?? null, role: 'firm' }, { onConflict: 'id' });
    if (error) throw error;
    return { wrote: true };
  });

  await runStep('profiles.updateRole', async () => {
    const { error } = await supabase.from('profiles').update({ role: 'firm' }).eq('id', userId);
    if (error) throw error;
    return { wrote: true };
  });

  await runStep('firm_profiles.select', async () => {
    const { data, error } = await supabase
      .from('firm_profiles')
      .select('id, firm_code, firm_name')
      .eq('profile_id', userId)
      .maybeSingle();
    if (error) throw error;
    return { hasRow: Boolean(data), firmCode: (data as { firm_code?: string } | null)?.firm_code ?? null };
  });

  await runStep('firm_profiles.updateProbe', async () => {
    const { data, error } = await supabase
      .from('firm_profiles')
      .update({ firm_name: '___o3s_diag_probe___' })
      .eq('profile_id', userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return { matchedRow: Boolean(data) };
  });

  await runStep('intakes.selectControl', async () => {
    const { data, error } = await supabase.from('intakes').select('id').limit(1);
    if (error) throw error;
    return { rowCount: Array.isArray(data) ? data.length : 0 };
  });

  const firstFail = results.find((r) => !r.ok);
  const firstHang = results.find((r) => r.timedOut);
  const summary = firstHang
    ? `First timeout: ${firstHang.step} (${firstHang.durationMs}ms) [${label}]`
    : firstFail
      ? `First error: ${firstFail.step} — ${firstFail.error ?? 'unknown'} [${label}]`
      : `All ${results.length} diagnostic steps OK [${label}]`;
  console.info('[o3s-db-diag] sequence complete', { label, summary, results });
  return { results, summary };
}
