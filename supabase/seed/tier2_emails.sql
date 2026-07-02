-- TIER 2 (Growth / multi-attorney) email updates — web/directory discovery pass.
-- Run ONCE in the Supabase SQL editor. WHERE email IS NULL never overwrites an existing value.
-- NOTE: 11 Tier-2 firms already have emails from priority_ab_emails.sql (Weinheimer, Adams,
--       Parnell Fox, Graulich, Clipner, Trombetta, Reyes, Wallace, Lacques, Sommers, Leones-Ramos)
--       — not repeated here.

-- ── FOUND — confirmed via firm site / directory, ready to run ──
UPDATE public.crm_firms SET email = 'ecervantez@altshulerberzon.com' WHERE attorney_name = 'Eve Cervantez'          AND email IS NULL; -- FOUND · Altshuler Berzon
UPDATE public.crm_firms SET email = 'jfinberg@altshulerberzon.com'   WHERE attorney_name = 'James Michael Finberg'  AND email IS NULL; -- FOUND · Altshuler Berzon
UPDATE public.crm_firms SET email = 'egoldsmith@altshulerberzon.com' WHERE attorney_name = 'Eileen Goldsmith'       AND email IS NULL; -- FOUND · Altshuler Berzon
UPDATE public.crm_firms SET email = 'ggrunfeld@rbgg.com'             WHERE attorney_name = 'Gay Crosthwait Grunfeld' AND email IS NULL; -- FOUND · Rosen Bien Galvan & Grunfeld
UPDATE public.crm_firms SET email = 'helland@nka.com'                WHERE attorney_name = 'Matthew Helland'        AND email IS NULL; -- FOUND · Nichols Kaster
UPDATE public.crm_firms SET email = 'carney@shegerianlaw.com'        WHERE attorney_name = 'Carney Shegerian'       AND email IS NULL; -- FOUND · Shegerian & Associates
UPDATE public.crm_firms SET email = 'monique@osclegal.com'           WHERE attorney_name = 'Monique Olivier'        AND email IS NULL; -- FOUND · Olivier Schreiber & Chao
UPDATE public.crm_firms SET email = 'julian@kingsiegel.com'          WHERE attorney_name = 'Julian Burns King'      AND email IS NULL; -- FOUND · King & Siegel
UPDATE public.crm_firms SET email = 'ramsey@qhlegal.com'             WHERE attorney_name = 'Ramsey Hanafi'          AND email IS NULL; -- FOUND · Quintana Hanafi
UPDATE public.crm_firms SET email = 'jtm@rezlaw.com'                 WHERE attorney_name = 'John T Mullan'          AND email IS NULL; -- FOUND · Rudy Exelrod Zieff & Lowe
UPDATE public.crm_firms SET email = 'dal@rezlaw.com'                 WHERE attorney_name = 'David A. Lowe'          AND email IS NULL; -- FOUND · Rudy Exelrod Zieff & Lowe
UPDATE public.crm_firms SET email = 'david@ratnermolineaux.com'      WHERE attorney_name = 'David S. Ratner'        AND email IS NULL; -- FOUND · Ratner Molineaux
UPDATE public.crm_firms SET email = 'shelley@ratnermolineaux.com'    WHERE attorney_name = 'Shelley Molineaux'      AND email IS NULL; -- FOUND · Ratner Molineaux
UPDATE public.crm_firms SET email = 'chris@leclerclaw.com'           WHERE attorney_name = 'Christopher LeClerc'    AND email IS NULL; -- FOUND · Le Clerc & Le Clerc
UPDATE public.crm_firms SET email = 'mfernando@outtengolden.com'     WHERE attorney_name = 'Menaka Fernando'        AND email IS NULL; -- FOUND · Outten & Golden
UPDATE public.crm_firms SET email = 'ccottrell@schneiderwallace.com' WHERE attorney_name = 'Carolyn H. Cottrell'   AND email IS NULL; -- FOUND · Schneider Wallace

-- ── INFERRED — firm confirmed + firm email pattern confirmed, but this exact address not seen. Review. ──
-- Altshuler Berzon pattern = firstinitial+lastname@altshulerberzon.com (confirmed by 3 partners):
-- UPDATE public.crm_firms SET email = 'jyelin@altshulerberzon.com' WHERE attorney_name = 'Jenny Yelin'   AND email IS NULL; -- INFERRED
-- UPDATE public.crm_firms SET email = 'dbrome@altshulerberzon.com' WHERE attorney_name = 'Daniel Brome'  AND email IS NULL; -- INFERRED
-- Olivier Schreiber & Chao pattern = firstname@osclegal.com (confirmed by Monique):
-- UPDATE public.crm_firms SET email = 'christian@osclegal.com' WHERE attorney_name = 'Christian Schreiber' AND email IS NULL; -- INFERRED
-- UPDATE public.crm_firms SET email = 'george@osclegal.com'    WHERE attorney_name = 'George A Warner'     AND email IS NULL; -- INFERRED (moved from Legal Aid at Work to O&S in 2025)
-- Le Clerc & Le Clerc pattern = firstname@leclerclaw.com (confirmed by Chris):
-- UPDATE public.crm_firms SET email = 'mark@leclerclaw.com' WHERE attorney_name = 'Mark LeClerc' AND email IS NULL; -- INFERRED
-- Rudy Exelrod pattern = initials@rezlaw.com (confirmed by jtm/dal):
-- UPDATE public.crm_firms SET email = 'jps@rezlaw.com' WHERE attorney_name = 'Jessica Peri Spierer' AND email IS NULL; -- INFERRED (now at REZLAW)
-- Nichols Kaster pattern = lastname@nka.com (confirmed by Helland); general is intake@nka.com:
-- UPDATE public.crm_firms SET email = 'fiester@nka.com' WHERE attorney_name = 'Katie Fiester' AND email IS NULL; -- INFERRED (verify still at firm)
-- Outten & Golden pattern = firstinitial+last@outtengolden.com (confirmed by Fernando):
-- UPDATE public.crm_firms SET email = 'akoshkin@outtengolden.com' WHERE attorney_name = 'Adam Koshkin' AND email IS NULL; -- INFERRED

-- ── NOT YET RESEARCHED (next pass) — ~48 Tier-2 names not covered above ──
-- Alexander McKay, Brittany Victoria Berzin, Connor Olson, James Clark, James H Baker Jr.,
-- Renee Parras Ortega, Ally N. Girouard, Arlo Uriarte, Ashleigh Alexa Musser, Ashley N. Pellouchoud,
-- Bradan Litzinger, Carole L Okolwicz, Caroline Louise Hill, Cody Alexander Bolce, Elana Jacobs,
-- Elizabeth R Klos, Emile Davis, Erin Pulaski, Estefania Palacios, Gelian Belong, Jane B. Mackie,
-- Jessica Juarez, Joe Bautista, Laura Herron Weber, Maria Bourn, Matthew J Flynn, Michelle G. Lee,
-- Molly Frandsen, Rahel H Alazar, Rebecca Wildman-Tobriner, Robert Michael Flynn, Shannon Seibert,
-- Vanessa C. Deniston, Zoe DeGeer, Angelique Mangaser, Brian Angelini, Calyn Vernay Hadlock,
-- Danielle Langella, Danielle Sweets Worthy, Erum Siddiqui, Nissim Levin, Ryan Chuman, Ryan Quadrel,
-- Todd Harrison, Toni Lambert, Hector Martinez, Latika Moti Malkani, Rebecca Peterson-Fisher (now Katz Banks), Steven Tindall (Gibbs).
