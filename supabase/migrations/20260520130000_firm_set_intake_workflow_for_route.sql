-- Firm-triggered intake workflow updates (RLS blocks firm UPDATE on intakes).

create or replace function public.firm_set_intake_workflow_for_route(
  p_route_id uuid,
  p_workflow_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_id uuid;
begin
  if trim(coalesce(p_workflow_status, '')) = '' then
    raise exception 'Workflow status is required' using errcode = '22023';
  end if;

  select r.intake_id
    into v_intake_id
  from public.firm_intake_routes r
  join public.firm_profiles fp on fp.id = r.firm_id
  where r.id = p_route_id
    and fp.profile_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  update public.intakes
  set workflow_status = trim(p_workflow_status),
      updated_at = now()
  where id = v_intake_id;

  return v_intake_id;
end;
$$;

grant execute on function public.firm_set_intake_workflow_for_route(uuid, text) to authenticated;
