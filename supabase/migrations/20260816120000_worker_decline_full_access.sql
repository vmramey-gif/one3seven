-- Worker decline path for a firm's full-access request. Until now only "Approve" existed
-- (worker_approve_full_access, 20260528120000) -- a worker who did not want to grant a specific
-- firm full access had no way to say so; the request just sat there indefinitely. The
-- route_status column already anticipated this (its CHECK constraint has allowed 'declined'
-- since the baseline reconciliation), the RPC to actually reach that state was simply never
-- built.
--
-- Mirrors worker_approve_full_access's shape exactly (same auth check, same notify-the-firm
-- pattern) but does NOT touch intakes.workflow_status -- a decline doesn't end the relationship,
-- the firm still has whatever preview access it already had; only the specific access-level
-- upgrade request is being said no to. The intake_route_events trigger (20260815120000) already
-- logs this as a route_status_changed event automatically -- no additional audit-trail work
-- needed here.

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in (
    'firm_document_request', 'worker_documents_submitted',
    'worker_full_access_request', 'firm_full_access_granted', 'firm_full_access_declined',
    'firm_reminder_added'
  ));

create or replace function public.insert_notification(
  p_recipient_user_id uuid,
  p_recipient_kind text,
  p_notification_type text,
  p_title text,
  p_body text default null,
  p_payload jsonb default '{}'::jsonb,
  p_related_intake_id uuid default null,
  p_related_route_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_recipient_kind not in ('worker', 'firm') then
    raise exception 'Invalid recipient_kind' using errcode = '22023';
  end if;

  if p_notification_type not in (
    'firm_document_request', 'worker_documents_submitted',
    'worker_full_access_request', 'firm_full_access_granted', 'firm_full_access_declined',
    'firm_reminder_added'
  ) then
    raise exception 'Invalid notification_type' using errcode = '22023';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Notification title is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from auth.users u where u.id = p_recipient_user_id
  ) then
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
$$;

create or replace function public.worker_decline_full_access(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_id uuid;
  v_worker_user_id uuid;
  v_firm_name text;
  v_firm_user_id uuid;
begin
  select r.intake_id, i.worker_id, fp.firm_name, fp.profile_id
    into v_intake_id, v_worker_user_id, v_firm_name, v_firm_user_id
  from public.firm_intake_routes r
  join public.intakes i on i.id = r.intake_id
  join public.firm_profiles fp on fp.id = r.firm_id
  where r.id = p_route_id
    and i.worker_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  update public.firm_intake_routes
  set route_status = 'declined'
  where id = p_route_id;

  perform public.insert_notification(
    p_recipient_user_id => v_firm_user_id,
    p_recipient_kind => 'firm',
    p_notification_type => 'firm_full_access_declined',
    p_title => 'Full access request declined',
    p_body => 'The worker declined the full-access request for now. Your existing preview access is unchanged.',
    p_payload => jsonb_build_object(
      'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm'),
      'route_status', 'declined'
    ),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );
end;
$$;

grant execute on function public.worker_decline_full_access(uuid) to authenticated;

notify pgrst, 'reload schema';
