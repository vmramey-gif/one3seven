-- Firm-code routing is an intentional direct handoff from worker to known firm.
-- Keep participating-network routes on preview/access-request flow, but make
-- valid firm-code routes full_access so existing RLS grants original file access.

create or replace function public.route_intake_to_firm_code(
  p_intake_id uuid,
  p_code text
)
returns table(route_id uuid, firm_id uuid, firm_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
  v_firm_name text;
  v_route_id uuid;
begin
  select fp.id, fp.firm_name
    into v_firm_id, v_firm_name
  from public.firm_profiles fp
  where upper(trim(fp.firm_code)) = upper(trim(p_code))
  limit 1;

  if v_firm_id is null then
    raise exception 'Firm code not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.intakes i
    where i.id = p_intake_id
      and i.worker_id = auth.uid()
  ) then
    raise exception 'Intake not found or not allowed' using errcode = '42501';
  end if;

  update public.intakes
  set linked_firm_id = v_firm_id,
      submission_channel = 'firm_code',
      status = 'submitted',
      submitted_at = coalesce(submitted_at, now()),
      workflow_status = 'Under Firm Review',
      updated_at = now()
  where id = p_intake_id;

  insert into public.firm_intake_routes (
    intake_id,
    firm_id,
    route_status,
    preview_sent_at
  )
  values (
    p_intake_id,
    v_firm_id,
    'full_access',
    now()
  )
  on conflict (intake_id, firm_id) do update
    set route_status = case
      when public.firm_intake_routes.route_status = 'accepted'
        then public.firm_intake_routes.route_status
      else 'full_access'
    end,
    preview_sent_at = coalesce(public.firm_intake_routes.preview_sent_at, now())
  returning id into v_route_id;

  return query select v_route_id, v_firm_id, v_firm_name;
end;
$$;

grant execute on function public.route_intake_to_firm_code(uuid, text) to authenticated;

update public.firm_intake_routes r
set route_status = 'full_access'
from public.intakes i
where i.id = r.intake_id
  and i.submission_channel = 'firm_code'
  and i.linked_firm_id = r.firm_id
  and r.route_status in ('preview_sent', 'access_requested');
