-- timeline_events and intake_summaries tables required by the app.
-- Follow-up migration noted in supabase-beta-schema.sql.

-- 1. intake_summaries
create table if not exists public.intake_summaries (
    id uuid primary key default gen_random_uuid(),
    intake_id uuid not null references public.intakes(id) on delete cascade,
    overview text not null default '',
    timeline_summary text not null default '',
    readiness_indicators text[] not null default '{}',
    missing_document_alerts text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists intake_summaries_intake_id_idx on public.intake_summaries(intake_id);

-- 2. timeline_events
create table if not exists public.timeline_events (
    id uuid primary key default gen_random_uuid(),
    intake_id uuid not null references public.intakes(id) on delete cascade,
    event_date text,
    title text not null default 'Timeline event',
    category text not null default 'Uncategorized',
    ai_summary text not null default '',
    worker_context text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists timeline_events_intake_id_idx on public.timeline_events(intake_id);

-- RLS
alter table public.intake_summaries enable row level security;
alter table public.timeline_events enable row level security;

-- intake_summaries: worker owns their own summaries via the intakes join
create policy intake_summaries_select_worker on public.intake_summaries for select using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);
create policy intake_summaries_insert_worker on public.intake_summaries for insert with check (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);
create policy intake_summaries_update_worker on public.intake_summaries for update using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);

-- intake_summaries: firm can select summaries for intakes routed to them
create policy intake_summaries_select_firm on public.intake_summaries for select using (
    exists (
        select 1 from public.intake_routes ir
        join public.firm_profiles fp on fp.id = ir.firm_id
        where ir.intake_id = intake_summaries.intake_id
          and fp.profile_id = auth.uid()
    )
);

-- timeline_events: worker owns their own rows
create policy timeline_events_select_worker on public.timeline_events for select using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);
create policy timeline_events_insert_worker on public.timeline_events for insert with check (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);
create policy timeline_events_update_worker on public.timeline_events for update using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);
create policy timeline_events_delete_worker on public.timeline_events for delete using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
);

-- timeline_events: firm can select events for routed intakes
create policy timeline_events_select_firm on public.timeline_events for select using (
    exists (
        select 1 from public.intake_routes ir
        join public.firm_profiles fp on fp.id = ir.firm_id
        where ir.intake_id = timeline_events.intake_id
          and fp.profile_id = auth.uid()
    )
);
