-- Notify firm when worker confirms/submits requested additional documents.

create or replace function public.worker_notify_firm_documents_submitted(
  p_intake_id uuid,
  p_route_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_user_id uuid;
  v_firm_user_id uuid;
  v_firm_name text;
  v_route_id uuid;
  v_linked_firm_id uuid;
begin
  select i.worker_id, i.linked_firm_id
    into v_worker_user_id, v_linked_firm_id
  from public.intakes i
  where i.id = p_intake_id
    and i.worker_id = auth.uid();

  if v_worker_user_id is null then
    raise exception 'Intake not found or not allowed' using errcode = '42501';
  end if;

  if p_route_id is not null then
    select r.id, fp.profile_id, fp.firm_name
      into v_route_id, v_firm_user_id, v_firm_name
    from public.firm_intake_routes r
    join public.firm_profiles fp on fp.id = r.firm_id
    where r.id = p_route_id
      and r.intake_id = p_intake_id;
  end if;

  if v_firm_user_id is null then
    select r.id, fp.profile_id, fp.firm_name
      into v_route_id, v_firm_user_id, v_firm_name
    from public.firm_intake_routes r
    join public.firm_profiles fp on fp.id = r.firm_id
    where r.intake_id = p_intake_id
    order by
      case when v_linked_firm_id is not null and r.firm_id = v_linked_firm_id then 0 else 1 end,
      r.created_at desc
    limit 1;
  end if;

  if v_firm_user_id is null or v_route_id is null then
    return false;
  end if;

  perform public.insert_notification(
    p_recipient_user_id => v_firm_user_id,
    p_recipient_kind => 'firm',
    p_notification_type => 'worker_documents_submitted',
    p_title => 'Worker submitted requested records',
    p_body => 'Additional records were uploaded for this intake.',
    p_payload => jsonb_build_object(
      'intake_id', p_intake_id,
      'route_id', v_route_id,
      'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm')
    ),
    p_related_intake_id => p_intake_id,
    p_related_route_id => v_route_id
  );

  return true;
end;
$$;

grant execute on function public.worker_notify_firm_documents_submitted(uuid, uuid) to authenticated;
