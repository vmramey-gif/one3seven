/**
 * Client for the "Ask one3seven AI" internal assistant. Calls the chat-assistant edge
 * function (which holds the system prompt + Anthropic key server-side). The system prompt
 * is never shipped to the browser — only the conversation messages are sent.
 */
import { supabase } from '../lib/supabaseClient';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const STARTER_QUESTIONS: string[] = [
  'What do I say when an attorney says they already have a process?',
  'How do I explain one3seven in one sentence?',
  "What's the right tone for a cold call?",
];

export interface AskAssistantResult {
  content?: string;
  error?: string;
  status?: number;
}

export async function askAssistant(messages: ChatMessage[]): Promise<AskAssistantResult> {
  const { data, error } = await supabase.functions.invoke('chat-assistant', { body: { messages } });
  if (error) {
    let status: number | undefined;
    try {
      // FunctionsHttpError carries the original Response on .context
      status = (error as { context?: { status?: number } }).context?.status;
    } catch { /* ignore */ }
    return { error: error.message, status };
  }
  const content = (data as { content?: string } | null)?.content ?? '';
  return { content };
}
