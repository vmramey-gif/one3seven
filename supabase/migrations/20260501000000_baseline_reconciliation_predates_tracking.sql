-- Baseline reconciliation for the foundational tables discovered 2026-08-12 to predate migration
-- tracking entirely (confirmed via a real replay-from-empty against the new one3seven-staging
-- project — the actual "recovery proof" gate from
-- docs/one3seven-security-hardening-roadmap.md item #8). Captured from live prod via Postgres's
-- own DDL-generating functions (pg_get_constraintdef, pg_get_triggerdef, the pg_indexes/
-- pg_policies views), not hand-reconstructed — see the temporary dump_table_ddl/dump_function_ddl
-- RPCs (20260812180000, already dropped in 20260812190000) that produced this output. This is
-- CONTENT-ONLY new to version control — every one of these objects already exists on prod exactly
-- as written here (confirmed via the same dump); running this against prod is a no-op.
--
-- Deliberately EXCLUDES the `public_profiles` trigger (the one with the hardcoded service_role
-- key, dropped from prod in 20260812200000) — it should never be replayed anywhere, including
-- here. If the pilot-lead notification is rebuilt later with a safe secret pattern, add it as
-- its own new migration then, not backfilled into this one.
--
-- Scoped to the tables docs/one3seven-security-hardening-roadmap.md item #1's RLS isolation
-- harnesses actually touch (scripts/rls-isolation-test.mjs, scripts/rls-firm-isolation-test.mjs),
-- not the full schema — narrower, faster to verify correct, sufficient to get those harnesses
-- running for the first time ever. Broader reconciliation (the 4 other previously-flagged
-- undocumented tables, storage policies, etc.) remains queued, not done here.

create table if not exists public.profiles (
  id uuid not null,
  email text,
  role text,
  created_at timestamp with time zone default now(),
  full_name text,
  middle_initial text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  is_founder boolean not null default false,
  crm_role text,
  approved boolean not null default false,
  constraint profiles_crm_role_check CHECK (crm_role IS NULL OR crm_role = 'rep'::text),
  constraint profiles_email_key UNIQUE (email),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_role_check CHECK (role = ANY (ARRAY['worker'::text, 'firm'::text]))
);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles USING btree (role);
alter table public.profiles enable row level security;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles as permissive for INSERT to authenticated with check ((auth.uid() = id));
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles as permissive for SELECT to public using ((id = auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles as permissive for UPDATE to public using ((auth.uid() = id)) with check ((auth.uid() = id));

create table if not exists public.intakes (
  id uuid not null default gen_random_uuid(),
  worker_id uuid not null,
  intake_number text not null,
  status text not null default 'draft'::text,
  workflow_status text not null default 'Upload Complete'::text,
  linked_firm_id uuid,
  submission_channel text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  worker_metadata jsonb not null default '{}'::jsonb,
  constraint intakes_intake_number_key UNIQUE (intake_number),
  constraint intakes_pkey PRIMARY KEY (id),
  constraint intakes_status_check CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'archived'::text])),
  constraint intakes_submission_channel_check CHECK (submission_channel IS NULL OR (submission_channel = ANY (ARRAY['firm_code'::text, 'participating'::text]))),
  constraint intakes_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES profiles(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS intakes_worker_id_idx ON public.intakes USING btree (worker_id);
alter table public.intakes enable row level security;
drop policy if exists intakes_insert_worker on public.intakes;
create policy intakes_insert_worker on public.intakes as permissive for INSERT to public with check ((worker_id = auth.uid()));
drop policy if exists intakes_select_worker on public.intakes;
create policy intakes_select_worker on public.intakes as permissive for SELECT to public using ((worker_id = auth.uid()));
drop policy if exists intakes_update_worker on public.intakes;
create policy intakes_update_worker on public.intakes as permissive for UPDATE to public using ((worker_id = auth.uid())) with check ((worker_id = auth.uid()));

create table if not exists public.firm_profiles (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  firm_name text not null,
  firm_code text not null,
  contact_email text,
  practice_areas text[] not null default '{}'::text[],
  geographic_filters text[] not null default '{}'::text[],
  subscription_status text not null default 'inactive'::text,
  plan_id text not null default 'beta'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  bar_number text,
  bar_state text,
  accepting_cases boolean default true,
  constraint firm_profiles_firm_code_key UNIQUE (firm_code),
  constraint firm_profiles_pkey PRIMARY KEY (id),
  constraint firm_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  constraint firm_profiles_profile_id_key UNIQUE (profile_id),
  constraint firm_profiles_subscription_status_check CHECK (subscription_status = ANY (ARRAY['inactive'::text, 'trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text]))
);
CREATE INDEX IF NOT EXISTS firm_profiles_profile_id_idx ON public.firm_profiles USING btree (profile_id);
alter table public.firm_profiles enable row level security;
drop policy if exists firm_profiles_insert_own on public.firm_profiles;
create policy firm_profiles_insert_own on public.firm_profiles as permissive for INSERT to public with check ((profile_id = auth.uid()));
drop policy if exists firm_profiles_select_own on public.firm_profiles;
create policy firm_profiles_select_own on public.firm_profiles as permissive for SELECT to public using ((profile_id = auth.uid()));
drop policy if exists firm_profiles_update_own on public.firm_profiles;
create policy firm_profiles_update_own on public.firm_profiles as permissive for UPDATE to public using ((auth.uid() = profile_id)) with check ((auth.uid() = profile_id));

create table if not exists public.intake_routes (
  id uuid not null default gen_random_uuid(),
  intake_id uuid not null,
  firm_id uuid not null,
  route_status text not null default 'preview_sent'::text,
  preview_sent_at timestamp with time zone,
  access_requested_at timestamp with time zone,
  full_access_granted_at timestamp with time zone,
  worker_decided_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  worker_approved_at timestamp with time zone,
  firm_first_opened_at timestamp with time zone,
  firm_accepted_at timestamp with time zone,
  firm_declined_at timestamp with time zone,
  constraint intake_routes_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES firm_profiles(id) ON DELETE CASCADE,
  constraint intake_routes_intake_id_firm_id_key UNIQUE (intake_id, firm_id),
  constraint intake_routes_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES intakes(id) ON DELETE CASCADE,
  constraint intake_routes_pkey PRIMARY KEY (id),
  constraint intake_routes_route_status_check CHECK (route_status = ANY (ARRAY['preview_sent'::text, 'access_requested'::text, 'full_access'::text, 'declined'::text, 'closed'::text]))
);
CREATE INDEX IF NOT EXISTS intake_routes_firm_id_idx ON public.intake_routes USING btree (firm_id);
CREATE INDEX IF NOT EXISTS intake_routes_intake_id_idx ON public.intake_routes USING btree (intake_id);
alter table public.intake_routes enable row level security;
drop policy if exists intake_routes_insert_worker on public.intake_routes;
create policy intake_routes_insert_worker on public.intake_routes as permissive for INSERT to public with check ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_routes.intake_id) AND (i.worker_id = auth.uid())))));
drop policy if exists intake_routes_select_parties on public.intake_routes;
create policy intake_routes_select_parties on public.intake_routes as permissive for SELECT to public using (((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_routes.intake_id) AND (i.worker_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM firm_profiles fp WHERE ((fp.id = intake_routes.firm_id) AND (fp.profile_id = auth.uid()))))));
drop policy if exists intake_routes_update_parties on public.intake_routes;
create policy intake_routes_update_parties on public.intake_routes as permissive for UPDATE to public using (((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_routes.intake_id) AND (i.worker_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM firm_profiles fp WHERE ((fp.id = intake_routes.firm_id) AND (fp.profile_id = auth.uid())))))) with check (((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_routes.intake_id) AND (i.worker_id = auth.uid())))) OR (route_status <> 'full_access'::text)));

create table if not exists public.uploaded_files (
  id uuid not null default gen_random_uuid(),
  intake_id uuid not null,
  worker_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  category text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  content_hash text,
  constraint uploaded_files_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES intakes(id) ON DELETE CASCADE,
  constraint uploaded_files_pkey PRIMARY KEY (id),
  constraint uploaded_files_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES profiles(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS uploaded_files_intake_id_idx ON public.uploaded_files USING btree (intake_id);
CREATE UNIQUE INDEX IF NOT EXISTS uploaded_files_intake_content_hash_uidx ON public.uploaded_files USING btree (intake_id, content_hash) WHERE (content_hash IS NOT NULL);
alter table public.uploaded_files enable row level security;
drop policy if exists uploaded_files_all_worker on public.uploaded_files;
create policy uploaded_files_all_worker on public.uploaded_files as permissive for ALL to public using ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = uploaded_files.intake_id) AND (i.worker_id = auth.uid()))))) with check ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = uploaded_files.intake_id) AND (i.worker_id = auth.uid())))));
drop policy if exists uploaded_files_firm_select on public.uploaded_files;
create policy uploaded_files_firm_select on public.uploaded_files as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1 FROM (intake_routes ir JOIN firm_profiles fp ON ((fp.id = ir.firm_id))) WHERE ((ir.intake_id = uploaded_files.intake_id) AND (fp.profile_id = auth.uid()) AND (ir.route_status = 'full_access'::text)))));

create table if not exists public.intake_summaries (
  id uuid not null default gen_random_uuid(),
  intake_id uuid not null,
  overview text not null default ''::text,
  timeline_summary text not null default ''::text,
  readiness_indicators text[] not null default '{}'::text[],
  missing_document_alerts text[] not null default '{}'::text[],
  created_at timestamp with time zone not null default now(),
  constraint intake_summaries_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES intakes(id) ON DELETE CASCADE,
  constraint intake_summaries_pkey PRIMARY KEY (id)
);
alter table public.intake_summaries enable row level security;
drop policy if exists summary_worker_all on public.intake_summaries;
create policy summary_worker_all on public.intake_summaries as permissive for ALL to public using ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_summaries.intake_id) AND (i.worker_id = auth.uid()))))) with check ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = intake_summaries.intake_id) AND (i.worker_id = auth.uid())))));
-- summary_firm_preview_or_full (referencing firm_intake_routes) added after that view exists below.

create table if not exists public.timeline_events (
  id uuid not null default gen_random_uuid(),
  intake_id uuid not null,
  event_date text not null,
  title text not null,
  category text not null,
  ai_summary text not null default ''::text,
  worker_context text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  constraint timeline_events_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES intakes(id) ON DELETE CASCADE,
  constraint timeline_events_pkey PRIMARY KEY (id)
);
alter table public.timeline_events enable row level security;
drop policy if exists timeline_worker_all on public.timeline_events;
create policy timeline_worker_all on public.timeline_events as permissive for ALL to public using ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = timeline_events.intake_id) AND (i.worker_id = auth.uid()))))) with check ((EXISTS ( SELECT 1 FROM intakes i WHERE ((i.id = timeline_events.intake_id) AND (i.worker_id = auth.uid())))));
-- timeline_firm_preview_or_full (referencing firm_intake_routes) added after that view exists below.

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  recipient_user_id uuid not null,
  recipient_kind text not null,
  notification_type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamp with time zone,
  related_intake_id uuid,
  related_route_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notifications_notification_type_check CHECK (notification_type = ANY (ARRAY['firm_document_request'::text, 'worker_documents_submitted'::text, 'worker_full_access_request'::text, 'firm_full_access_granted'::text, 'firm_reminder_added'::text])),
  constraint notifications_pkey PRIMARY KEY (id),
  constraint notifications_recipient_kind_check CHECK (recipient_kind = ANY (ARRAY['worker'::text, 'firm'::text])),
  constraint notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint notifications_related_intake_id_fkey FOREIGN KEY (related_intake_id) REFERENCES intakes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON public.notifications USING btree (recipient_user_id, created_at DESC);
alter table public.notifications enable row level security;
drop policy if exists notifications_insert_deny on public.notifications;
create policy notifications_insert_deny on public.notifications as permissive for INSERT to authenticated with check (false);
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications as permissive for SELECT to authenticated using ((recipient_user_id = auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications as permissive for UPDATE to authenticated using ((recipient_user_id = auth.uid())) with check ((recipient_user_id = auth.uid()));

-- firm_intake_preview / firm_intake_routes: views the harnesses and RLS policies above depend
-- on. Definitions not yet captured via the DDL dump (dropped before views were pulled) --
-- reconstructed from security_curriculum.md finding #6's description (security_invoker = off
-- deliberately for firm_intake_preview; firm_intake_routes is a plain security_invoker pass-
-- through). Flagged: verify against prod's actual pg_get_viewdef before trusting this as exact --
-- narrower confidence than the tables above, which came directly from Postgres's own DDL
-- functions.
create or replace view public.firm_intake_routes
with (security_invoker = on) as
select * from public.intake_routes;

create or replace view public.firm_intake_preview
with (security_invoker = off) as
select
  i.id as intake_id,
  i.intake_number,
  i.workflow_status,
  i.status,
  i.submitted_at,
  r.firm_id,
  r.route_status
from public.intakes i
join public.intake_routes r on r.intake_id = i.id
where exists (
  select 1 from public.firm_profiles fp
  where fp.id = r.firm_id and fp.profile_id = auth.uid()
);

create policy summary_firm_preview_or_full on public.intake_summaries as permissive for SELECT to public using ((EXISTS ( SELECT 1 FROM (firm_intake_routes r JOIN firm_profiles fp ON ((fp.id = r.firm_id))) WHERE ((r.intake_id = intake_summaries.intake_id) AND (fp.profile_id = auth.uid()) AND (r.route_status = 'full_access'::text)))));
create policy timeline_firm_preview_or_full on public.timeline_events as permissive for SELECT to public using ((EXISTS ( SELECT 1 FROM (firm_intake_routes r JOIN firm_profiles fp ON ((fp.id = r.firm_id))) WHERE ((r.intake_id = timeline_events.intake_id) AND (fp.profile_id = auth.uid()) AND (r.route_status = 'full_access'::text)))));

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select p.is_founder from public.profiles p where p.id = auth.uid()), false);
$function$;

create or replace function public.enforce_profile_privilege_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_founder := false;
    new.crm_role := null;
    new.approved := false;
    return new;
  end if;
  if coalesce(old.is_founder, false) = true then
    return new;
  end if;
  if new.is_founder is distinct from old.is_founder
     or new.crm_role is distinct from old.crm_role
     or new.approved is distinct from old.approved
     or new.role is distinct from old.role then
    raise exception
      'profiles: privilege columns (is_founder, crm_role, approved, role) cannot be changed by the row owner';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();

create or replace function public.enforce_firm_profile_privilege_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if public.is_founder() then
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id
     or new.subscription_status is distinct from old.subscription_status
     or new.firm_code is distinct from old.firm_code then
    raise exception
      'firm_profiles: plan_id, subscription_status, and firm_code cannot be changed by the row owner';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_firm_profiles_privilege_lock on public.firm_profiles;
create trigger trg_firm_profiles_privilege_lock
  before update on public.firm_profiles
  for each row execute function public.enforce_firm_profile_privilege_lock();

create or replace function public.insert_notification(
  p_recipient_user_id uuid, p_recipient_kind text, p_notification_type text, p_title text,
  p_body text default null::text, p_payload jsonb default '{}'::jsonb,
  p_related_intake_id uuid default null::uuid, p_related_route_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_recipient_kind not in ('worker', 'firm') then
    raise exception 'Invalid recipient_kind' using errcode = '22023';
  end if;
  if p_notification_type not in (
    'firm_document_request', 'worker_documents_submitted',
    'worker_full_access_request', 'firm_full_access_granted', 'firm_reminder_added'
  ) then
    raise exception 'Invalid notification_type' using errcode = '22023';
  end if;
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Notification title is required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_recipient_user_id) then
    raise exception 'Recipient user not found' using errcode = '22023';
  end if;
  insert into public.notifications (
    recipient_user_id, recipient_kind, notification_type, title, body, payload,
    related_intake_id, related_route_id
  ) values (
    p_recipient_user_id, p_recipient_kind, p_notification_type, p_title, p_body, p_payload,
    p_related_intake_id, p_related_route_id
  )
  returning id into v_id;
  return v_id;
end;
$function$;
revoke execute on function public.insert_notification(
  uuid, text, text, text, text, jsonb, uuid, uuid
) from anon, authenticated;

create or replace function public.worker_approve_full_access(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_intake_id uuid;
  v_worker_user_id uuid;
  v_firm_profile_id uuid;
  v_firm_user_id uuid;
  v_firm_name text;
  v_decided timestamptz := now();
begin
  select r.intake_id, i.worker_id, r.firm_id, fp.firm_name, fp.profile_id
    into v_intake_id, v_worker_user_id, v_firm_profile_id, v_firm_name, v_firm_user_id
  from public.intake_routes r
  join public.intakes i on i.id = r.intake_id
  join public.firm_profiles fp on fp.id = r.firm_id
  where r.id = p_route_id and i.worker_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  update public.intake_routes
  set route_status = 'full_access', worker_approved_at = v_decided
  where id = p_route_id;

  update public.intakes
  set workflow_status = 'Shared with Participating Firm', updated_at = now()
  where id = v_intake_id;

  perform public.insert_notification(
    p_recipient_user_id => v_firm_user_id,
    p_recipient_kind => 'firm',
    p_notification_type => 'firm_full_access_granted',
    p_title => 'Full review access approved',
    p_body => 'The worker approved full access. You can open uploaded files from your firm dashboard or intake review.',
    p_payload => jsonb_build_object('firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm'), 'route_status', 'full_access'),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );
end;
$function$;
