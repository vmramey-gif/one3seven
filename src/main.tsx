
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { SupabaseConfigRequired } from './app/components/SupabaseConfigRequired.tsx';
import { AppErrorBoundary } from './app/components/AppErrorBoundary.tsx';
import { DemoApp } from './app/screens/DemoApp.tsx';
import { WorkerDemoPage } from './app/screens/WorkerDemoPage.tsx';
import { FireWorkerDemoPage } from './app/screens/FireWorkerDemoPage.tsx';
import { TexasCriminalDemoPage } from './app/screens/TexasCriminalDemoPage.tsx';
import { FounderHQ } from './app/screens/FounderHQ.tsx';
import { CompanyDemoGuide } from './app/screens/CompanyDemoGuide.tsx';
import { CompanyDemoDebrief } from './app/screens/CompanyDemoDebrief.tsx';
import { CrmAccessGate } from './app/components/CrmAccessGate.tsx';
import { TermsPage } from './app/screens/TermsPage.tsx';
import { PrivacyPage } from './app/screens/PrivacyPage.tsx';
import { ForFirmsPage } from './app/screens/ForFirmsPage.tsx';
import { OFFLINE_DEV_GALLERY_ONLY } from './lib/supabaseAvailability.ts';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { pageview, startHeartbeat } from './lib/analytics';

const rootEl = document.getElementById('root')!;

// First-party pageview (cookieless, no PII, honors DNT) + session-length heartbeat.
pageview();
startHeartbeat();

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

const isFireDemo =
  url.searchParams.has('fire-demo') ||
  url.pathname === '/fire-demo';

const isTxDemo =
  url.searchParams.has('tx-demo') ||
  url.pathname === '/tx-demo';

const isHQ =
  url.searchParams.has('hq') ||
  url.pathname === '/hq' ||
  url.pathname === '/one3sevenhq';

const isForFirms =
  url.searchParams.has('for-firms') ||
  url.pathname === '/for-firms';

// Worker home moved off "/" — anonymous workers start here; "/" is now firm-first.
const isWorkers =
  url.searchParams.has('workers') ||
  url.pathname === '/workers';

// Does a Supabase auth session already exist in this browser? (synchronous localStorage check).
// Used so returning logged-in users still land in their app at "/", not the firm marketing page.
function hasAuthSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token') && localStorage.getItem(k)) return true;
    }
  } catch { /* localStorage unavailable — treat as no session */ }
  return false;
}

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

// Firm-first front door: bare "/" shows the For-Firms page ONLY for anonymous visitors with no
// firm-code intake link. Firm-code links (?fc=) and returning logged-in users fall through to <App/>.
const isRootFirmFront =
  url.pathname === '/' && !prefillFirmCode?.trim() && !isWorkers && !hasAuthSession();

if (url.pathname === '/terms') {
  createRoot(rootEl).render(<AppErrorBoundary><TermsPage /></AppErrorBoundary>);
} else if (url.pathname === '/privacy') {
  createRoot(rootEl).render(<AppErrorBoundary><PrivacyPage /></AppErrorBoundary>);
} else if (url.pathname === '/company-demo/debrief') {
  createRoot(rootEl).render(
    <AppErrorBoundary><CrmAccessGate><CompanyDemoDebrief /></CrmAccessGate></AppErrorBoundary>
  );
} else if (url.pathname === '/company-demo') {
  createRoot(rootEl).render(
    <AppErrorBoundary><CrmAccessGate><CompanyDemoGuide /></CrmAccessGate></AppErrorBoundary>
  );
} else if (isHQ) {
  createRoot(rootEl).render(
    <AppErrorBoundary><FounderHQ /></AppErrorBoundary>
  );
} else if (isFireDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><FireWorkerDemoPage /></AppErrorBoundary>
  );
} else if (isTxDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><TexasCriminalDemoPage /></AppErrorBoundary>
  );
} else if (isWorkerDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><WorkerDemoPage /></AppErrorBoundary>
  );
} else if (isDemo) {
  createRoot(rootEl).render(
    <AppErrorBoundary><DemoApp /></AppErrorBoundary>
  );
} else if (isForFirms || isRootFirmFront) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <ForFirmsPage
        onBack={() => { window.location.href = '/'; }}
        onStartWorker={() => { window.location.href = '/workers'; }}
      />
    </AppErrorBoundary>
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
