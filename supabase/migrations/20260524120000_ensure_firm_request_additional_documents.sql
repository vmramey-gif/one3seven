-- Repair: restore firm_request_additional_documents for PostgREST (uuid, text[], text).
-- Frontend calls: p_route_id, p_categories, p_note (named; types must match).
-- Requires: public.notifications + public.insert_notification (20260522120000).

drop function if exists public.firm_request_additional_documents(uuid, text[], text);

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
  v_worker_user_id uuid;
  v_firm_name text;
  v_summary_id uuid;
  v_existing_alerts text[];
  v_new_alerts text[];
  v_cat text;
  v_overview text;
  v_block text;
  v_clean_overview text;
  v_categories_clean text[];
begin
  if coalesce(array_length(p_categories, 1), 0) = 0 then
    raise exception 'At least one category is required' using errcode = '22023';
  end if;

  select r.intake_id, i.worker_id, fp.firm_name
    into v_intake_id, v_worker_user_id, v_firm_name
  from public.firm_intake_routes r
  join public.firm_profiles fp on fp.id = r.firm_id
  join public.intakes i on i.id = r.intake_id
  where r.id = p_route_id
    and fp.profile_id = auth.uid();

  if v_intake_id is null then
    raise exception 'Route not found or not allowed' using errcode = '42501';
  end if;

  v_categories_clean := array[]::text[];
  foreach v_cat in array p_categories loop
    if trim(v_cat) <> '' then
      v_categories_clean := array_append(v_categories_clean, trim(v_cat));
    end if;
  end loop;

  if coalesce(array_length(v_categories_clean, 1), 0) = 0 then
    raise exception 'At least one category is required' using errcode = '22023';
  end if;

  update public.intakes
  set workflow_status = 'Additional Documents Requested',
      updated_at = now()
  where id = v_intake_id;

  v_new_alerts := array[]::text[];
  foreach v_cat in array v_categories_clean loop
    v_new_alerts := array_append(v_new_alerts, 'Firm requested: ' || v_cat);
  end loop;
  if trim(coalesce(p_note, '')) <> '' then
    v_new_alerts := array_append(v_new_alerts, 'Firm note: ' || trim(p_note));
  end if;

  perform public.insert_notification(
    p_recipient_user_id => v_worker_user_id,
    p_recipient_kind => 'worker',
    p_notification_type => 'firm_document_request',
    p_title => coalesce(nullif(trim(v_firm_name), ''), 'Your firm') || ' requested additional documents',
    p_body => case
      when trim(coalesce(p_note, '')) <> '' then trim(p_note)
      else 'Please upload the requested document categories for this intake.'
    end,
    p_payload => jsonb_build_object(
      'requested_categories', to_jsonb(v_categories_clean),
      'firm_note', coalesce(p_note, ''),
      'firm_name', coalesce(nullif(trim(v_firm_name), ''), 'Your firm'),
      'fulfilled_categories', '[]'::jsonb,
      'new_file_ids', '[]'::jsonb
    ),
    p_related_intake_id => v_intake_id,
    p_related_route_id => p_route_id
  );

  select s.id, s.missing_document_alerts, s.overview
    into v_summary_id, v_existing_alerts, v_overview
  from public.intake_summaries s
  where s.intake_id = v_intake_id
  order by s.created_at desc
  limit 1;

  v_block :=
    E'\n--- O3S_FIRM_DOCUMENT_REQUEST ---\n'
    || 'categories:' || array_to_string(v_categories_clean, '|') || E'\n'
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

notify pgrst, 'reload schema';
