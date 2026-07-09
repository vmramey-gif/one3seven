import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Filter, Info, Link2, MapPin, Save } from 'lucide-react';
import { Screen } from '../App';
import type { FirmProfileRow } from '../../services/intakeDataService';
import {
  getFirmSubscriptionStatus,
  createCheckoutSession,
  createCustomerPortalSession,
  FIRM_PLANS,
} from '../../services/billingService';
import * as intakeData from '../../services/intakeDataService';
import { runSupabaseSetupDiagnostics } from '../../services/supabaseSetupDiagnostics';
import { ONE3SEVEN_NOTICES } from '../constants/one3sevenProduct';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import { toBetaUserMessage } from '../utils/betaUserError';
import {
  CALIFORNIA_BETA_CASE_CATEGORIES,
  type IntakeCaseCategory,
} from '../constants/caseCategories';
import { STATE_LABELS } from '../constants/stateBarDirectories';

interface FirmSettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  firmProfile?: FirmProfileRow | null;
  firmBellNotifications?: AppNotificationItem[];
  profileUserId?: string;
  profileEmail?: string | null;
  profileFullName?: string | null;
  setupRequired?: boolean;
  onFirmProfileUpdated?: (profile: FirmProfileRow) => void;
  onFirmProfileSaved?: () => void;
}

const GEOGRAPHIES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];

const INTAKE_CATEGORIES: IntakeCaseCategory[] = CALIFORNIA_BETA_CASE_CATEGORIES.map((c) => c.name);

const REQUIRED_PACKET_SIGNALS = [
  'Personal narrative',
  'Pay records',
  'Time or schedule records',
  'Workplace communications',
  'Offer or classification terms',
  'Separation / final pay records',
];

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  Overtime: 'Employment',
  'Wage Theft': 'Employment',
  'Classification Review': 'Employment',
  'Wrongful Termination': 'Employment',
  Discrimination: 'Employment',
};

function normalizePracticeAreas(areas: string[] | null | undefined): string[] {
  const normalized = (areas ?? []).map((area) => LEGACY_CATEGORY_MAP[area] ?? area);
  return Array.from(new Set(normalized)).filter((area) => INTAKE_CATEGORIES.includes(area));
}

export function FirmSettingsScreen({
  onNavigate,
  firmProfile,
  firmBellNotifications = [],
  profileUserId,
  profileEmail,
  profileFullName,
  setupRequired = false,
  onFirmProfileUpdated,
  onFirmProfileSaved,
}: FirmSettingsScreenProps) {
  const profileComplete = firmProfile ? intakeData.isFirmProfileComplete(firmProfile) : false;
  const [firmName, setFirmName] = useState(() => {
    if (!firmProfile?.firm_name || intakeData.isPlaceholderFirmName(firmProfile.firm_name)) return '';
    return firmProfile.firm_name;
  });
  const [firmCodeDisplay, setFirmCodeDisplay] = useState(
    profileComplete ? (firmProfile?.firm_code ?? '') : ''
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diagSummary, setDiagSummary] = useState<string | null>(null);

  const [selectedGeographies, setSelectedGeographies] = useState<string[]>(['CA']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Employment',
  ]);
  const [barNumber, setBarNumber] = useState(() => firmProfile?.bar_number ?? '');
  const [barState, setBarState] = useState(() => firmProfile?.bar_state ?? '');
  const [acceptingCases, setAcceptingCases] = useState(() => firmProfile?.accepting_cases ?? true);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [intakeLinkCopied, setIntakeLinkCopied] = useState(false);

  useEffect(() => {
    if (firmProfile) {
      setFirmName(
        intakeData.isPlaceholderFirmName(firmProfile.firm_name) ? '' : firmProfile.firm_name
      );
      setFirmCodeDisplay(
        intakeData.isFirmProfileComplete(firmProfile) ? firmProfile.firm_code : ''
      );
      setSelectedGeographies(firmProfile.geographic_filters?.length ? firmProfile.geographic_filters : ['CA']);
      const nextPracticeAreas = normalizePracticeAreas(firmProfile.practice_areas);
      setSelectedCategories(nextPracticeAreas.length ? nextPracticeAreas : ['Employment']);
      setBarNumber(firmProfile.bar_number ?? '');
      setBarState(firmProfile.bar_state ?? '');
      setAcceptingCases(firmProfile.accepting_cases ?? true);
    }
  }, [firmProfile]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleGeography = (geo: string) => {
    setSelectedGeographies((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleRunDbDiagnostics = async () => {
    if (!profileUserId) {
      setDiagSummary('Sign in again to run diagnostics.');
      return;
    }
    setDiagBusy(true);
    setDiagSummary(null);
    try {
      const r = await runSupabaseSetupDiagnostics(profileUserId, {
        email: profileEmail ?? null,
        label: 'firm-settings-manual',
      });
      setDiagSummary(r.summary);
    } catch (err) {
      console.error('[o3s-db-diag] manual run failed', err);
      setDiagSummary('Diagnostics failed. See console for [o3s-db-diag] logs.');
    } finally {
      setDiagBusy(false);
    }
  };

  const handleSaveSettings = async () => {
    const nextFirmName = firmName.trim();
    if (!nextFirmName) {
      setSettingsError('Enter a firm name before saving.');
      return;
    }

    if (!profileUserId) {
      setSettingsError('Sign in again to save your firm profile.');
      return;
    }

    setSettingsError(null);
    setIsSaving(true);
    try {
      console.info('[o3s-firm-save] UI save clicked', { profileUserId, firmId: firmProfile?.id ?? null });
      const r = await intakeData.saveFirmProfileBasics({
        firmId: firmProfile?.id,
        userId: profileUserId,
        email: profileEmail ?? firmProfile?.contact_email ?? null,
        full_name: profileFullName ?? null,
        existingFirmCode: firmProfile?.firm_code ?? null,
        firm_name: nextFirmName,
        practice_areas: selectedCategories,
        bar_number: barNumber.trim() || null,
        bar_state: barState.trim() || null,
        accepting_cases: acceptingCases,
        geographic_filters: selectedGeographies,
      });
      if (r.error || !r.profile) {
        setSettingsError(
          toBetaUserMessage(r.error, 'Could not save your firm profile. Try again in a moment.')
        );
        return;
      }
      if (!(r.profile.firm_code ?? '').trim()) {
        setSettingsError('Firm profile saved without a firm code. Save again to assign your code.');
        return;
      }
      onFirmProfileUpdated?.(r.profile);
      setFirmCodeDisplay(r.profile.firm_code);
      if (setupRequired && intakeData.isFirmProfileComplete(r.profile)) {
        onFirmProfileSaved?.();
      } else {
        setShowSaveConfirmation(true);
        window.setTimeout(() => setShowSaveConfirmation(false), 3000);
      }
    } catch (err) {
      console.error('[o3s-firm-save] UI save failed', err);
      setSettingsError(
        toBetaUserMessage(
          err instanceof Error ? err.message : String(err),
          'Could not save your firm profile. Try again in a moment.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sub = firmProfile
    ? getFirmSubscriptionStatus(firmProfile.plan_id, firmProfile.subscription_status)
    : getFirmSubscriptionStatus('beta_pilot', 'trialing');

  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const handleUpgrade = async (priceId: string, planId: string) => {
    if (!firmProfile?.id) return;
    setBillingLoading(planId);
    setBillingError(null);
    const { url, error } = await createCheckoutSession({
      firmProfileId: firmProfile.id,
      priceId,
    });
    setBillingLoading(null);
    if (error || !url) {
      setBillingError(error ?? 'Could not start checkout. Try again.');
      return;
    }
    window.location.href = url;
  };

  const handleManageBilling = async () => {
    if (!firmProfile?.id) return;
    setBillingLoading('portal');
    setBillingError(null);
    const { url, error } = await createCustomerPortalSession({
      firmProfileId: firmProfile.id,
    });
    setBillingLoading(null);
    if (error || !url) {
      setBillingError(error ?? 'Could not open billing portal. Try again.');
      return;
    }
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#14112E]">
      <nav className="sticky top-0 z-50 border-b border-[#ECE7F5] bg-white/90 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4 flex-wrap w-full justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {!setupRequired ? (
                <button
                  onClick={() => onNavigate('firmDashboard')}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#14112E]/65 transition-colors hover:bg-[#F5F1FB] hover:text-[#14112E]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
              ) : null}
              {!setupRequired ? <div className="hidden h-6 w-px bg-[#ECE7F5] sm:block" /> : null}
              <h1 className="truncate text-lg font-semibold text-[#14112E]">
                {setupRequired ? 'Firm profile setup' : 'Settings & Preferences'}
              </h1>
            </div>
            <NotificationsBell items={firmBellNotifications} />
          </div>
        </div>
      </nav>

      {showSaveConfirmation && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Save className="w-4 h-4" />
            Firm profile fields saved
          </div>
        </motion.div>
      )}

      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-white/95 p-8 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
          >
            <h2 className="mb-4 text-lg font-semibold text-[#14112E]">Firm profile</h2>
            {setupRequired ? (
              <p className="mb-4 text-sm leading-relaxed text-[#14112E]/64">
                Enter your firm name and save to finish setup. Your firm code is assigned when you save and appears on
                the dashboard afterward.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#14112E]/52">Firm name</label>
                <input
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Your law firm or practice name"
                  className="w-full rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 text-sm text-[#14112E] placeholder:text-[#14112E]/38 focus:border-[#42574E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#14112E]/52">Firm code</label>
                {profileComplete && firmCodeDisplay.trim() ? (
                  <>
                    <input
                      value={firmCodeDisplay}
                      readOnly
                      className="w-full rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 font-mono text-sm text-[#14112E]"
                    />
                    <p className="mt-2 text-xs text-[#14112E]/52">
                      Share this code with workers so their organized intake routes directly to your dashboard.
                    </p>
                    {/* Intake link — shareable URL that pre-fills this firm code for any worker */}
                    <div className="mt-3 rounded-2xl border border-[#ECE7F5] bg-[#F5F1FB] px-4 py-3">
                      <p className="mb-1 text-xs font-semibold text-[#14112E]">Your intake link</p>
                      <p className="mb-2 text-xs text-[#14112E]/55 leading-relaxed">
                        Send this link to anyone. They go through the guided intake flow and their organized case routes directly to your dashboard — no code needed.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          value={`${window.location.origin}/?fc=${firmCodeDisplay}`}
                          readOnly
                          className="min-w-0 flex-1 rounded-xl border border-[#ECE7F5] bg-white px-3 py-2 font-mono text-xs text-[#14112E]/70 select-all"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `${window.location.origin}/?fc=${firmCodeDisplay}`
                            ).then(() => {
                              setIntakeLinkCopied(true);
                              window.setTimeout(() => setIntakeLinkCopied(false), 2200);
                            });
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#42574E] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#4C1D96]"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {intakeLinkCopied ? 'Copied!' : 'Copy link'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="rounded-2xl border border-dashed border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 text-sm text-[#14112E]/64">
                    Assigned when you save your firm profile.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] p-5">
              <p className="mb-1 text-sm font-semibold text-[#14112E]">Attorney credentials</p>
              <p className="mb-4 text-xs text-[#14112E]/58 leading-relaxed">
                Your bar number and state are shown to workers when they review access requests. Workers can use this to verify your licensure through their state bar directory. These credentials are attorney-provided — one3seven does not independently verify bar status.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[#14112E]/52">State bar</label>
                  <select
                    value={barState}
                    onChange={(e) => setBarState(e.target.value)}
                    className="w-full rounded-2xl border border-[#ECE7F5] bg-white px-4 py-3 text-sm text-[#14112E] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                  >
                    <option value="">Select a state</option>
                    {Object.entries(STATE_LABELS).map(([abbr, label]) => (
                      <option key={abbr} value={abbr}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#14112E]/52">Bar number</label>
                  <input
                    value={barNumber}
                    onChange={(e) => setBarNumber(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 font-mono text-sm text-[#14112E] placeholder:text-[#14112E]/38 focus:border-[#42574E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                  />
                </div>
              </div>
            </div>

            {firmProfile?.contact_email ? (
              <div className="mt-4 rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3">
                <p className="mb-1 text-xs text-[#14112E]/52">Firm account email</p>
                <p className="text-sm font-medium text-[#14112E]">{firmProfile.contact_email}</p>
              </div>
            ) : null}

            <div className="mt-4 text-sm text-[#14112E]/64">
              <p>
                Current plan: <span className="font-medium">{sub.planId}</span> - Subscription status:{' '}
                <span className="font-medium">{sub.subscriptionStatus}</span>
              </p>
              <p className="mt-2 text-xs text-[#14112E]/52">
                Beta Pilot is free while trialing. Solo, Practice, Firm, and Enterprise plans will connect through Stripe before paid launch.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3">
                <p className="text-xs text-[#14112E]/52">Direct firm-code routing</p>
                <p className="text-sm font-semibold text-[#14112E]">Active</p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptingCases((v) => !v)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  acceptingCases
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-[#ECE7F5] bg-[#FAF9F6]'
                }`}
              >
                <p className="text-xs text-[#14112E]/52">Network intake status</p>
                <p className={`text-sm font-semibold ${acceptingCases ? 'text-emerald-700' : 'text-[#14112E]/50'}`}>
                  {acceptingCases ? 'Accepting new intakes' : 'Not accepting'}
                </p>
              </button>
              <div className="rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3">
                <p className="text-xs text-[#14112E]/52">Saved filters</p>
                <p className="text-sm font-semibold text-[#14112E]">
                  {selectedGeographies.length} region{selectedGeographies.length === 1 ? '' : 's'} -{' '}
                  {selectedCategories.length} focus area{selectedCategories.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-white/95 p-8 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
          >
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-[#14112E]">Billing &amp; subscription</h2>
                <p className="mt-1 text-sm text-[#14112E]/55">
                  Current plan:{' '}
                  <span className={`font-semibold ${sub.isPaid ? 'text-emerald-600' : 'text-[#42574E]'}`}>
                    {sub.label}
                  </span>
                  {' · '}
                  <span className="text-[#14112E]/50">{sub.subscriptionStatus}</span>
                </p>
              </div>
              {sub.isPaid && (
                <button
                  type="button"
                  onClick={() => void handleManageBilling()}
                  disabled={billingLoading === 'portal'}
                  className="shrink-0 rounded-xl border border-[#ECE7F5] bg-white px-4 py-2 text-xs font-semibold text-[#42574E] transition hover:bg-[#F5F1FB] disabled:opacity-60"
                >
                  {billingLoading === 'portal' ? 'Opening…' : 'Manage billing →'}
                </button>
              )}
            </div>

            {billingError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {billingError}
              </div>
            )}

            {/* Plan cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {FIRM_PLANS.map((plan) => {
                const isCurrent = sub.planId === plan.id;
                const isPopular = plan.highlight;
                const loading = billingLoading === plan.id;
                const canUpgrade = !isCurrent && !!plan.priceId;

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-[22px] border p-5 transition ${
                      isPopular
                        ? 'border-[#42574E] bg-[#F5F1FB] shadow-[0_8px_32px_rgba(109,74,255,0.14)]'
                        : isCurrent
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-[#ECE7F5] bg-white'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#42574E] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                        Most popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                        Current plan
                      </div>
                    )}

                    <div className="mb-3">
                      <p className="text-[13px] font-bold text-[#14112E]">{plan.label}</p>
                      <div className="mt-1 flex items-end gap-1">
                        <span className="text-[28px] font-black leading-none tracking-tight text-[#14112E]">
                          ${plan.price}
                        </span>
                        <span className="mb-1 text-xs text-[#14112E]/45">/mo</span>
                      </div>
                    </div>

                    <ul className="mb-5 flex-1 space-y-1.5">
                      <li className="flex items-center gap-1.5 text-xs text-[#14112E]/65">
                        <span className="text-[#42574E]">✓</span>
                        {plan.intakesPerMonth ? `Up to ${plan.intakesPerMonth} intakes/mo` : 'Unlimited intakes'}
                      </li>
                      <li className="flex items-center gap-1.5 text-xs text-[#14112E]/65">
                        <span className="text-[#42574E]">✓</span>
                        {plan.seats ? `${plan.seats} seat${plan.seats > 1 ? 's' : ''}` : 'Unlimited seats'}
                      </li>
                      <li className="flex items-center gap-1.5 text-xs text-[#14112E]/65">
                        <span className="text-[#42574E]">✓</span>
                        Intake organization + review packet
                      </li>
                      <li className="flex items-center gap-1.5 text-xs text-[#14112E]/65">
                        <span className="text-[#42574E]">✓</span>
                        Beta pilot pricing
                      </li>
                    </ul>

                    {isCurrent ? (
                      <div className="rounded-xl bg-emerald-100 py-2.5 text-center text-xs font-semibold text-emerald-700">
                        Active
                      </div>
                    ) : canUpgrade ? (
                      <button
                        type="button"
                        onClick={() => void handleUpgrade(plan.priceId!, plan.id)}
                        disabled={!!billingLoading}
                        className={`rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
                          isPopular
                            ? 'bg-[#42574E] text-white hover:bg-[#4C1D96]'
                            : 'border border-[#ECE7F5] bg-white text-[#42574E] hover:bg-[#F5F1FB]'
                        }`}
                      >
                        {loading ? 'Opening Stripe…' : 'Start free trial →'}
                      </button>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#ECE7F5] py-2.5 text-center text-xs text-[#14112E]/40">
                        {!plan.priceId ? 'Coming soon' : 'Select above'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Enterprise */}
            <div className="mt-4 flex items-center justify-between rounded-[18px] border border-dashed border-[#ECE7F5] bg-[#FAF9F6] px-5 py-4">
              <div>
                <p className="text-[13px] font-bold text-[#14112E]">Enterprise</p>
                <p className="text-xs text-[#14112E]/50">Unlimited intakes · Unlimited seats · Custom onboarding</p>
              </div>
              <a
                href="mailto:info@one3seven.com?subject=Enterprise%20inquiry"
                className="rounded-xl border border-[#ECE7F5] bg-white px-4 py-2 text-xs font-semibold text-[#42574E] transition hover:bg-[#F5F1FB]"
              >
                Contact us →
              </a>
            </div>

            <p className="mt-4 text-center text-[11px] text-[#14112E]/35">
              All plans include a 7-day free trial · Cancel anytime · Billed monthly via Stripe
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-white/95 p-8 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
          >
            <h2 className="mb-2 text-lg font-semibold text-[#14112E]">Team & permissions</h2>
            <p className="mb-4 text-sm text-[#14112E]/64">
              Team access is planned for paid firm workspaces. This beta account currently belongs to the signed-in firm user.
            </p>
            <p className="rounded-2xl border border-dashed border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 text-xs text-[#14112E]/52">
              Team member and permission controls are unavailable during the closed beta.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-white/95 p-8 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
          >
            <h2 className="mb-2 text-lg font-semibold text-[#14112E]">Account security</h2>
            <p className="mb-3 text-sm text-[#14112E]/64">
              Password, sessions, and account access are handled through Supabase Auth while firm workspace security is expanded.
            </p>
            <p className="rounded-2xl border border-dashed border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 text-xs text-[#14112E]/52">
              Additional security checklist controls are unavailable during the closed beta.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-white/95 p-8 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <Filter className="h-5 w-5 text-[#42574E]" />
              <h2 className="text-lg font-semibold text-[#14112E]">Intake Routing Preferences</h2>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-[#14112E]/64">
              These settings save geography and practice-area context to your firm profile. People can still route directly to your dashboard with your firm code.
            </p>

            <div className="space-y-6">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#42574E]" />
                  <div className="text-sm font-medium text-[#14112E]">Geography Preferences</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GEOGRAPHIES.map((geo) => (
                    <PillButton key={geo} selected={selectedGeographies.includes(geo)} onClick={() => toggleGeography(geo)}>
                      {geo}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-[#14112E]">
                  Intake practice areas (California beta)
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTAKE_CATEGORIES.map((category) => (
                    <PillButton
                      key={category}
                      selected={selectedCategories.includes(category)}
                      onClick={() => toggleCategory(category)}
                    >
                      {category}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-[#14112E]">Complete Packet Signals</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REQUIRED_PACKET_SIGNALS.map((signal) => (
                    <div key={signal} className="rounded-2xl border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-sm font-medium text-[#14112E]">{signal}</p>
                      <p className="mt-1 text-xs text-[#14112E]/52">Review-preparation signal, not a legal requirement.</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[32px] border border-[#ECE7F5] bg-[#FAF9F6] p-8 shadow-[0_18px_56px_rgba(31,27,75,0.09)]"
          >
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#42574E]" />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#14112E]">About intake workflow signals</h3>
                <p className="mb-3 text-xs leading-relaxed text-[#14112E]/64">
                  Status labels inside your dashboard describe operational routing and review preparation only. They are not legal conclusions, outcomes, or rankings from one3seven.
                </p>
                <p className="text-xs leading-relaxed text-[#14112E]/64">
                  When a preview is not advanced by a firm, it usually reflects capacity, focus areas, or internal intake preferences - not a reflection on the worker's records.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-[#14112E]/64">
                  Participating firms choose their own next steps. {ONE3SEVEN_NOTICES.positioning}
                </p>
              </div>
            </div>
          </motion.section>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {settingsError ? (
                <p className="text-sm text-red-600">{settingsError}</p>
              ) : (
                <p className="text-sm text-[#14112E]/52">
                  Firm name, geography, and intake focus areas save to your firm profile.
                </p>
              )}
              {setupRequired ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRunDbDiagnostics()}
                    disabled={diagBusy || isSaving}
                    className="w-fit text-xs text-[#14112E]/60 underline underline-offset-2 hover:text-[#14112E] disabled:opacity-50"
                  >
                    {diagBusy ? 'Running DB diagnostics…' : 'Run DB diagnostics (temp)'}
                  </button>
                  {diagSummary ? (
                    <p className="break-words font-mono text-xs text-[#14112E]/60">{diagSummary}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#42574E] px-8 py-3 font-medium text-white shadow-[0_18px_48px_rgba(109,74,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#4C1D96] disabled:translate-y-0 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save firm profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        selected
          ? 'bg-[#42574E] text-white shadow-[0_10px_24px_rgba(109,74,255,0.18)]'
          : 'border border-[#ECE7F5] bg-white text-[#14112E]/70 hover:border-[#C9B8F0] hover:bg-[#F5F1FB] hover:text-[#14112E]'
      }`}
    >
      {children}
    </button>
  );
}
