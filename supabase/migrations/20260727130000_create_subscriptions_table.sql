-- Capture the public.subscriptions billing-bookkeeping table in version control.
--
-- Root cause: this table was created out-of-band in the live DB and exists in NO migration
-- or schema file, yet three CRM analytics view migrations (20260626100000 /
-- 20260626110000 / 20260708120000) `left join public.subscriptions`, and the billing edge
-- functions (create-checkout-session upsert, create-portal-session select, stripe-webhook
-- update) all read/write it. The schema was therefore non-reproducible from source.
--
-- This migration is IDEMPOTENT: on prod (table already present) `if not exists` is a no-op
-- and only the RLS statements re-assert. On a fresh environment it creates the table with
-- the exact columns the functions use.
--
-- NOTE: firm_profiles (the FK target) is defined in supabase/schema.sql — this repo's model
-- is schema.sql = canonical base, migrations = deltas. This table conceptually belongs with
-- firm_profiles in that base; it is captured here so it is at least versioned and RLS-guarded.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  firm_profile_id uuid not null unique references public.firm_profiles(id) on delete cascade,
  external_customer_id text,
  plan_id text not null default 'beta_pilot',
  status text not null default 'trialing',
  provider text not null default 'stripe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bookkeeping row is billing-sensitive: the firm owner may read their own; all writes go
-- through the edge functions (service role, which bypasses RLS). No client write path.
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_firm_select_own" on public.subscriptions;
create policy "subscriptions_firm_select_own" on public.subscriptions
  for select using (
    exists (
      select 1 from public.firm_profiles fp
      where fp.id = subscriptions.firm_profile_id and fp.profile_id = auth.uid()
    )
  );
