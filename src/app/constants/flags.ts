/**
 * Dev-only: internal screen map + gallery entry. **Live app / beta:** leave unset so this stays `false`.
 * When `true` without Supabase env, only `devNavMap` and `gallery` screens load (no fake auth).
 * Set `VITE_SHOW_DEV_GALLERY=true` in `.env` locally for UI previews.
 */
const IS_LOCAL_DEV_BUILD = import.meta.env.DEV;

export const SHOW_DEV_GALLERY =
  IS_LOCAL_DEV_BUILD && import.meta.env.VITE_SHOW_DEV_GALLERY === 'true';

/**
 * When true in local dev only (dev gallery OR `VITE_SHOW_SAMPLE_INTAKE=true`), show exactly one
 * labeled sample intake on worker and firm dashboards if there is no real data yet.
 */
export const SHOW_SAMPLE_INTAKE =
  IS_LOCAL_DEV_BUILD && (SHOW_DEV_GALLERY || import.meta.env.VITE_SHOW_SAMPLE_INTAKE === 'true');

/** Beta: hide worker settings billing/plan copy (no payment in beta). */
export const BETA_HIDE_WORKER_BILLING_UI = true;

/** Beta: hide firm dashboard Archived tab (archive workflow not shipped). */
export const BETA_HIDE_FIRM_ARCHIVED_TAB = true;

/**
 * Participating preview routing (no firm code). Off only when
 * `VITE_ENABLE_PARTICIPATING_ROUTING=false` is set explicitly.
 */
export const BETA_ENABLE_PARTICIPATING_ROUTING =
  import.meta.env.VITE_ENABLE_PARTICIPATING_ROUTING !== 'false';

/**
 * Master switch for the participating-firm NETWORK (broadcasting a worker's intake to a pool
 * of firms). OFF by default — the safe, conventional model is worker-directed: the worker
 * sends their intake to a specific firm they choose (firm code / direct link).
 *
 * GATED PENDING COUNSEL: turning this on makes one3seven route intakes across a network of
 * firms, which may implicate California lawyer-referral-service rules (Bus. & Prof. Code
 * §6155) and fee-splitting. Do NOT flip to true until counsel signs off and Terms §5 is
 * updated to match. When false, no participating-network surface renders anywhere.
 */
export const PARTICIPATING_NETWORK_LIVE = false;

/**
 * Master switch for firm-code routing (a worker enters a specific firm's code and their intake
 * shares immediately, full access). OFF 2026-08-16 — GATED PENDING FUNDING/COUNSEL, not a UPL
 * question like PARTICIPATING_NETWORK_LIVE above: founder directive is to push only the
 * worker side (no legal tension) while there's no money to engage counsel yet, and any "send to
 * your firm" CTA implies the firm already has a one3seven account, which is exactly the
 * firm-side surface being paused. When false, every firm-code entry/share CTA should render the
 * same disabled "Coming soon" treatment already proven for PARTICIPATING_NETWORK_LIVE — see
 * project_strategy_pause_attorney_push_worker memory. Re-enable when the founder says the firm
 * side is back on.
 */
export const FIRM_CODE_ROUTING_LIVE = false;
