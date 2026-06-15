-- Firm-initiated additional document requests (workflow + summary alerts).
-- Firms cannot update intakes or intake_summaries directly under RLS; this RPC runs as security definer.

create or replace function public.firm_request_additional_documents(
  p_route_id uuid,
  p_categories text[],
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_id uuid;
  v_summary_id uuid;
  v_existing_alerts text[];
  v_new_alerts text[];
  v_cat text;
  v_overview text;
  v_block text;
  v_clean_overview text;
begin
  if coalesce(array_length(p_categories, 1), 0) = 0 then
    raise exception 'At least one category is required' using errcode = '22023';
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
  set workflow_status = 'Additional Documents Requested',
      updated_at = now()
  where id = v_intake_id;

  v_new_alerts := array[]::text[];
  foreach v_cat in array p_categories loop
    if trim(v_cat) <> '' then
      v_new_alerts := array_append(v_new_alerts, 'Firm requested: ' || trim(v_cat));
    end if;
  end loop;
  if trim(coalesce(p_note, '')) <> '' then
    v_new_alerts := array_append(v_new_alerts, 'Firm note: ' || trim(p_note));
  end if;

  select s.id, s.missing_document_alerts, s.overview
    into v_summary_id, v_existing_alerts, v_overview
  from public.intake_summaries s
  where s.intake_id = v_intake_id
  order by s.created_at desc
  limit 1;

  v_block :=
    E'\n--- O3S_FIRM_DOCUMENT_REQUEST ---\n'
    || 'categories:' || array_to_string(p_categories, '|') || E'\n'
    || 'note:' || replace(coalesce(p_note, ''), E'\n', ' ') || E'\n'
    || '--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n';

  if v_summary_id is not null then
    v_existing_alerts := coalesce(v_existing_alerts, array[]::text[]);
    select coalesce(array_agg(a), array[]::text[])
      into v_existing_alerts
    from unnest(v_existing_alerts) as a
    where a not like 'Firm requested:%'
      and a not like 'Firm note:%';

    v_clean_overview := regexp_replace(
      coalesce(v_overview, ''),
      E'\\n--- O3S_FIRM_DOCUMENT_REQUEST ---[\\s\\S]*?--- O3S_FIRM_DOCUMENT_REQUEST_END ---\\n',
      '',
      'g'
    );

    update public.intake_summaries
    set missing_document_alerts = v_existing_alerts || v_new_alerts,
        overview = v_clean_overview || v_block
    where id = v_summary_id;
  end if;
end;
$$;

grant execute on function public.firm_request_additional_documents(uuid, text[], text) to authenticated;
