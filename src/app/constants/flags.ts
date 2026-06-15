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
