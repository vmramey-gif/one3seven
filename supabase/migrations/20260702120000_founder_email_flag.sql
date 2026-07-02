-- Founder email queue: a firm-level flag so "Victoria to email f/u" taps collect into their own
-- reliable list (not derived from the capped activity log). Set true when a rep flags the firm,
-- cleared when the founder marks it emailed.
alter table public.crm_firms
  add column if not exists needs_founder_email boolean not null default false;

create index if not exists crm_firms_needs_founder_email_idx
  on public.crm_firms(needs_founder_email) where needs_founder_email;

notify pgrst, 'reload schema';
