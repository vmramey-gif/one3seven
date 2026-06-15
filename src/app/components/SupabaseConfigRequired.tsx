/**
 * Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.
 * Prevents fake offline auth and mock persistence during beta QA.
 */
export function SupabaseConfigRequired() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-4">Setup required</p>
      <h1 className="text-xl font-semibold text-slate-900 mb-3">Connect Supabase to continue</h1>
      <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
        One3Seven needs a real Supabase project in this environment. Without it, sign-in, uploads, and firm
        workflows cannot run. Copy <span className="font-mono text-xs">.env.example</span> to{' '}
        <span className="font-mono text-xs">.env.local</span> and set:
      </p>
      <ul className="text-left text-sm text-slate-700 font-mono bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 max-w-md space-y-1 mb-6">
        <li>VITE_SUPABASE_URL</li>
        <li>VITE_SUPABASE_ANON_KEY</li>
      </ul>
      <p className="text-xs text-slate-500 max-w-md leading-relaxed">
        After saving, restart the dev server or redeploy, then reload this page.
      </p>
    </div>
  );
}
