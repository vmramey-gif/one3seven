-- Time-saved instrumentation: capture the firm's own estimate of minutes saved per intake.
-- This is the value claim ("we save attorney intake time") turned into a measurable number.
-- Founder/rep CRM only — no worker/firm-facing surface. Reuses crm_firms RLS.

alter table public.crm_firms
  add column if not exists est_minutes_saved int
  check (est_minutes_saved is null or est_minutes_saved >= 0);

notify pgrst, 'reload schema';
