-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Event timestamp instrumentation
-- Date: 2026-06-09
-- Purpose: Add firm-side action timestamps to intake_routes for pilot measurement.
--          These are one-time write columns — never overwritten on return visits.
--
-- Measurement events we want to track:
--   firm_first_opened_at   — first time a firm opens a preview (one-time write)
--   firm_accepted_at       — when firm clicks Accept (one-time write)
--   firm_declined_at       — when firm clicks Decline (one-time write)
--
-- document_requests already has created_at which gives us "requested docs at".
-- intakes already has submitted_at which gives us "intake submitted at".
-- intake_routes already has preview_sent_at, full_access_granted_at, worker_decided_at.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add firm_first_opened_at to intake_routes
--    One-time write: UPDATE … WHERE firm_first_opened_at IS NULL
alter table public.intake_routes
  add column if not exists firm_first_opened_at timestamptz;

-- 2. Add firm_accepted_at — timestamp when firm accepted the intake
alter table public.intake_routes
  add column if not exists firm_accepted_at timestamptz;

-- 3. Add firm_declined_at — timestamp when firm declined the intake
alter table public.intake_routes
  add column if not exists firm_declined_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Post-review feedback table
--    Single comparative question shown after accept/decline.
--    "Compared to how you normally receive employment intakes, this intake
--     arrived: much more organized / somewhat more organized / about the same"
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.intake_review_feedback (
    id                  uuid primary key default gen_random_uuid(),
    intake_route_id     uuid not null references public.intake_routes(id) on delete cascade,
    intake_id           uuid not null references public.intakes(id) on delete cascade,
    firm_id             uuid not null references public.firm_profiles(id) on delete cascade,
    -- Comparative organization question (shown in-product after accept/decline)
    org_comparison      text check (org_comparison in (
                            'much_more_organized',
                            'somewhat_more_organized',
                            'about_the_same',
                            'less_organized'
                        )),
    -- Free-text qualitative response (collected via follow-up email, nullable)
    qualitative_note    text,
    -- Which action triggered the prompt
    trigger_action      text not null check (trigger_action in ('accepted', 'declined')),
    created_at          timestamptz not null default now()
);

create index if not exists intake_review_feedback_firm_idx
    on public.intake_review_feedback (firm_id);

create index if not exists intake_review_feedback_intake_idx
    on public.intake_review_feedback (intake_id);

-- RLS: firms can only see and insert their own feedback
alter table public.intake_review_feedback enable row level security;

create policy intake_review_feedback_select_own
    on public.intake_review_feedback for select
    using (
        firm_id in (
            select id from public.firm_profiles where profile_id = auth.uid()
        )
    );

create policy intake_review_feedback_insert_own
    on public.intake_review_feedback for insert
    with check (
        firm_id in (
            select id from public.firm_profiles where profile_id = auth.uid()
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- Application-side write patterns (TypeScript reference — NOT SQL)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- firm_first_opened_at (one-time write — never overwrite):
--   supabase.from('intake_routes')
--     .update({ firm_first_opened_at: new Date().toISOString() })
--     .eq('id', routeId)
--     .is('firm_first_opened_at', null)   ← null check is the guard
--
-- firm_accepted_at (write once on accept action):
--   supabase.from('intake_routes')
--     .update({ firm_accepted_at: new Date().toISOString() })
--     .eq('id', routeId)
--     .is('firm_accepted_at', null)
--
-- firm_declined_at (write once on decline action):
--   supabase.from('intake_routes')
--     .update({ firm_declined_at: new Date().toISOString() })
--     .eq('id', routeId)
--     .is('firm_declined_at', null)
--
-- ─────────────────────────────────────────────────────────────────────────────
