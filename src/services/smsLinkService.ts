import { supabase, resolveFunctionsInvokeErrorMessage } from '../lib/supabaseClient';

export type WorkerSmsLink = {
  id: string;
  phoneNumber: string;
  status: 'pending_verification' | 'verified';
};

/** The worker's most recent phone link for this intake, if any (verified or awaiting a code). */
export async function loadSmsLink(intakeId: string): Promise<WorkerSmsLink | null> {
  const { data, error } = await supabase
    .from('worker_sms_links')
    .select('id, phone_number, status')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, phoneNumber: data.phone_number as string, status: data.status as WorkerSmsLink['status'] };
}

/** Sends a 6-digit code to phoneNumber (E.164) and stores an unverified link. */
export async function requestSmsLink(
  intakeId: string,
  phoneNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('sms-link-request', {
    body: { intakeId, phoneNumber },
  });
  if (error) return { ok: false, error: await resolveFunctionsInvokeErrorMessage(error) };
  if (data?.error) return { ok: false, error: String(data.error) };
  return { ok: true };
}

/** Confirms the code the worker received and flips the link to verified. */
export async function verifySmsLink(
  phoneNumber: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('sms-verify-phone', {
    body: { phoneNumber, code },
  });
  if (error) return { ok: false, error: await resolveFunctionsInvokeErrorMessage(error) };
  if (data?.error) return { ok: false, error: String(data.error) };
  return { ok: true };
}

export async function unlinkSmsPhone(linkId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('worker_sms_links').delete().eq('id', linkId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
