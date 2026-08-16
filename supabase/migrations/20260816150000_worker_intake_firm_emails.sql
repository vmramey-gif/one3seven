-- Append-only log of "email my organized intake to a firm's inbox" sends. This backs the new
-- send-intake-to-firm-email edge function, which lets a worker email their packet to ANY email
-- address they type in -- unlike send-worker-summary-email (20260814-ish), which deliberately
-- hard-codes the recipient to the caller's own verified auth email. A client-supplied, arbitrary
-- recipient on an authenticated attachment-email endpoint is a real open-relay abuse vector, so
-- this table is what the edge function counts against before sending (rate limit) and what it
-- writes after every attempt, success or failure (audit trail) -- see project_worker_surface_audit_aug2026
-- memory, Task 58.
--
-- Workers can read their own rows (so a future "sent to" history could be shown in-app) but
-- cannot insert/update/delete directly -- all writes go through the edge function's service-role
-- client, same pattern as worker_sms_links / sms-link-request.

create table if not exists public.worker_intake_firm_emails (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  recipient_email text not null,
  firm_name text,
  status text not null check (status in ('sent', 'failed')),
  error_detail text,
  created_at timestamptz not null default now()
);

create index if not exists worker_intake_firm_emails_worker_id_created_at_idx
  on public.worker_intake_firm_emails (worker_id, created_at desc);

alter table public.worker_intake_firm_emails enable row level security;

create policy "Workers can view their own outbound firm emails"
  on public.worker_intake_firm_emails
  for select
  to authenticated
  using (worker_id = auth.uid());

notify pgrst, 'reload schema';
