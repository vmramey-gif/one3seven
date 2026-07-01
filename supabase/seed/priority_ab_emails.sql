-- Priority A + B email updates — generated from public firm-website discovery.
-- Run ONCE in the Supabase SQL editor. WHERE email IS NULL never overwrites an existing value.
-- HIGH / GENERAL = found directly on the firm's website (uncommented, ready to run).
-- INFERRED = pattern-guessed, NOT confirmed (commented out — review before uncommenting).

-- ── HIGH confidence — found on the firm website (personal) ──
UPDATE public.crm_firms SET email = 'renia@rzemploymentlaw.com'
  WHERE attorney_name = 'Renia Zadourian' AND email IS NULL;          -- HIGH · personal
UPDATE public.crm_firms SET email = 'conor@trombetta.law'
  WHERE attorney_name = 'Conor Trombetta' AND email IS NULL;          -- HIGH · personal
UPDATE public.crm_firms SET email = 'marjowallace@sbcglobal.net'
  WHERE attorney_name = 'Marjorie Wallace' AND email IS NULL;         -- HIGH · personal (non-firm domain)

-- ── GENERAL firm email — found on the firm website (info@) ──
UPDATE public.crm_firms SET email = 'info@d.law'
  WHERE attorney_name = 'Jean Hopkins Power' AND email IS NULL;       -- HIGH · general (D.LAW)
UPDATE public.crm_firms SET email = 'info@leoneslawfirm.com'
  WHERE attorney_name = 'Valerie Leones-Ramos' AND email IS NULL;     -- HIGH · general

-- ── INFERRED — NOT confirmed. Review each before uncommenting. ──
-- Bohm Law Group: form-only site, no email exposed anywhere (home/contact/Lawrance bio).
-- intake@ is a guess; confirm Lawrance Bohm's real email by phone (916) 927-5574 or LinkedIn.
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Lawrance Bohm'   AND email IS NULL;  -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Kelsey Ciarimboli' AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Catharine McGlynn'  AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Andrew L. Thrasher' AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Zane Hilton'        AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'info@clipnerlaw.com'            WHERE attorney_name = 'Candice Clipner'   AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'info@adamsemploymentlawyer.com' WHERE attorney_name = 'Mark Stephen Adams' AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'info@wrongedatwork.com'         WHERE attorney_name = 'David Graulich'    AND email IS NULL; -- INFERRED · general (site cert broken — verify)

-- NOT FOUND (no website / unreachable — no email): John Vincent Ricca, Stephen A Sommers,
-- Parnell Fox, Kyle Weinheimer, Peter F. Lacques, Jeremy V. Reyes.
