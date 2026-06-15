-- Worker-owned intake delete: RLS does not allow client DELETE on intakes or firm_intake_routes.
-- Storage files are removed client-side via Storage API after this RPC succeeds (see deleteWorkerOwnedIntake).

create or replace function public.worker_delete_intake(p_intake_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not exists (
    select 1 from public.intakes i where i.id = p_intake_id and i.worker_id = auth.uid()
  ) then
    if not exists (select 1 from public.intakes i where i.id = p_intake_id) then
      return jsonb_build_object('ok', false, 'error', 'Intake not found');
    end if;
    return jsonb_build_object('ok', false, 'error', 'Not allowed');
  end if;

  -- Workers have no DELETE policy on notifications; clean intake-linked rows.
  delete from public.notifications n
  where n.related_intake_id = p_intake_id;

  delete from public.notifications n
  where n.related_route_id in (
    select r.id from public.firm_intake_routes r where r.intake_id = p_intake_id
  );

  -- Cascades: uploaded_files, file_text_extractions, timeline_events, intake_summaries, firm_intake_routes.
  delete from public.intakes i
  where i.id = p_intake_id
    and i.worker_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Intake could not be deleted');
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

revoke all on function public.worker_delete_intake(uuid) from public;
grant execute on function public.worker_delete_intake(uuid) to authenticated;

notify pgrst, 'reload schema';
