-- Worker-readable firm name/code without opening firm_profiles to broad SELECT.
-- Workers only see firms linked to their own intakes or resolved by firm code lookup.

create or replace function public.worker_lookup_firm_display_by_code(p_code text)
returns table(firm_id uuid, firm_name text, firm_code text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select fp.id, fp.firm_name, upper(trim(fp.firm_code))
  from public.firm_profiles fp
  where upper(trim(fp.firm_code)) = upper(trim(p_code))
  limit 1;
end;
$$;

create or replace function public.worker_linked_firm_display_for_intake(p_intake_id uuid)
returns table(firm_id uuid, firm_name text, firm_code text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select fp.id, fp.firm_name, upper(trim(fp.firm_code))
  from public.intakes i
  join public.firm_profiles fp on fp.id = i.linked_firm_id
  where i.id = p_intake_id
    and i.worker_id = auth.uid()
    and i.linked_firm_id is not null;
end;
$$;

create or replace function public.worker_intake_firm_routing_displays(p_worker_id uuid)
returns table(
  intake_id uuid,
  intake_number text,
  workflow_status text,
  submission_channel text,
  linked_firm_id uuid,
  firm_name text,
  firm_code text,
  route_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    i.id,
    i.intake_number,
    i.workflow_status,
    i.submission_channel,
    i.linked_firm_id,
    fp.firm_name,
    upper(trim(fp.firm_code)),
    r.route_status::text
  from public.intakes i
  left join public.firm_profiles fp on fp.id = i.linked_firm_id
  left join lateral (
    select fir.route_status
    from public.firm_intake_routes fir
    where fir.intake_id = i.id
      and fir.firm_id = i.linked_firm_id
    order by fir.created_at desc
    limit 1
  ) r on true
  where i.worker_id = p_worker_id
  order by i.updated_at desc;
end;
$$;

revoke all on function public.worker_lookup_firm_display_by_code(text) from public;
grant execute on function public.worker_lookup_firm_display_by_code(text) to authenticated;

revoke all on function public.worker_linked_firm_display_for_intake(uuid) from public;
grant execute on function public.worker_linked_firm_display_for_intake(uuid) to authenticated;

revoke all on function public.worker_intake_firm_routing_displays(uuid) from public;
grant execute on function public.worker_intake_firm_routing_displays(uuid) to authenticated;
