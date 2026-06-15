-- Worker removes firm-code routing (keeps intake, files, and summary).

create or replace function public.worker_remove_firm_code_from_intake(p_intake_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_firm_id uuid;
begin
  select i.worker_id, i.linked_firm_id
    into v_worker_id, v_firm_id
  from public.intakes i
  where i.id = p_intake_id;

  if v_worker_id is null then
    raise exception 'Intake not found' using errcode = '22023';
  end if;

  if v_worker_id <> auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_firm_id is null then
    return;
  end if;

  delete from public.firm_intake_routes
  where intake_id = p_intake_id
    and firm_id = v_firm_id;

  update public.intakes
  set linked_firm_id = null,
      submission_channel = null,
      updated_at = now()
  where id = p_intake_id
    and worker_id = auth.uid();
end;
$$;

revoke all on function public.worker_remove_firm_code_from_intake(uuid) from public;
grant execute on function public.worker_remove_firm_code_from_intake(uuid) to authenticated;

notify pgrst, 'reload schema';
