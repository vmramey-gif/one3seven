import { supabase } from '../lib/supabaseClient';

export type PilotInterestInput = {
  name: string;
  firmName: string;
  email: string;
  note: string;
};

/**
 * Record an attorney's pilot-access interest. Inserts into public.pilot_interest, which has
 * an insert-only RLS policy for anon/authenticated and no read policy (founder reads via the
 * service role / Supabase dashboard). Requires migration 20260619120000_pilot_interest.
 */
export async function submitPilotInterest(input: PilotInterestInput): Promise<{ error?: string }> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { error: 'Please enter your name.' };
  if (!email || !email.includes('@')) return { error: 'Please enter a valid email address.' };

  const { error } = await supabase.from('pilot_interest').insert({
    name,
    email,
    firm_name: input.firmName.trim() || null,
    note: input.note.trim() || null,
    source: 'forFirms',
  });
  if (error) {
    return { error: 'We could not record your request just now. Please try again in a moment.' };
  }
  return {};
}
