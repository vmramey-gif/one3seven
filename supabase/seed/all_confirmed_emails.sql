-- ══════════════════════════════════════════════════════════════════════════════
-- ALL CONFIRMED FIRM EMAILS — single-run bundle (priority A/B + Tier 1 + Tier 2).
-- Run ONCE in the Supabase SQL editor. Every line is guarded by `email IS NULL`, so
-- re-running never overwrites an existing value (safe to run even if you loaded some already).
-- Only CONFIRMED (found on firm site / directory) addresses are here — inferred guesses
-- stay commented in their per-tier files (priority_ab_emails.sql, tier1_emails.sql, tier2_emails.sql).
-- ══════════════════════════════════════════════════════════════════════════════
begin;

-- ── Priority A / B (14) ──
update public.crm_firms set email = 'renia@rzemploymentlaw.com'        where attorney_name = 'Renia Zadourian'       and email is null;
update public.crm_firms set email = 'conor@trombetta.law'             where attorney_name = 'Conor Trombetta'        and email is null;
update public.crm_firms set email = 'marjowallace@sbcglobal.net'      where attorney_name = 'Marjorie Wallace'       and email is null;
update public.crm_firms set email = 'info@d.law'                      where attorney_name = 'Jean Hopkins Power'     and email is null;
update public.crm_firms set email = 'info@leoneslawfirm.com'          where attorney_name = 'Valerie Leones-Ramos'   and email is null;
update public.crm_firms set email = 'lbohm@bohmlaw.com'               where attorney_name = 'Lawrance Bohm'          and email is null;
update public.crm_firms set email = 'David@wrongedatwork.com'         where attorney_name = 'David Graulich'         and email is null;
update public.crm_firms set email = 'madams@adamsemploymentlawyer.com' where attorney_name = 'Mark Stephen Adams'    and email is null;
update public.crm_firms set email = 'stephen@employmentlawsf.com'     where attorney_name = 'Stephen A Sommers'      and email is null;
update public.crm_firms set email = 'peterlacques@aol.com'            where attorney_name = 'Peter F. Lacques'       and email is null;
update public.crm_firms set email = 'parnellfoxlaw@gmail.com'         where attorney_name = 'Parnell Fox'            and email is null;
update public.crm_firms set email = 'info@jeremyreyeslaw.com'         where attorney_name = 'Jeremy V. Reyes'        and email is null;
update public.crm_firms set email = 'candice@clipnerlaw.com'          where attorney_name = 'Candice Clipner'        and email is null;
update public.crm_firms set email = 'kyle@kjwlegal.com'               where attorney_name = 'Kyle Weinheimer'        and email is null;

-- ── Tier 1 (1) ──
update public.crm_firms set email = 'kelsey@bohmlaw.com'              where attorney_name = 'Kelsey Ciarimboli'      and email is null;

-- ── Tier 2 (16) ──
update public.crm_firms set email = 'ecervantez@altshulerberzon.com' where attorney_name = 'Eve Cervantez'          and email is null;
update public.crm_firms set email = 'jfinberg@altshulerberzon.com'   where attorney_name = 'James Michael Finberg'  and email is null;
update public.crm_firms set email = 'egoldsmith@altshulerberzon.com' where attorney_name = 'Eileen Goldsmith'       and email is null;
update public.crm_firms set email = 'ggrunfeld@rbgg.com'             where attorney_name = 'Gay Crosthwait Grunfeld' and email is null;
update public.crm_firms set email = 'helland@nka.com'                where attorney_name = 'Matthew Helland'        and email is null;
update public.crm_firms set email = 'carney@shegerianlaw.com'        where attorney_name = 'Carney Shegerian'       and email is null;
update public.crm_firms set email = 'monique@osclegal.com'           where attorney_name = 'Monique Olivier'        and email is null;
update public.crm_firms set email = 'julian@kingsiegel.com'          where attorney_name = 'Julian Burns King'      and email is null;
update public.crm_firms set email = 'ramsey@qhlegal.com'             where attorney_name = 'Ramsey Hanafi'          and email is null;
update public.crm_firms set email = 'jtm@rezlaw.com'                 where attorney_name = 'John T Mullan'          and email is null;
update public.crm_firms set email = 'dal@rezlaw.com'                 where attorney_name = 'David A. Lowe'          and email is null;
update public.crm_firms set email = 'david@ratnermolineaux.com'      where attorney_name = 'David S. Ratner'        and email is null;
update public.crm_firms set email = 'shelley@ratnermolineaux.com'    where attorney_name = 'Shelley Molineaux'      and email is null;
update public.crm_firms set email = 'chris@leclerclaw.com'           where attorney_name = 'Christopher LeClerc'    and email is null;
update public.crm_firms set email = 'mfernando@outtengolden.com'     where attorney_name = 'Menaka Fernando'        and email is null;
update public.crm_firms set email = 'ccottrell@schneiderwallace.com' where attorney_name = 'Carolyn H. Cottrell'   and email is null;

commit;

-- Verify: how many of these firms now have an email on file.
select attorney_name, name, email
from public.crm_firms
where email in (
  'renia@rzemploymentlaw.com','conor@trombetta.law','marjowallace@sbcglobal.net','info@d.law',
  'info@leoneslawfirm.com','lbohm@bohmlaw.com','David@wrongedatwork.com','madams@adamsemploymentlawyer.com',
  'stephen@employmentlawsf.com','peterlacques@aol.com','parnellfoxlaw@gmail.com','info@jeremyreyeslaw.com',
  'candice@clipnerlaw.com','kyle@kjwlegal.com','kelsey@bohmlaw.com','ecervantez@altshulerberzon.com',
  'jfinberg@altshulerberzon.com','egoldsmith@altshulerberzon.com','ggrunfeld@rbgg.com','helland@nka.com',
  'carney@shegerianlaw.com','monique@osclegal.com','julian@kingsiegel.com','ramsey@qhlegal.com',
  'jtm@rezlaw.com','dal@rezlaw.com','david@ratnermolineaux.com','shelley@ratnermolineaux.com',
  'chris@leclerclaw.com','mfernando@outtengolden.com','ccottrell@schneiderwallace.com'
)
order by attorney_name;
