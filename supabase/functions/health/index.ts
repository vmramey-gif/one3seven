/**
 * Supabase Edge Function: health
 * Basic uptime/liveness check — confirms the edge runtime is serving requests AND the database
 * is reachable. Returns generic ok/not-ok status only, never row data or error internals, since
 * this is deployed with --no-verify-jwt (must be reachable by an external uptime monitor with no
 * Supabase session).
 *
 * GET /functions/v1/health -> { status: "ok", db: "ok", timestamp: "..." } (200)
 *                          or { status: "degraded", db: "error", timestamp: "..." } (503)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Trivial, cheap read against a table guaranteed to exist -- proves the DB connection and
  // service-role auth both work, without touching or returning any row data.
  const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);

  const dbOk = !error;
  const body = {
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: dbOk ? 200 : 503,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
