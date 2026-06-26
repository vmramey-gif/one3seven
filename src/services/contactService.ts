import { supabase } from '../lib/supabaseClient';

export type ContactMessageInput = {
  name?: string;
  email: string;
  message: string;
  source?: string; // where it was sent from, e.g. 'workerTimeline'
};

/**
 * Record a general contact message. Inserts into public.contact_messages, which has an
 * insert-only RLS policy for anon/authenticated and no read policy (founder reads via the
 * service role / Supabase dashboard). Requires migration 20260625160000_contact_messages.
 */
export async function submitContactMessage(input: ContactMessageInput): Promise<{ error?: string }> {
  const email = (input.email ?? '').trim();
  const message = (input.message ?? '').trim();
  if (!email || !email.includes('@')) return { error: 'Please enter a valid email address.' };
  if (!message) return { error: 'Please enter a message.' };

  const { error } = await supabase.from('contact_messages').insert({
    name: input.name?.trim() || null,
    email,
    message,
    source: input.source?.trim() || 'app',
    path: typeof window !== 'undefined' ? window.location.pathname : null,
  });
  if (error) {
    return { error: 'We could not send your message just now. Please try again in a moment.' };
  }
  return {};
}
