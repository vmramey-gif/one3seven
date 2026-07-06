-- Account approval gate: hold workers/firms out of the product until an operator approves them,
-- while still capturing the signup (warm lead). Founders and reps are never gated.
-- To approve an account: update public.profiles set approved = true where email = '...';

alter table public.profiles
  add column if not exists approved boolean not null default false;

-- Founders and existing reps are auto-approved so team access never breaks.
update public.profiles set approved = true
  where (is_founder = true or crm_role = 'rep') and approved = false;

notify pgrst, 'reload schema';
