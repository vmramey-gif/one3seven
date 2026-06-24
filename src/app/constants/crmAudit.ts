/**
 * Daily audit definitions for the founder-only Audit tab.
 * Site checks ping live routes (relative — they hit whatever origin the app runs on, i.e.
 * production when used at one3seven.com/hq). CRM checks query Supabase via crmService.
 * Manual checks are human-verified Pass/Fail/Warn.
 */

export const AUDIT_SITE_CHECKS: { id: string; label: string; path: string }[] = [
  { id: 'landing', label: 'Landing page', path: '/' },
  { id: 'terms', label: 'Terms of Service', path: '/terms' },
  { id: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { id: 'hq', label: 'HQ', path: '/hq' },
  { id: 'firedemo', label: 'Fire demo', path: '/fire-demo' },
];

export const AUDIT_MANUAL_GROUPS: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: 'Worker flow',
    items: [
      { id: 'w1', label: 'Landing → "Start organizing" begins an intake' },
      { id: 'w2', label: 'Story step shows the reassurance line' },
      { id: 'w3', label: 'Upload: "Don’t have your records handy?" expands' },
      { id: 'w4', label: 'Upload accepts a PDF' },
      { id: 'w5', label: 'Summary shows the organized timeline' },
      { id: 'w6', label: '"Where these records can go" handoff renders' },
    ],
  },
  {
    group: 'Firm flow',
    items: [
      { id: 'f1', label: 'For-firms page loads' },
      { id: 'f2', label: '"Request pilot access" form submits' },
      { id: 'f3', label: 'Firm demo (/?demo) loads' },
      { id: 'f4', label: 'Firm dashboard renders an intake' },
    ],
  },
  {
    group: 'HQ / CRM',
    items: [
      { id: 'h1', label: 'Sign in to /hq works' },
      { id: 'h2', label: 'Firms list loads (prospects present)' },
      { id: 'h3', label: 'Fast-log works in 3 taps or fewer' },
      { id: 'h4', label: 'Tap-to-call opens the phone dialer (mobile)' },
      { id: 'h5', label: 'Team chat / Notes post and appear' },
    ],
  },
];
