-- Growth analytics v2: adds tier_breakdown (counts per plan) and a 7-day daily trend
-- (visits + signups). Same allowlist gate as v1. Apply after 20260626100000.

create or replace function public.crm_site_analytics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  result json;
begin
  select lower(coalesce(p.email, '')) into caller_email
  from public.profiles p where p.id = auth.uid();

  if not (public.is_founder() or caller_email in ('vmramey@gmail.com', 'tadmor86@gmail.com')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select json_build_object(
    'landing_visits',   (select count(*) from public.web_events where event = 'pageview' and path = '/'),
    'for_firms_visits', (select count(*) from public.web_events where event = 'pageview' and path = '/for-firms'),
    'demo_visits',      (select count(*) from public.web_events where event = 'pageview' and path in ('/demo', '/worker-demo', '/fire-demo')),
    'total_sessions',   (select count(distinct session_id) from public.web_events),
    'avg_session_seconds', (
      select coalesce(round(avg(dur)), 0) from (
        select extract(epoch from (max(created_at) - min(created_at))) as dur
        from public.web_events group by session_id having count(*) > 1
      ) s
    ),
    'demo_avg_session_seconds', (
      select coalesce(round(avg(dur)), 0) from (
        select extract(epoch from (max(created_at) - min(created_at))) as dur
        from public.web_events
        where session_id in (
          select distinct session_id from public.web_events
          where path in ('/demo', '/worker-demo', '/fire-demo')
        )
        group by session_id having count(*) > 1
      ) d
    ),
    'pilot_submits',  (select count(*) from public.web_events where event = 'pilot_submit'),
    'pilot_success',  (select count(*) from public.web_events where event = 'pilot_success'),
    'signups_count',  (select count(*) from auth.users),
    'tier_breakdown', (
      select coalesce(json_agg(row_to_json(tb) order by tb.count desc), '[]'::json) from (
        select coalesce(plan_id, '(none)') as tier, count(*) as count
        from public.subscriptions
        group by plan_id
      ) tb
    ),
    'daily', (
      select coalesce(json_agg(row_to_json(d) order by d.day_sort), '[]'::json) from (
        select
          gs::date as day_sort,
          to_char(gs::date, 'Mon DD') as day,
          (select count(*) from public.web_events w where w.event = 'pageview' and w.created_at::date = gs::date) as visits,
          (select count(*) from auth.users u where u.created_at::date = gs::date) as signups
        from generate_series((now()::date - interval '6 days'), now()::date, interval '1 day') gs
      ) d
    ),
    'recent_signups', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select
          coalesce(nullif(trim(p.full_name), ''), u.email) as name,
          u.email,
          u.created_at,
          s.plan_id as tier,
          coalesce(s.status, '') as sub_status
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join public.firm_profiles fp on fp.profile_id = u.id
        left join public.subscriptions s on s.firm_profile_id = fp.id
        order by u.created_at desc
        limit 200
      ) t
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.crm_site_analytics() to authenticated;

notify pgrst, 'reload schema';
