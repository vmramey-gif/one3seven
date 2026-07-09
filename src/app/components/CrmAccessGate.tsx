/**
 * Gates internal CRM-member routes (founder + invited sales reps) using the exact same
 * mechanism that protects /hq: a signed-in user is a founder if profiles.is_founder, else a
 * rep if their email is on the invite allowlist (claim_crm_rep_access). No new auth path.
 *
 * Sign-in itself lives at /hq (FounderHQ) — the Supabase session is shared across routes,
 * so an unauthenticated visitor is sent there rather than duplicating the auth form.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { claimRepAccess } from '../../services/crmService';

type Access = 'loading' | 'authorized' | 'denied';

export function CrmAccessGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (!cancelled) setAccess('denied'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('is_founder')
        .eq('id', session.user.id)
        .maybeSingle();
      let ok = Boolean(data?.is_founder);
      if (!ok) ok = await claimRepAccess();
      if (!cancelled) setAccess(ok ? 'authorized' : 'denied');
    })();
    return () => { cancelled = true; };
  }, []);

  if (access === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1B2623] text-white/70">
        <p className="text-sm">Checking access…</p>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1B2623] px-6 text-center">
        <p style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-2xl font-medium text-white">
          Internal access only
        </p>
        <p className="max-w-sm text-sm text-[#C9C4E6]">
          This page is for the one3seven team. Sign in at one3sevenHQ, then return here.
        </p>
        <a
          href="/hq"
          className="rounded-full bg-[#42574E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#374A42]"
        >
          Go to one3sevenHQ
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
