/**
 * Supabase Edge Function: chat-assistant
 * Internal "Ask one3seven AI" sales assistant. Receives the conversation history,
 * prepends the hardcoded system prompt (systemPrompt.ts), and calls the Anthropic
 * Messages API. Returns { content } — the reply text only.
 *
 * POST body: { messages: [{ role, content }] }
 *
 * Auth: requires an authenticated Supabase session (any signed-in user → 401 otherwise).
 * Founder/rep gating is enforced on the frontend; this function only checks authentication.
 * The Anthropic key is a server-side secret — never exposed to the browser.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildChatRequest } from './systemPrompt.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // --- Auth: any valid Supabase session. ---
  const authHeader = req.headers.get('Authorization') ?? '';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Not authenticated' }, 401);

  // --- Body ---
  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0) return json({ error: 'No messages provided' }, 400);

  // --- Anthropic call (system prompt prepended via buildChatRequest) ---
  const requestBody = buildChatRequest(messages);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    return json({ error: `Anthropic request failed: ${String(e)}` }, 502);
  }

  if (!response.ok) {
    const err = await response.text();
    return json({ error: `Anthropic API error ${response.status}: ${err}` }, 502);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text ?? '';
  return json({ content });
});
