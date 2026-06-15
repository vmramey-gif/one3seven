
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { SupabaseConfigRequired } from './app/components/SupabaseConfigRequired.tsx';
import { AppErrorBoundary } from './app/components/AppErrorBoundary.tsx';
import { DemoApp } from './app/screens/DemoApp.tsx';
import { WorkerDemoPage } from './app/screens/WorkerDemoPage.tsx';
import { TermsPage } from './app/screens/TermsPage.tsx';
import { PrivacyPage } from './app/screens/PrivacyPage.tsx';
import { OFFLINE_DEV_GALLERY_ONLY } from './lib/supabaseAvailability.ts';
import { isSupabaseConfigured } from './lib/supabaseClient';

const rootEl = document.getElementById('root')!;

// Public demo route — no login required.
// Triggered by /?demo, /demo, or #demo in the URL.
const url = new URL(window.location.href);
const isDemo =
  url.searchParams.has('demo') ||
  url.pathname === '/demo' ||
  url.hash === '#demo';

const isWorkerDemo =
  url.searchParams.has('worker-demo') ||
  url.pathname === '/worker-demo';

// Stripe billing return — ?billing=success|canceled|portal_return
// Store in sessionStorage so App.tsx can surface a notification, then strip from URL.
const billingResult = url.searchParams.get('billing');
if (billingResult) {
  try {
    sessionStorage.setItem('o3s_billing_return', billingResult);
    url.searchParams.delete('billing');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
  } catch { /* ignore */ }
}

// Firm intake link — ?fc=FIRMCODE pre-fills the firm code for a worker.
// Store in sessionStorage so it survives the auth flow, then strip from URL.
const prefillFirmCode = url.searchParams.get('fc');
if (prefillFirmCode?.trim()) {
  try {
    sessionStorage.setItem('o3s_prefill_fc', prefillFirmCode.trim().toUpperCase());
    // Clean the URL so it doesn't persist or confuse post-auth routing
    url.searchParams.delete('fc');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
  } catch { /* sessionStorage unavailable — no-op */ }
}

if (url.pathname === '/terms') {
  createRoot(rootEl).render(<AppErrorBoundary><TermsPage /></AppErrorBoundary>);
} else if (url.pathname === '/privacy') {
  createRoot(rootEl).render(<AppErrorBoundary><PrivacyPage /></AppErrorBoundary>);
} else if (isWorkerDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><WorkerDemoPage /></AppErrorBoundary>
  );
} else if (isDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><DemoApp /></AppErrorBoundary>
  );
} else if (!isSupabaseConfigured() && !OFFLINE_DEV_GALLERY_ONLY) {
  createRoot(rootEl).render(
    <AppErrorBoundary><SupabaseConfigRequired /></AppErrorBoundary>
  );
} else {
  createRoot(rootEl).render(
    <AppErrorBoundary><App /></AppErrorBoundary>
  );
}
