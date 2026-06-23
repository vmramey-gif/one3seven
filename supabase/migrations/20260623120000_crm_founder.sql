-- Founder-facing CRM (internal sales tooling). Founder-only access; no worker/firm/anon access.
--
-- After applying this migration, an operator must mark the founder account, e.g. in the
-- Supabase SQL editor (service role):
--   update public.profiles set is_founder = true where email = 'vmramey@gmail.com';
-- (No email is hardcoded into any policy — access is keyed on the is_founder flag.)

-- Founder flag on profiles.
alter table public.profiles add column if not exists is_founder boolean not null default false;

-- RLS-safe founder check. SECURITY DEFINER so the policy subquery does not recurse through
-- profiles' own RLS. STABLE; locked search_path.
create or replace function public.is_founder()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_founder from public.profiles p where p.id = auth.uid()), false);
$$;
grant execute on function public.is_founder() to authenticated;

-- Sales pipeline: firms being worked for pilot acquisition.
create table if not exists public.crm_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  attorney_name text,
  phone text,
  email text,
  website text,
  region text,
  priority text check (priority in ('A', 'B', 'C')),
  stage text not null default 'target'
    check (stage in ('target', 'contacted', 'convo', 'demo_booked', 'demo_done', 'pilot', 'paid', 'no', 'nurture')),
  focus_areas text,
  source text,
  next_followup date,
  notes text,
  created_at timestamptz not null default now()
);

-- Activity log: calls, emails, demos against firms.
create table if not exists public.crm_activity (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.crm_firms(id) on delete cascade,
  activity_type text check (activity_type in ('call', 'email', 'demo')),
  activity_date date not null,
  outcome text,
  who_answered text,
  objection text,
  interest_level text check (interest_level in ('hot', 'warm', 'cold')),
  next_followup date,
  new_stage text
    check (new_stage in ('target', 'contacted', 'convo', 'demo_booked', 'demo_done', 'pilot', 'paid', 'no', 'nurture')),
  notes text,
  created_at timestamptz not null default now()
);

-- RLS: founder-only for everything. No anon policy at all => logged-out fully denied.
alter table public.crm_firms enable row level security;
alter table public.crm_activity enable row level security;

drop policy if exists "crm_firms_founder_all" on public.crm_firms;
create policy "crm_firms_founder_all" on public.crm_firms
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists "crm_activity_founder_all" on public.crm_activity;
create policy "crm_activity_founder_all" on public.crm_activity
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

create index if not exists crm_activity_firm_id_idx on public.crm_activity(firm_id);
create index if not exists crm_firms_stage_idx on public.crm_firms(stage);

notify pgrst, 'reload schema';
