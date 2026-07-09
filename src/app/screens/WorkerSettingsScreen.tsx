import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, Mail, KeyRound, Trash2, Bell, Shield, Download } from 'lucide-react';
import { Screen } from '../App';
import * as intakeData from '../../services/intakeDataService';
import { ONE3SEVEN_NOTICES } from '../constants/one3sevenProduct';
import { BETA_HIDE_WORKER_BILLING_UI } from '../constants/flags';

interface WorkerSettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  userEmail: string | null;
  profileId: string;
  onSignOut: () => void;
}

function ComingSoonControl({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="w-full cursor-not-allowed rounded-2xl border border-[#CBD6CF] bg-[#F8F6FF] px-4 py-2 text-sm text-[#1B2623]/42"
    >
      {label} — Coming soon
    </button>
  );
}

export function WorkerSettingsScreen({ onNavigate, userEmail, profileId, onSignOut }: WorkerSettingsScreenProps) {
  const [fullName, setFullName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = await intakeData.fetchProfile(profileId);
      setFullName(p?.full_name ?? '');
    })();
  }, [profileId]);

  const handleSave = async () => {
    const r = await intakeData.updateProfileName(profileId, fullName);
    if (!r.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4EC] text-[#1B2623]">
      <div className="sticky top-0 z-50 border-b border-[#D3DED6] bg-white/90 px-6 py-5 backdrop-blur">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wide text-[#1B2623]/60 hover:bg-[#F7F9F5] hover:text-[#1B2623]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to your dashboard
        </button>
      </div>
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="mb-2 text-2xl font-semibold text-[#1B2623]">Your settings</h1>
          <p className="mb-8 text-sm text-[#1B2623]/64">Account information and preferences (beta).</p>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:p-8">
              <h2 className="mb-4 text-sm font-semibold text-[#1B2623]">Account information</h2>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <User className="h-4 w-4 text-[#42574E]" /> Name
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-[#CBD6CF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1B2623] placeholder:text-[#1B2623]/38 focus:border-[#42574E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                placeholder="Your name"
              />
              <label className="mb-2 mt-5 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <Mail className="h-4 w-4 text-[#42574E]" /> Email
              </label>
              <input value={userEmail ?? ''} disabled className="w-full rounded-2xl border border-[#CBD6CF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1B2623]/52" />
              <p className="mt-2 text-xs text-[#1B2623]/52">Email is managed through Supabase Auth.</p>
            </div>

            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <KeyRound className="h-4 w-4 text-[#42574E]" /> Password reset
              </div>
              <p className="mb-3 text-xs text-[#1B2623]/52">
                Password reset email will be available when Supabase Auth templates are configured for this workspace.
              </p>
              <ComingSoonControl label="Send reset email" />
            </div>

            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">Google sign-in</div>
              <p className="mb-3 text-xs text-[#1B2623]/52">
                Linking a Google account to an existing email sign-in will be available after OAuth is enabled.
              </p>
              <ComingSoonControl label="Connect Google" />
            </div>

            {!BETA_HIDE_WORKER_BILLING_UI ? (
              <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">Billing</div>
                <p className="mb-1 text-xs font-medium text-[#1B2623]/72">Current plan: Beta personal access</p>
                <p className="mb-1 text-xs text-[#1B2623]/64">Beta personal access is free during beta.</p>
                <p className="mb-1 text-xs text-[#1B2623]/64">Price: Free during beta</p>
                <p className="mb-3 text-xs text-[#1B2623]/64">Payment method: Not required</p>
                <p className="text-sm leading-relaxed text-[#1B2623]/64">
                  During beta, one3seven is free for workers. You can organize your records and generate an intake
                  summary at no cost while we continue refining the platform.
                </p>
              </div>
            ) : (
              <p className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 text-xs text-[#1B2623]/52 shadow-[0_18px_56px_rgba(31,27,75,0.09)]">
                Billing is disabled during the beta. Personal access is free.
              </p>
            )}

            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <Bell className="h-4 w-4 text-[#42574E]" /> Notifications
              </div>
              <p className="mb-3 text-xs text-[#1B2623]/52">Email and in-app alert preferences are not configurable in beta yet.</p>
              <ComingSoonControl label="Notification preferences" />
            </div>

            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <Shield className="h-4 w-4 text-[#42574E]" /> Privacy
              </div>
              <p className="mb-3 text-xs text-[#1B2623]/52">{ONE3SEVEN_NOTICES.positioning}</p>
              <ComingSoonControl label="View privacy summary" />
            </div>

            <div className="rounded-[32px] border border-[#D3DED6] bg-white/95 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.09)] sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1B2623]">
                <Download className="h-4 w-4 text-[#42574E]" /> Download / export data
              </div>
              <p className="mb-3 text-xs text-[#1B2623]/52">Bulk export of intake summaries and metadata is not available in beta yet.</p>
              <ComingSoonControl label="Request data export" />
            </div>

            <div className="rounded-[32px] border border-red-100 bg-red-50/60 p-6 opacity-95 shadow-[0_18px_56px_rgba(31,27,75,0.07)] sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-900">
                <Trash2 className="h-4 w-4" /> Delete account
              </div>
              <p className="mb-3 text-xs text-[#1B2623]/64">
                Self-serve account deletion is not available during beta. Contact support if you need your account removed.
              </p>
              <ComingSoonControl label="Request deletion" />
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              className="w-full rounded-full bg-[#42574E] py-4 font-medium text-white shadow-[0_18px_48px_rgba(109,74,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#374A42]"
            >
              Save changes
            </button>
            {saved ? <p className="text-sm text-green-700 text-center">Saved.</p> : null}
            <button
              type="button"
              onClick={() => onSignOut()}
              className="w-full rounded-full border border-[#CBD6CF] bg-white py-3 text-sm font-medium text-[#1B2623] shadow-[0_12px_32px_rgba(31,27,75,0.08)] hover:bg-[#F7F9F5]"
            >
              Sign out
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
