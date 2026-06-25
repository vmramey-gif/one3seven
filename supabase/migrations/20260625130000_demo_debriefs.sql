-- Post-demo debrief capture for the company demo guide (/company-demo/debrief).
-- A sales rep (or founder) logs what happened on a prospect call within ~10 min.
-- RLS matches the audited CRM pattern: members insert; a rep reads their own, founder reads all.

create table if not exists public.demo_debriefs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  firm_name        text not null,
  prospect_name    text,
  pain_phrase      text,
  lean_in_moment   text check (lean_in_moment is null or lean_in_moment in ('mess', 'timeline', 'citation', 'other')),
  fell_flat        text,
  objections       text,
  feature_request  text,
  asked_for_search boolean not null default false,  -- tracked product signal (AI-search trigger)
  outcome          text check (outcome is null or outcome in ('yes', 'maybe', 'no')),
  next_step        text,
  next_step_date   date,
  improvement      text
);

alter table public.demo_debriefs enable row level security;

-- Insert: any CRM member (founder or active rep). created_by defaults to auth.uid().
drop policy if exists "demo_debriefs_insert_members" on public.demo_debriefs;
create policy "demo_debriefs_insert_members" on public.demo_debriefs
  for insert to authenticated
  with check (public.is_crm_member());

-- Select: founder reads all; a rep reads only their own debriefs.
drop policy if exists "demo_debriefs_select_own_or_founder" on public.demo_debriefs;
create policy "demo_debriefs_select_own_or_founder" on public.demo_debriefs
  for select to authenticated
  using (public.is_founder() or created_by = auth.uid());

-- No update/delete policies, no anon/public access (intentional).
