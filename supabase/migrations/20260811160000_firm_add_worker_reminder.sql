-- Lets a firm with full_access to an intake add a reminder/date for the worker — closing a
-- feature that was half-built: workerReminders.ts already has a `source: 'worker' | 'firm'`
-- type, the worker's RemindersCard already renders a "from your firm" tag for source='firm'
-- items, and the doctrine comment in workerReminders.ts explicitly anticipates firm-authored
-- reminders ("reminders are LOGISTICS the worker sets for themselves, or that a firm authors
-- for them"). But intake_summaries has never had a firm UPDATE policy (only
-- intake_summaries_update_worker exists) and there was no firm-side UI, so `source: 'firm'`
-- has never once been reachable in production. This RPC is the missing write path.
--
-- Same block format as workerReminders.ts (buildRemindersBlock / extractReminders):
--   --- O3S_WORKER_REMINDERS ---
--   [{"id":"...","text":"...","dueDate":"YYYY-MM-DD"|null,"source":"firm","done":false,"createdAt":"..."}]
--   --- O3S_WORKER_REMINDERS_END ---
-- A firm-added reminder is appended to the existing array (read-modify-write), never replaces
-- worker-authored ones. Any date is exactly what the firm typed — this never computes a legal
-- deadline, same hard line as the rest of the reminders system.

create or replace function public.firm_add_worker_reminder(
  p_route_id uuid,
  p_text text,
  p_due_date text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_id uuid;
  v_worker_user_id uuid;
  v_firm_name text;
  v_summary_id uuid;
  v_overview text;
  v_current_block text;
  v_current_reminders jsonb;
  v_clean_due_date text;
  v_new_reminder jsonb;
  v_next_reminders jsonb;
  v_clean_overview text;
begin
  if trim(coalesce(p_text, '')) = '' then
    raise exception 'Reminder text is required' using errcode = '22023';
  end if;

  if p_due_date is not null and trim(p_due_date) <> '' and p_due_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Date must be in the form YYYY-MM-DD' using errcode = '22023';
  end if;
  v_clean_due_date := nullif(trim(coalesce(p_due_date, '')), '');

  select r.intake_id, i.worker_id, fp.firm_name
    into v_intake_id, v_worker_user_id, v_firm_name
  from public.firm_intake_routes r
  join public.firm_profiles fp on fp.id = r.firm_id
  join public.intakes i on i.id = r.intake_id
  where r.id = p_route_id
    and fp.profile_id = auth.uid()
    and r.route_status = 'full_access';

  if v_intake_id is null then
    raise exception 'Route not found, not allowed, or full access has not been granted yet' using errcode = '42501';
  end if;

  select s.id, s.overview
    into v_summary_id, v_overview
  from public.intake_summaries s
  where s.intake_id = v_intake_id
  order by s.created_at desc
  limit 1;

  if v_summary_id is null then
    raise exception 'This intake does not have an organized summary yet' using errcode = 'P0002';
  end if;

  -- Extract the existing reminders JSON array from the block, defaulting to [] if absent/malformed.
  v_current_block := (regexp_match(coalesce(v_overview, ''), E'--- O3S_WORKER_REMINDERS ---\\n([\\s\\S]*?)\\n--- O3S_WORKER_REMINDERS_END ---'))[1];
  begin
    v_current_reminders := coalesce(v_current_block::jsonb, '[]'::jsonb);
  exception when others then
    v_current_reminders := '[]'::jsonb;
  end;
  if jsonb_typeof(v_current_reminders) is distinct from 'array' then
    v_current_reminders := '[]'::jsonb;
  end if;

  v_new_reminder := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'text', trim(p_text),
    'dueDate', v_clean_due_date,
    'source', 'firm',
    'done', false,
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  v_next_reminders := v_current_reminders || jsonb_build_array(v_new_reminder);

  v_clean_overview := regexp_replace(
    coalesce(v_overview, ''),
    E'\\n?--- O3S_WORKER_REMINDERS ---\\n[\\s\\S]*?\\n--- O3S_WORKER_REMINDERS_END ---\\n?',
    '',
    'g'
  );
  v_clean_overview := regexp_replace(v_clean_overview, E'\\s+$', '');

  update public.intake_summaries
  set overview = (case when v_clean_overview = '' then '' else v_clean_overview || E'\n' end)
      || '--- O3S_WORKER_REMINDERS ---' || E'\n' || v_next_reminders::text || E'\n' || '--- O3S_WORKER_REMINDERS_END ---' || E'\n'
  where id = v_summary_id;

  perform public.insert_notification(
    p_recipient_user_id => v_worker_user_id,
    p_recipient_kind => 'worker',
    p_notification_type => 'firm_reminder_added',
    p_title => coalesce(nullif(trim(v_firm_name), ''), 'Your firm') || ' added a reminder',
    p_body => trim(p_text),
    p_payload => jsonb_build_object('due_date', v_clean_due_date, 'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm')),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );
end;
$$;

grant execute on function public.firm_add_worker_reminder(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
