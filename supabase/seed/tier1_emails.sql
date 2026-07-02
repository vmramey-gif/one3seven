-- TIER 1 (call-first, tech-native) email updates — 2nd-pass web/directory discovery.
-- Run ONCE in the Supabase SQL editor. WHERE email IS NULL never overwrites an existing value.
-- NOTE: Bohm, Jean Hopkins Power (info@d.law), Renia Zadourian, John Ricca are already in
--       priority_ab_emails.sql — not repeated here.

-- ── FOUND — confirmed via directory (personal), ready to run ──
UPDATE public.crm_firms SET email = 'kelsey@bohmlaw.com'
  WHERE attorney_name = 'Kelsey Ciarimboli' AND email IS NULL;   -- FOUND (State Bar / directory) · personal

-- ── INFERRED — pattern-guessed, NOT confirmed. Review before uncommenting. ──
-- D.Law pattern = firstname@d.law (Emilia's directory address is masked e***@d.law).
-- UPDATE public.crm_firms SET email = 'emil@d.law'    WHERE attorney_name = 'Emil Davtyan'    AND email IS NULL; -- INFERRED · personal (founder; info@d.law is a safe fallback)
-- UPDATE public.crm_firms SET email = 'emilia@d.law'  WHERE attorney_name = 'Emilia Mehrabian' AND email IS NULL; -- INFERRED · personal
-- Bohm team pattern = firstname@bohmlaw.com (confirmed by Kelsey). Note the partner uses lbohm@ (initial+last).
-- UPDATE public.crm_firms SET email = 'andrew@bohmlaw.com'    WHERE attorney_name = 'Andrew L. Thrasher' AND email IS NULL; -- INFERRED · personal
-- UPDATE public.crm_firms SET email = 'catharine@bohmlaw.com' WHERE attorney_name = 'Catharine McGlynn'  AND email IS NULL; -- INFERRED · personal
-- UPDATE public.crm_firms SET email = 'zane@bohmlaw.com'      WHERE attorney_name = 'Zane Hilton'        AND email IS NULL; -- INFERRED · personal

-- Tier 1 status: 10 firms total.
--   Confirmed: Lawrance Bohm, Jean Hopkins Power, Renia Zadourian (in priority_ab), Kelsey Ciarimboli (here).
--   Inferred:  John Ricca (priority_ab), Emil Davtyan, Emilia Mehrabian, Andrew Thrasher, Catharine McGlynn, Zane Hilton.
