/**
 * one3sevenHQ — dedicated internal entry for the founder. Separate from the worker/firm
 * product: its own branded landing + sign-in, gating into the founder CRM. Reached at /hq.
 *
 * Access is gated two ways: this screen only opens the CRM for a session whose profile has
 * is_founder = true, AND the CRM's data is protected by founder-only RLS at the database level.
 * A non-founder who signs in here sees an "not authorized" state and no data.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { FounderCRMScreen } from './FounderCRMScreen';

type Status = 'loading' | 'anon' | 'not_founder' | 'founder';

function HQWordMark() {
  return (
    <span className="text-[17px] font-bold tracking-tight text-white">
      one<span className="font-black text-[#A78BFA]">3</span>seven
      <span className="ml-1 rounded-md bg-[#6D4AFF] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">HQ</span>
    </span>
  );
}

export function FounderHQ() {
  const [status, setStatus] = useState<Status>('loading');
  const [showCRM, setShowCRM] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const check = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setStatus('anon'); return; }
    const { data } = await supabase
      .from('profiles')
      .select('is_founder')
      .eq('id', session.user.id)
      .maybeSingle();
    setStatus(data?.is_founder ? 'founder' : 'not_founder');
  };

  useEffect(() => { void check(); }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSigningIn(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (err) { setError('Sign in failed. Check your email and password.'); return; }
    setStatus('loading');
    await check();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setShowCRM(false);
    setEmail(''); setPassword('');
    setStatus('anon');
  };

  if (showCRM && status === 'founder') {
    return <FounderCRMScreen onExit={() => setShowCRM(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#0B1033] text-white antialiased">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="mx-auto max-w-md"><HQWordMark /></div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-5 py-16">
        {status === 'loading' && (
          <div className="py-16 text-center text-sm text-white/40">Loading…</div>
        )}

        {status === 'founder' && (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#6D4AFF]/40 bg-[#6D4AFF]/15 px-3 py-1.5 text-xs font-semibold text-[#C7B9FF]">
              <ShieldCheck className="h-3.5 w-3.5" /> Founder access
            </div>
            <h1 className="mb-3 text-[30px] font-bold leading-tight tracking-tight">one3seven HQ</h1>
            <p className="mb-8 text-[15px] leading-relaxed text-white/60">
              Internal command center. Your sales pipeline, firm outreach, and activity tracker — for your eyes only.
            </p>
            <button
              type="button"
              onClick={() => setShowCRM(true)}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] text-[16px] font-semibold text-white shadow-[0_12px_40px_rgba(109,74,255,0.4)] transition hover:bg-[#5B35D5]"
            >
              Open Sales CRM <ArrowRight className="h-5 w-5" />
            </button>
            <button type="button" onClick={signOut} className="mt-6 w-full text-center text-[13px] text-white/40 hover:text-white/70">
              Sign out
            </button>
          </div>
        )}

        {status === 'not_founder' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Lock className="h-6 w-6 text-white/60" />
            </div>
            <h1 className="mb-2 text-[22px] font-bold">Not authorized</h1>
            <p className="mb-6 text-[14px] leading-relaxed text-white/55">
              This account doesn’t have HQ access. one3seven HQ is internal tooling for the founder only.
            </p>
            <button type="button" onClick={signOut} className="text-[13px] text-[#C7B9FF] hover:underline">Sign in with a different account</button>
            <div className="mt-4"><a href="/" className="text-[13px] text-white/40 hover:text-white/70">Back to one3seven</a></div>
          </div>
        )}

        {status === 'anon' && (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/55">
              <Lock className="h-3.5 w-3.5" /> Internal · founder only
            </div>
            <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight">one3seven HQ</h1>
            <p className="mb-7 text-[14px] leading-relaxed text-white/55">Sign in to access the command center.</p>
            <form onSubmit={signIn} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="username"
                className="min-h-[48px] w-full rounded-[12px] border border-white/15 bg-white/5 px-4 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#A78BFA]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="min-h-[48px] w-full rounded-[12px] border border-white/15 bg-white/5 px-4 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#A78BFA]"
              />
              {error && <p className="text-[13px] text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={signingIn || !email || !password}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] text-[16px] font-semibold text-white transition hover:bg-[#5B35D5] disabled:opacity-40"
              >
                {signingIn ? 'Signing in…' : 'Sign in'} <ArrowRight className="h-5 w-5" />
              </button>
            </form>
            <div className="mt-6 text-center"><a href="/" className="text-[13px] text-white/40 hover:text-white/70">Back to one3seven</a></div>
          </div>
        )}
      </main>
    </div>
  );
}
