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

-- ── FOUND via web/directory search (2nd pass) — personal, ready to run ──
-- Bohm Law Group: real email surfaced via web search of the firm's contact page.
UPDATE public.crm_firms SET email = 'lbohm@bohmlaw.com'
  WHERE attorney_name = 'Lawrance Bohm' AND email IS NULL;              -- FOUND (web) · personal · ⭐ #1 A-priority
UPDATE public.crm_firms SET email = 'David@wrongedatwork.com'
  WHERE attorney_name = 'David Graulich' AND email IS NULL;            -- FOUND (web) · personal (site cert was broken; email via directory)
UPDATE public.crm_firms SET email = 'madams@adamsemploymentlawyer.com'
  WHERE attorney_name = 'Mark Stephen Adams' AND email IS NULL;        -- FOUND (web) · personal
UPDATE public.crm_firms SET email = 'stephen@employmentlawsf.com'
  WHERE attorney_name = 'Stephen A Sommers' AND email IS NULL;         -- FOUND (web) · firm domain
UPDATE public.crm_firms SET email = 'peterlacques@aol.com'
  WHERE attorney_name = 'Peter F. Lacques' AND email IS NULL;          -- FOUND (web) · personal
UPDATE public.crm_firms SET email = 'parnellfoxlaw@gmail.com'
  WHERE attorney_name = 'Parnell Fox' AND email IS NULL;               -- FOUND (web) · personal
UPDATE public.crm_firms SET email = 'info@jeremyreyeslaw.com'
  WHERE attorney_name = 'Jeremy V. Reyes' AND email IS NULL;           -- FOUND (web) · general
UPDATE public.crm_firms SET email = 'candice@clipnerlaw.com'
  WHERE attorney_name = 'Candice Clipner' AND email IS NULL;           -- FOUND (web) · personal
UPDATE public.crm_firms SET email = 'kyle@kjwlegal.com'
  WHERE attorney_name = 'Kyle Weinheimer' AND email IS NULL;           -- FOUND (web) · personal

-- ── INFERRED — NOT confirmed. Review before uncommenting. ──
-- Rest of Bohm team not individually listed; lbohm goes to the named partner. Firm-wide guess below:
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Kelsey Ciarimboli' AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Catharine McGlynn'  AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Andrew L. Thrasher' AND email IS NULL; -- INFERRED · general
-- UPDATE public.crm_firms SET email = 'intake@bohmlaw.com' WHERE attorney_name = 'Zane Hilton'        AND email IS NULL; -- INFERRED · general
-- Clipner: still form-only, no email surfaced. info@ is a guess:
-- UPDATE public.crm_firms SET email = 'info@clipnerlaw.com'            WHERE attorney_name = 'Candice Clipner'   AND email IS NULL; -- INFERRED · general

-- John Vincent Ricca: Senior Counsel at Bibiyan Law Group / Tomorrow Law (tomorrowlaw.com).
-- Directory shows his address masked as j***@tomorrowlaw.com — jricca@ is the strong pattern guess:
-- UPDATE public.crm_firms SET email = 'jricca@tomorrowlaw.com' WHERE attorney_name = 'John Vincent Ricca' AND email IS NULL; -- INFERRED · personal (masked-confirmed prefix)
-- Firm general fallback for Ricca:
-- UPDATE public.crm_firms SET email = 'info@tomorrowlaw.com'   WHERE attorney_name = 'John Vincent Ricca' AND email IS NULL; -- INFERRED · general

-- ALL A/B firms now have a FOUND or INFERRED email.
