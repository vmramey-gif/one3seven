-- Add an optional phone number to pilot signups, and carry it into the CRM card.
alter table public.pilot_interest add column if not exists phone text;

-- Replace the pilot_interest -> crm_firms trigger fn so it also maps phone.
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

  select f.id into v_existing_id
  from public.crm_firms f
  where lower(f.email) = lower(new.email)
  order by f.created_at asc
  limit 1;

  if v_existing_id is not null then
    update public.crm_firms
    set priority      = 'A',
        next_followup = current_date,
        phone         = coalesce(phone, new.phone),   -- fill phone only if missing
        notes         = coalesce(notes || E'\n', '') || v_inbound_note
    where id = v_existing_id;
  else
    insert into public.crm_firms (name, attorney_name, email, phone, priority, stage, source, next_followup, notes)
    values (
      coalesce(nullif(btrim(new.firm_name), ''), new.name),
      new.name,
      new.email,
      new.phone,
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

notify pgrst, 'reload schema';
