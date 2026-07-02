-- Pipe inbound "Start free pilot" form submissions (public.pilot_interest) straight into the
-- founder CRM (public.crm_firms) so leads surface where the founder already works — instead of
-- sitting unread behind pilot_interest's service-role-only read policy.
--
-- Behavior on each pilot_interest INSERT:
--   * If a crm_firms row already exists with the same email  -> ENRICH it (append the inbound
--     note, bump priority to 'A', set next_followup = today). Never downgrades an existing stage.
--   * Otherwise -> CREATE a new crm_firms card at stage 'target', priority 'A', source 'pilot_form'.
--
-- SECURITY DEFINER: the form insert runs as the anon role, which has no rights on the
-- founder-only crm_firms table. The trigger function is owned by the migration role (bypasses
-- RLS as table owner), so it can write the CRM row on the anon user's behalf. search_path locked.

create or replace function public.pilot_interest_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_inbound_note text;
begin
  v_inbound_note := 'INBOUND pilot request via /for-firms on '
                    || to_char(now(), 'YYYY-MM-DD')
                    || coalesce(' — ' || nullif(btrim(new.note), ''), '');

  -- Match an existing pipeline firm by email (case-insensitive).
  select f.id into v_existing_id
  from public.crm_firms f
  where lower(f.email) = lower(new.email)
  order by f.created_at asc
  limit 1;

  if v_existing_id is not null then
    update public.crm_firms
    set priority      = 'A',
        next_followup = current_date,
        notes         = coalesce(notes || E'\n', '') || v_inbound_note
    where id = v_existing_id;
  else
    insert into public.crm_firms (name, attorney_name, email, priority, stage, source, next_followup, notes)
    values (
      coalesce(nullif(btrim(new.firm_name), ''), new.name),  -- name is NOT NULL; fall back to person
      new.name,
      new.email,
      'A',
      'target',
      'pilot_form',
      current_date,
      v_inbound_note
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pilot_interest_to_crm on public.pilot_interest;
create trigger trg_pilot_interest_to_crm
  after insert on public.pilot_interest
  for each row execute function public.pilot_interest_to_crm();

notify pgrst, 'reload schema';
