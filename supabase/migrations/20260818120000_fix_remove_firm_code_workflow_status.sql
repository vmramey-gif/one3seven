-- H5 (worker-surface audit, 8/15): worker_remove_firm_code_from_intake clears linked_firm_id and
-- submission_channel but never resets workflow_status, which gets set to 'Under Firm Review' when
-- an intake is routed to a firm (markIntakeSubmitted, intakeDataService.ts). After removal the
-- mission-control label kept saying "a firm is reviewing" right next to a correctly-updated
-- "no firm connected" section on the same screen. Reset to 'Upload Complete' -- the same value
-- already used as the baseline "organized, no firm attached" state right after upload/organize
-- (intakeDataService.ts:988) -- rather than inventing a new status string; workflow_status has no
-- DB-level CHECK constraint (free text, default 'Upload Complete' per supabase-beta-schema.sql),
-- so no constraint migration is needed alongside this.
--
-- Safe from the SECURITY DEFINER/current_user bypass bug class hit 3x already this session
-- (security_curriculum.md finding #13): this function was never SECURITY DEFINER-gated on
-- current_user in the first place -- its only check is v_worker_id <> auth.uid(), which is the
-- correct pattern.

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
      workflow_status = 'Upload Complete',
      updated_at = now()
  where id = p_intake_id
    and worker_id = auth.uid();
end;
$$;

revoke all on function public.worker_remove_firm_code_from_intake(uuid) from public;
grant execute on function public.worker_remove_firm_code_from_intake(uuid) to authenticated;

notify pgrst, 'reload schema';
