-- Full-access request/approval notifications + RPCs (worker bell + firm refresh signal).

alter table public.notifications drop constraint if exists notifications_notification_type_check;

alter table public.notifications add constraint notifications_notification_type_check check (
  notification_type in (
    'firm_document_request',
    'worker_documents_submitted',
    'worker_full_access_request',
    'firm_full_access_granted'
  )
);

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
    'firm_document_request',
    'worker_documents_submitted',
    'worker_full_access_request',
    'firm_full_access_granted'
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
    recipient_user_id,
    recipient_kind,
    notification_type,
    title,
    body,
    payload,
    related_intake_id,
    related_route_id
  )
  values (
    p_recipient_user_id,
    p_recipient_kind,
    p_notification_type,
    trim(p_title),
    nullif(trim(coalesce(p_body, '')), ''),
    coalesce(p_payload, '{}'::jsonb),
    p_related_intake_id,
    p_related_route_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.firm_request_full_access(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_id uuid;
  v_worker_user_id uuid;
  v_firm_name text;
begin
  select r.intake_id, i.worker_id, fp.firm_name
    into v_intake_id, v_worker_user_id, v_firm_name
  from public.firm_intake_routes r
  join public.firm_profiles fp on fp.id = r.firm_id
  join public.intakes i on i.id = r.intake_id
  where r.id = p_route_id
    and fp.profile_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  update public.firm_intake_routes
  set route_status = 'access_requested',
      access_requested_at = now()
  where id = p_route_id;

  update public.intakes
  set workflow_status = 'Firm Interest Received',
      updated_at = now()
  where id = v_intake_id;

  perform public.insert_notification(
    p_recipient_user_id => v_worker_user_id,
    p_recipient_kind => 'worker',
    p_notification_type => 'worker_full_access_request',
    p_title => coalesce(nullif(trim(v_firm_name), ''), 'A firm') || ' requested full review access',
    p_body => 'Open your intake summary to approve or decline full review access for your organized records.',
    p_payload => jsonb_build_object(
      'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'A firm'),
      'action', 'approve_full_access'
    ),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );
end;
$$;

grant execute on function public.firm_request_full_access(uuid) to authenticated;

create or replace function public.worker_approve_full_access(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  from public.firm_intake_routes r
  join public.intakes i on i.id = r.intake_id
  join public.firm_profiles fp on fp.id = r.firm_id
  where r.id = p_route_id
    and i.worker_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  update public.firm_intake_routes
  set route_status = 'full_access',
      worker_approved_at = v_decided
  where id = p_route_id;

  update public.intakes
  set workflow_status = 'Shared with Participating Firm',
      updated_at = now()
  where id = v_intake_id;

  perform public.insert_notification(
    p_recipient_user_id => v_firm_user_id,
    p_recipient_kind => 'firm',
    p_notification_type => 'firm_full_access_granted',
    p_title => 'Full review access approved',
    p_body => 'The worker approved full access. You can open uploaded files from your firm dashboard or intake review.',
    p_payload => jsonb_build_object(
      'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm'),
      'route_status', 'full_access'
    ),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );
end;
$$;

grant execute on function public.worker_approve_full_access(uuid) to authenticated;
