-- Participating preview routing (beta): worker cannot SELECT other firms' firm_profiles under RLS.
-- Routes are created via SECURITY DEFINER RPC using real firm_profiles + firm_intake_routes rows.
--
-- Eligibility (application logic): subscription_status in ('trialing', 'active'); up to 3 firms per send.
-- practice_areas / geographic_filters are NOT filtered in MVP routing.
--
-- After migration: ensure at least one firm_profiles row exists (firm sign-up in app).
-- The UPDATE below marks existing firms as eligible without creating fake activity.

update public.firm_profiles
set subscription_status = 'active'
where coalesce(subscription_status, '') not in ('trialing', 'active');

create or replace function public.worker_route_preview_to_participating_firms(
  p_intake_id uuid,
  p_exclude_firm_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid := auth.uid();
  v_linked uuid;
  v_channel text;
  v_count int := 0;
  v_firm record;
  v_route_id uuid;
begin
  if v_worker_id is null then
    return jsonb_build_object('error', 'Not authenticated', 'count', 0);
  end if;

  select i.linked_firm_id, i.submission_channel
  into v_linked, v_channel
  from public.intakes i
  where i.id = p_intake_id
    and i.worker_id = v_worker_id;

  if not found then
    return jsonb_build_object('error', 'Intake not found', 'count', 0);
  end if;

  if v_linked is not null or v_channel = 'firm_code' then
    return jsonb_build_object(
      'error',
      'This intake is connected via a Firm Code. Participating firm previews are not used.',
      'count',
      0
    );
  end if;

  for v_firm in
    select fp.id
    from public.firm_profiles fp
    where fp.subscription_status in ('trialing', 'active')
      and (p_exclude_firm_id is null or fp.id <> p_exclude_firm_id)
    order by fp.created_at asc
    limit 3
  loop
    insert into public.firm_intake_routes (intake_id, firm_id, route_status, preview_sent_at)
    values (p_intake_id, v_firm.id, 'preview_sent', now())
    on conflict (intake_id, firm_id) do update
      set route_status = 'preview_sent',
          preview_sent_at = coalesce(public.firm_intake_routes.preview_sent_at, excluded.preview_sent_at)
    returning id into v_route_id;

    if v_route_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count > 0 then
    update public.intakes
    set submission_channel = 'participating'
    where id = p_intake_id;
  end if;

  return jsonb_build_object('count', v_count, 'error', null);
end;
$$;

revoke all on function public.worker_route_preview_to_participating_firms(uuid, uuid) from public;
grant execute on function public.worker_route_preview_to_participating_firms(uuid, uuid) to authenticated;
