/**
 * one3sevenHQ — dedicated internal entry. Founder + invited sales reps. Reached at /hq.
 *
 * Auth is plain email (no SMS/phone provider needed). Access is gated two ways: the founder is
 * is_founder; reps are provisioned only if their signed-in email is on the founder's invite
 * allowlist (claim_crm_rep_access). All CRM data is RLS-locked to CRM members at the database
 * level, so the UI gate is backed by the database.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, Users, Plus, Check, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { FounderCRMScreen } from './FounderCRMScreen';
import { addRepInvite, listRepInvites, revokeRepInvite, claimRepAccess, type CrmInvite } from '../../services/crmService';

type Status = 'loading' | 'anon' | 'rep' | 'founder' | 'not_authorized' | 'recovery';

function HQWordMark() {
  return (
    <span className="text-[17px] font-bold tracking-tight text-white">
      one<span className="font-black text-[#7C8B6F]">3</span>seven
      <span className="ml-1 rounded-md bg-[#42574E] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">HQ</span>
    </span>
  );
}

const fieldCls =
  'min-h-[48px] w-full rounded-[12px] border border-white/15 bg-white/5 px-4 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#7C8B6F]';

export function FounderHQ() {
  const [status, setStatus] = useState<Status>('loading');
  const [showCRM, setShowCRM] = useState(false);

  // Auth form
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const check = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setStatus('anon'); return; }
    const { data } = await supabase.from('profiles').select('is_founder').eq('id', session.user.id).maybeSingle();
    let resolved: Status;
    if (data?.is_founder) resolved = 'founder';
    else resolved = (await claimRepAccess()) ? 'rep' : 'not_authorized';
    setStatus(resolved);
    // Keep the CRM open across refreshes so members aren't dropped back to the landing.
    if (resolved === 'founder' || resolved === 'rep') {
      try { if (sessionStorage.getItem('o3s_hq_open_crm') === '1') setShowCRM(true); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    // Arriving from a password-reset email link → show the "set new password" form.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('type=recovery')) {
      setStatus('recovery');
    } else {
      void check();
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('recovery');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const forgotPassword = async () => {
    setError(''); setNotice('');
    const target = email.trim();
    if (!target) { setError('Enter your email above first, then tap reset.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/hq`,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setNotice('If that email has an account, a reset link is on its way. Check your inbox and spam.');
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setNewPassword('');
    setStatus('loading');
    await check();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (err) { setError('Sign in failed. Check your email and password.'); return; }
      setStatus('loading'); await check();
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
      setBusy(false);
      if (err) { setError(err.message); return; }
      if (data.session) { setStatus('loading'); await check(); }
      else { setNotice('Account created. Check your email to confirm, then sign in.'); setMode('signin'); }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setShowCRM(false); setEmail(''); setPassword(''); setError(''); setNotice('');
    try { sessionStorage.removeItem('o3s_hq_open_crm'); } catch { /* ignore */ }
    setStatus('anon');
  };

  if (showCRM && (status === 'founder' || status === 'rep')) {
    return <FounderCRMScreen onExit={() => { setShowCRM(false); try { sessionStorage.removeItem('o3s_hq_open_crm'); } catch { /* ignore */ } }} isFounder={status === 'founder'} />;
  }

  return (
    <div className="min-h-screen bg-[#131A17] text-white antialiased">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="mx-auto max-w-md"><HQWordMark /></div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-5 py-14">
        {status === 'loading' && <div className="py-16 text-center text-sm text-white/40">Loading…</div>}

        {(status === 'founder' || status === 'rep') && (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#42574E]/40 bg-[#42574E]/15 px-3 py-1.5 text-xs font-semibold text-[#95AB9B]">
              <ShieldCheck className="h-3.5 w-3.5" /> {status === 'founder' ? 'Founder access' : 'Sales rep access'}
            </div>
            <h1 className="mb-3 text-[30px] font-bold leading-tight tracking-tight">one3seven HQ</h1>
            <p className="mb-7 text-[15px] leading-relaxed text-white/60">
              {status === 'founder'
                ? 'Internal command center. Your sales pipeline, firm outreach, and team.'
                : 'Your team sales pipeline — firm outreach and call logging.'}
            </p>
            <button
              type="button"
              onClick={() => { setShowCRM(true); try { sessionStorage.setItem('o3s_hq_open_crm', '1'); } catch { /* ignore */ } }}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#42574E] text-[16px] font-semibold text-white shadow-[0_12px_40px_rgba(66,87,78,0.4)] transition hover:bg-[#374A42]"
            >
              Open Sales CRM <ArrowRight className="h-5 w-5" />
            </button>

            {status === 'founder' && <RepsManager />}

            <button type="button" onClick={signOut} className="mt-8 w-full text-center text-[13px] text-white/40 hover:text-white/70">Sign out</button>
          </div>
        )}

        {status === 'recovery' && (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/55">
              <Lock className="h-3.5 w-3.5" /> Reset password
            </div>
            <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight">Set a new password</h1>
            <p className="mb-7 text-[14px] leading-relaxed text-white/55">Choose a new password for your one3seven HQ account.</p>
            <form onSubmit={submitNewPassword} className="space-y-3">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className={fieldCls} />
              {error && <p className="text-[13px] text-red-300">{error}</p>}
              {notice && <p className="text-[13px] text-emerald-300">{notice}</p>}
              <button type="submit" disabled={busy || newPassword.length < 8} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#42574E] text-[16px] font-semibold text-white transition hover:bg-[#374A42] disabled:opacity-40">
                {busy ? 'Saving…' : 'Save new password'} <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          </div>
        )}

        {status === 'not_authorized' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><Lock className="h-6 w-6 text-white/60" /></div>
            <h1 className="mb-2 text-[22px] font-bold">Not on the team yet</h1>
            <p className="mb-6 text-[14px] leading-relaxed text-white/55">
              This account isn’t on the one3seven HQ access list. Ask the founder to invite your email, then sign in here.
            </p>
            <button type="button" onClick={signOut} className="text-[13px] text-[#95AB9B] hover:underline">Sign in with a different account</button>
            <div className="mt-4"><a href="/" className="text-[13px] text-white/40 hover:text-white/70">Back to one3seven</a></div>
          </div>
        )}

        {status === 'anon' && (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/55">
              <Lock className="h-3.5 w-3.5" /> Internal · invite only
            </div>
            <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight">one3seven HQ</h1>
            <p className="mb-7 text-[14px] leading-relaxed text-white/55">
              {mode === 'signin' ? 'Sign in to access the command center.' : 'Create your account with the email you were invited on.'}
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" className={fieldCls} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className={fieldCls} />
              {error && <p className="text-[13px] text-red-300">{error}</p>}
              {notice && <p className="text-[13px] text-emerald-300">{notice}</p>}
              <button type="submit" disabled={busy || !email || !password} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#42574E] text-[16px] font-semibold text-white transition hover:bg-[#374A42] disabled:opacity-40">
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-5 w-5" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}
              className="mt-4 w-full text-center text-[13px] text-[#95AB9B] hover:underline"
            >
              {mode === 'signin' ? 'Invited rep? Create your account' : 'Already have an account? Sign in'}
            </button>
            {mode === 'signin' && (
              <button type="button" onClick={forgotPassword} disabled={busy} className="mt-2 w-full text-center text-[13px] text-white/45 hover:text-white/70 disabled:opacity-40">
                Forgot password?
              </button>
            )}
            <div className="mt-6 text-center"><a href="/" className="text-[13px] text-white/40 hover:text-white/70">Back to one3seven</a></div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Founder-only: manage sales reps ──────────────────────────────────────────
function RepsManager() {
  const [invites, setInvites] = useState<CrmInvite[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => { const r = await listRepInvites(); if (!r.error) setInvites(r.data); };
  useEffect(() => { void load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await addRepInvite({ name, email });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setName(''); setEmail(''); void load();
  };

  const revoke = async (id: string) => { await revokeRepInvite(id); void load(); };
  const hqLink = typeof window !== 'undefined' ? `${window.location.origin}/hq` : '/hq';

  return (
    <div className="mt-8 rounded-[16px] border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-bold"><Users className="h-4 w-4 text-[#7C8B6F]" /> Sales reps</div>
      <form onSubmit={add} className="space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rep name" className={fieldCls} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Rep email" className={fieldCls} />
        {error && <p className="text-[13px] text-red-300">{error}</p>}
        <button type="submit" disabled={busy || !email} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold text-white transition hover:bg-white/15 disabled:opacity-40">
          <Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add sales rep'}
        </button>
      </form>

      <p className="mt-3 rounded-[10px] bg-[#42574E]/15 px-3 py-2 text-[12px] leading-relaxed text-[#95AB9B]">
        Share this link with reps: <span className="font-semibold text-white">{hqLink}</span> — they create an account / sign in with the email you invited.
      </p>

      {invites.length > 0 && (
        <div className="mt-4 space-y-2">
          {invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-white">{i.name || i.email}</div>
                <div className="truncate text-[11px] text-white/45">{i.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${i.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-300' : i.status === 'revoked' ? 'bg-white/10 text-white/40' : 'bg-amber-500/20 text-amber-200'}`}>
                  {i.status === 'accepted' ? <Check className="inline h-3 w-3" /> : null} {i.status}
                </span>
                {i.status !== 'revoked' && (
                  <button type="button" onClick={() => revoke(i.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-red-300" aria-label="Revoke">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
