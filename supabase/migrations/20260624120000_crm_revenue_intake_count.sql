-- Feature support for the founder CRM:
--  1. crm_firms.subscription_tier — optional tier for revenue math (null = treat as Practice).
--  2. intakes_count() — founder-only COUNT of worker intakes (proof of traction). Returns an
--     integer only; never rows, names, or document contents. Non-founders get 0.

alter table public.crm_firms
  add column if not exists subscription_tier text
  check (subscription_tier is null or subscription_tier in ('solo', 'practice', 'firm'));

create or replace function public.intakes_count()
returns integer language sql security definer stable set search_path = public as $$
  select case when public.is_founder()
    then (select count(*)::int from public.intakes)
    else 0 end;
$$;
grant execute on function public.intakes_count() to authenticated;

notify pgrst, 'reload schema';
