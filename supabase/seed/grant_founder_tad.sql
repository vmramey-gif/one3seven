-- Grant founder access to Tad (co-founder) so he can invite/manage sales reps in /hq.
-- Founder = profiles.is_founder = true → unlocks the "Sales reps" manager + crm_invites
-- (founder-only) plus the founder-only CRM tabs.
--
-- PREREQ: Tad must have SIGNED IN at least once (so a profiles row exists). If this
-- updates 0 rows, he hasn't created an account yet — have him sign in, then re-run.
-- Run ONCE in the Supabase SQL editor.

update public.profiles
set is_founder = true
where id = (select id from auth.users where lower(email) = 'tadmor86@gmail.com');

-- Verify (expect one row, is_founder = true):
select p.id, u.email, p.is_founder
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'tadmor86@gmail.com';
