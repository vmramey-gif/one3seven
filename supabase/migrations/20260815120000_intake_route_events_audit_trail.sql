-- Consent/access audit trail for intake_routes.
--
-- Problem: intake_routes has 8 timestamp columns (preview_sent_at, access_requested_at,
-- full_access_granted_at, worker_approved_at, worker_decided_at, firm_first_opened_at,
-- firm_accepted_at, firm_declined_at) that look like an audit trail but are plain mutable
-- columns on a single current-state row. worker_remove_firm_code_from_intake DELETEs the row
-- outright, destroying all history of what a firm was ever granted and when it was revoked.
-- RLS proves *whether* a query can succeed, not *whether an access event was ever recorded* --
-- this closes that second, separate gap.
--
-- Fix: an append-only intake_route_events table, populated by a trigger on intake_routes
-- (not by editing each call site). Every current write path -- route_intake_to_firm_code,
-- worker_route_preview_to_participating_firms, firm_request_full_access,
-- worker_approve_full_access, worker_remove_firm_code_from_intake's DELETE, and the direct
-- client-side .update() in recordFirmRouteEvent (intakeDataService.ts) for
-- firm_first_opened_at/firm_accepted_at/firm_declined_at -- writes to intake_routes through
-- ordinary INSERT/UPDATE/DELETE, so a row-level trigger catches all of them, including future
-- ones, without needing to be threaded through every RPC by hand.
--
-- Retention: intake_route_events cascades away with its parent intake (FK ON DELETE CASCADE,
-- matching uploaded_files/timeline_events/intake_summaries), so a worker's CCPA deletion
-- request still purges everything, including this trail. That is a deliberate scope choice --
-- this migration closes the "was anything recorded at all" gap, not a change to how long
-- records survive after a deletion request. Longer retention for compliance purposes,
-- if ever wanted, is a separate product/legal decision (see project_vendor_data_duties).

create table if not exists public.intake_route_events (
  id                    uuid primary key default gen_random_uuid(),
  intake_id             uuid not null references public.intakes (id) on delete cascade,
  firm_id               uuid not null references public.firm_profiles (id) on delete cascade,
  route_id              uuid not null, -- not FK'd: must survive the parent intake_routes row being deleted (revoke)
  event_type            text not null check (event_type in (
    'route_created',
    'route_status_changed',
    'preview_sent',
    'access_requested',
    'full_access_granted',
    'worker_approved',
    'worker_decided',
    'firm_first_opened',
    'firm_accepted',
    'firm_declined',
    'route_revoked'
  )),
  route_status          text,
  previous_route_status text,
  actor_user_id         uuid, -- auth.uid() at time of write; null if none was set (e.g. a service-role backfill)
  occurred_at           timestamptz not null default now()
);

create index if not exists intake_route_events_intake_id_idx on public.intake_route_events (intake_id, occurred_at);
create index if not exists intake_route_events_firm_id_idx on public.intake_route_events (firm_id, occurred_at);

alter table public.intake_route_events enable row level security;

-- Immutable from the client in every direction: no insert/update/delete policy is granted to
-- authenticated for anything but the explicit insert-deny below. Only the SECURITY DEFINER
-- trigger function (running as the migration-owner role, which bypasses RLS -- the same pattern
-- insert_notification already uses against notifications' identical insert-deny policy) can
-- write rows.
drop policy if exists intake_route_events_insert_deny on public.intake_route_events;
create policy intake_route_events_insert_deny
  on public.intake_route_events
  for insert
  to authenticated
  with check (false);

drop policy if exists intake_route_events_select_parties on public.intake_route_events;
create policy intake_route_events_select_parties
  on public.intake_route_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.intakes i
      where i.id = intake_route_events.intake_id
        and i.worker_id = auth.uid()
    )
    or exists (
      select 1 from public.firm_profiles fp
      where fp.id = intake_route_events.firm_id
        and fp.profile_id = auth.uid()
    )
  );

drop policy if exists intake_route_events_select_founder on public.intake_route_events;
create policy intake_route_events_select_founder
  on public.intake_route_events
  for select
  to authenticated
  using (public.is_founder());

-- No update/delete policy exists for any role -- RLS enabled + zero permissive policies for
-- those commands means UPDATE and DELETE are refused outright, including for founders.

create or replace function public.log_intake_route_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.intake_route_events
      (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
    values
      (new.intake_id, new.firm_id, new.id, 'route_created', new.route_status, v_actor);

    -- A route can be INSERTed with one or more of these already set in the same statement
    -- (route_intake_to_firm_code and worker_route_preview_to_participating_firms both do this
    -- rather than insert-then-update) -- log those transitions too, not just route_created.
    if new.preview_sent_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'preview_sent', new.route_status, v_actor);
    end if;

    if new.access_requested_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'access_requested', new.route_status, v_actor);
    end if;

    if new.full_access_granted_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'full_access_granted', new.route_status, v_actor);
    end if;

    if new.worker_approved_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'worker_approved', new.route_status, v_actor);
    end if;

    if new.worker_decided_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'worker_decided', new.route_status, v_actor);
    end if;

    if new.firm_first_opened_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_first_opened', new.route_status, v_actor);
    end if;

    if new.firm_accepted_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_accepted', new.route_status, v_actor);
    end if;

    if new.firm_declined_at is not null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_declined', new.route_status, v_actor);
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.route_status is distinct from old.route_status then
      insert into public.intake_route_events
        (intake_id, firm_id, route_id, event_type, route_status, previous_route_status, actor_user_id)
      values
        (new.intake_id, new.firm_id, new.id, 'route_status_changed', new.route_status, old.route_status, v_actor);
    end if;

    if new.preview_sent_at is not null and old.preview_sent_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'preview_sent', new.route_status, v_actor);
    end if;

    if new.access_requested_at is not null and old.access_requested_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'access_requested', new.route_status, v_actor);
    end if;

    if new.full_access_granted_at is not null and old.full_access_granted_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'full_access_granted', new.route_status, v_actor);
    end if;

    if new.worker_approved_at is not null and old.worker_approved_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'worker_approved', new.route_status, v_actor);
    end if;

    if new.worker_decided_at is not null and old.worker_decided_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'worker_decided', new.route_status, v_actor);
    end if;

    if new.firm_first_opened_at is not null and old.firm_first_opened_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_first_opened', new.route_status, v_actor);
    end if;

    if new.firm_accepted_at is not null and old.firm_accepted_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_accepted', new.route_status, v_actor);
    end if;

    if new.firm_declined_at is not null and old.firm_declined_at is null then
      insert into public.intake_route_events (intake_id, firm_id, route_id, event_type, route_status, actor_user_id)
      values (new.intake_id, new.firm_id, new.id, 'firm_declined', new.route_status, v_actor);
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.intake_route_events
      (intake_id, firm_id, route_id, event_type, previous_route_status, actor_user_id)
    values
      (old.intake_id, old.firm_id, old.id, 'route_revoked', old.route_status, v_actor);
    return old;
  end if;

  return null;
end;
$$;

revoke all on function public.log_intake_route_event() from public;

drop trigger if exists intake_routes_log_events on public.intake_routes;
create trigger intake_routes_log_events
  after insert or update or delete on public.intake_routes
  for each row execute function public.log_intake_route_event();

notify pgrst, 'reload schema';
