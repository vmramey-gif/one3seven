-- BULK INFERRED firm emails — info@<domain> for every CELA firm with a website.
-- EVERY line here is a GUESS (info@ is the most common firm intake address, but unconfirmed).
-- WHERE email IS NULL protects any confirmed email already set (run priority_ab_emails.sql FIRST).
-- Review before running. 282 firms with a website; 68 have none (no email).

UPDATE public.crm_firms SET email = 'info@os-legal.com' WHERE attorney_name = 'Estefania Palacios' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@koneckymediation.com' WHERE attorney_name = 'Joshua Konecky' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@andykatzlaw.com' WHERE attorney_name = 'Andy Katz' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leonardcarder.com' WHERE attorney_name = 'Amy Endo' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@forthrightlaw.com' WHERE attorney_name = 'Dow Wakefield Patten' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sbernsteinlaw.com' WHERE attorney_name = 'Scot D. Bernstein' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@schneiderwallace.com' WHERE attorney_name = 'Carolyn H. Cottrell' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@feinbergjackson.com' WHERE attorney_name = 'Catha Worthman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@themmlawfirm.com' WHERE attorney_name = 'Hector Martinez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@robertsdisability.com' WHERE attorney_name = 'Michelle L. Roberts' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@os-legal.com' WHERE attorney_name = 'Monique Olivier' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@paullaw.com' WHERE attorney_name = 'Gregory G Paul' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@benhambaker.com' WHERE attorney_name = 'Hillary Benham-Baker' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@scmclaw.com' WHERE attorney_name = 'Heather K. McMillan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@californialaborlawattorney.com' WHERE attorney_name = 'Douglas N. Silverstein' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@chumphreylaw.com' WHERE attorney_name = 'Christina Humphrey' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wagnerlegalgroup.com' WHERE attorney_name = 'Mark H. Wagner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@shivayilaw.com' WHERE attorney_name = 'Nima Shivayi' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bradmancusolaw.com' WHERE attorney_name = 'Bradley J. Mancuso' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@quiellaw.com' WHERE attorney_name = 'Fred G Quiel' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@harriskaufman.com' WHERE attorney_name = 'Matthew A. Kaufman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rzemploymentlaw.com' WHERE attorney_name = 'Renia Zadourian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@louiscohenlaw.com' WHERE attorney_name = 'Louis JAY Cohen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bluelawgroup.com' WHERE attorney_name = 'Michael Kol Blue' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@theavenirfirm.com' WHERE attorney_name = 'Annie Ksadzhikyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@felderlaw.com' WHERE attorney_name = 'Victoria V. Felder' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@shegerianlaw.com' WHERE attorney_name = 'Carney Shegerian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@renolegalgroup.com' WHERE attorney_name = 'Brooke Reno' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sparrowllp.com' WHERE attorney_name = 'Nikka Maleki' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@civilemploymentlaw.com' WHERE attorney_name = 'Bita Neyestani' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@moxielegal.com' WHERE attorney_name = 'Tina Mehr' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wittlf.com' WHERE attorney_name = 'Steven Witt' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@gruzenmousslylaw.com' WHERE attorney_name = 'Shahla Judith Moussly' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@fuschettilaw.com' WHERE attorney_name = 'Danielle A Fuschetti' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@calemploymentattorney.com' WHERE attorney_name = 'Vincent Calderone' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@vallerolaw.com' WHERE attorney_name = 'Kaylina Castellanos' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@tedholmquistlaw.com' WHERE attorney_name = 'Ted Holmquist' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@soundofjustice.com' WHERE attorney_name = 'Charles S. Feigelstock' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@justiceshieldlaw.com' WHERE attorney_name = 'Brandon S Younesi' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@richardsonemploymentlaw.com' WHERE attorney_name = 'Daniel Richardson' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@justiceforworkers.com' WHERE attorney_name = 'Tara Hattendorf' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@risselllawfirm.com' WHERE attorney_name = 'Melody Rissell Leonard' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@webberlawgroup.com' WHERE attorney_name = 'Douglas M. Egbert' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@archlegal.com' WHERE attorney_name = 'Monique R. Rodriguez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jmllaw.com' WHERE attorney_name = 'Karina Godoy' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@berberianlawgroup.com' WHERE attorney_name = 'Christopher Berberian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@discriminationlawyerla.com' WHERE attorney_name = 'Joshua Klugman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leclerclaw.com' WHERE attorney_name = 'Mark LeClerc' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rostomyanlaw.com' WHERE attorney_name = 'Aram Rostomyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@pacificworkers.com' WHERE attorney_name = 'Mark Scott Thuesen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@potterhandy.com' WHERE attorney_name = 'Mark Potter' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@norcaladvocates.com' WHERE attorney_name = 'Brittany Victoria Berzin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hr.law' WHERE attorney_name = 'Joseph Richards' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@norcaladvocates.com' WHERE attorney_name = 'Alexander McKay' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@davtyanlaw.com' WHERE attorney_name = 'Jean Hopkins Power' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@yoestlaw.com' WHERE attorney_name = 'Melissa Yoest' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@apkatlaw.com' WHERE attorney_name = 'Alex P. Katofsky' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@elenamedinalaw.com' WHERE attorney_name = 'Elena Medina Torres' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@impactfirminc.com' WHERE attorney_name = 'Daniel Isack Cohen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sweetjames.com' WHERE attorney_name = 'Angie M. Kwik' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rkmlaw.net' WHERE attorney_name = 'Angelique Mangaser' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rklegalpc.com' WHERE attorney_name = 'Romina Keshishyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@winnerscirclelaw.com' WHERE attorney_name = 'Suzanne Patricia Porrazzo' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@nobleattorneys.com' WHERE attorney_name = 'Michael Chakrian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bettslawgroup.com' WHERE attorney_name = 'Whitney Betts' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rkmlaw.net' WHERE attorney_name = 'Danielle Sweets Worthy' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rholawgroup.com' WHERE attorney_name = 'Charles Rho' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@worklawyerca.com' WHERE attorney_name = 'Karl Gerber' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lntriallawyers.com' WHERE attorney_name = 'Jacob Nalbandyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@myerslawgroup.com' WHERE attorney_name = 'Morgan Good' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ejlglaw.com' WHERE attorney_name = 'Kaveh S. Elihu' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lawyersforlegalrights.com' WHERE attorney_name = 'Matthew Gutierrez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@blancoariaslaw.com' WHERE attorney_name = 'Janeth Arias' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@plblaw.com' WHERE attorney_name = 'Todd Harrison' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@clarkemploymentlaw.com' WHERE attorney_name = 'Tyler Clark' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@arendsenbraddock.com' WHERE attorney_name = 'Kyle Pruner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@joesayaslaw.com' WHERE attorney_name = 'C. Joe Sayas Jr.' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@aaronsward.com' WHERE attorney_name = 'Martin Isaac Aarons' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@slspc.law' WHERE attorney_name = 'Trey Sims' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hickslaw.net' WHERE attorney_name = 'Eugenia Hicks' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wilshirelawfirm.com' WHERE attorney_name = 'Arrash Tayefeh Fattahi' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wrongedatwork.com' WHERE attorney_name = 'David Graulich' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@law-slg.com' WHERE attorney_name = 'Alyze Rosabelle Salan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@olivareslaw.com' WHERE attorney_name = 'Alicia Olivares' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leoneslawfirm.com' WHERE attorney_name = 'Valerie Leones-Ramos' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@clipnerlaw.com' WHERE attorney_name = 'Candice Clipner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@henrylacey.com' WHERE attorney_name = 'Stephen Henry' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kingsiegel.com' WHERE attorney_name = 'Erum Siddiqui' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@baattorneys.com' WHERE attorney_name = 'David M. Saldana' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sshhzlaw.com' WHERE attorney_name = 'Wilmer J. Harris' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@tanyagomerman.com' WHERE attorney_name = 'Ashley N. Pellouchoud' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@calunitedlaw.com' WHERE attorney_name = 'Jared Richard Sohn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@loywr.com' WHERE attorney_name = 'Zachariah E Moura' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@d.law' WHERE attorney_name = 'Emilia Mehrabian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bohmlaw.com' WHERE attorney_name = 'Kelsey Ciarimboli' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@eliteemploymentattorneys.com' WHERE attorney_name = 'Samuel Nielson' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@gunncoble.com' WHERE attorney_name = 'Beth Anne Gunn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@danielnewmanattorney.com' WHERE attorney_name = 'Daniel Todd Newman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rezlaw.com' WHERE attorney_name = 'Zoe DeGeer' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@javalawfirm.com' WHERE attorney_name = 'Nima Javaherian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@tl4j.com' WHERE attorney_name = 'Kelly Hanker' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@employeerightslaw.com' WHERE attorney_name = 'Lauren Abrams' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@riselawfirm.com' WHERE attorney_name = 'Eliot J Rushovich' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kplitigators.com' WHERE attorney_name = 'Zareh Jaltorossian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@anticounilaw.com' WHERE attorney_name = 'Nicole Ricotta' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@neselaw.com' WHERE attorney_name = 'Carly Nese' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@mchenryemployment.com' WHERE attorney_name = 'Sean McHenry' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@shirazilawoffice.com' WHERE attorney_name = 'Brian Y. Shirazi' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@d.law' WHERE attorney_name = 'Emil Davtyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@milazzolawpc.com' WHERE attorney_name = 'Jennifer Milazzo' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@msshethlaw.com' WHERE attorney_name = 'Monali Sheth' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hadsellstormer.com' WHERE attorney_name = 'Cornelia Dai' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@westviewlawpc.com' WHERE attorney_name = 'David Safvati' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@principleemployment.law' WHERE attorney_name = 'Nicole Meyers' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@employeerightsattorneygroup.com' WHERE attorney_name = 'Diana Gevorkian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ggtriallaw.com' WHERE attorney_name = 'Philip Horlacher' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sommerselg.com' WHERE attorney_name = 'Stephen A Sommers' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@cowan-law.com' WHERE attorney_name = 'Jeffrey W. Cowan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sl-employmentlaw.com' WHERE attorney_name = 'Latika Moti Malkani' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@waltermosleyesq.com' WHERE attorney_name = 'Nathalie Meza Contreras' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@zavalaw.com' WHERE attorney_name = 'Robert Zavala' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bwcounsel.com' WHERE attorney_name = 'Jonathan Weinman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@employmentrightslaw.org' WHERE attorney_name = 'Payam Aframian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lawless-lawless.com' WHERE attorney_name = 'Sinclaire Parer' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@californialaborlawattorney.com' WHERE attorney_name = 'Catherine Roland' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lazarskilaw.com' WHERE attorney_name = 'Bryan J Lazarski' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@gtaylorlaw.com' WHERE attorney_name = 'Greg Taylor' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@fairchildemploymentlaw.com' WHERE attorney_name = 'Jillian Fairchild' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leopardlawpc.com' WHERE attorney_name = 'Stephanie P. Kasis' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ragerlawoffices.com' WHERE attorney_name = 'Jeffrey Rager' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@swanemploymentlaw.com' WHERE attorney_name = 'Susan Swan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@amymorgenstern.com' WHERE attorney_name = 'Amy Morgenstern' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@denlaborlaw.com' WHERE attorney_name = 'Daniel Nomanim' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@reisnerking.com' WHERE attorney_name = 'Tessa King' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ggtriallaw.com' WHERE attorney_name = 'Christian Daniel Girgis' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@tomorrowlaw.com' WHERE attorney_name = 'Brian Angelini' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@frontierlawcenter.com' WHERE attorney_name = 'Emanuel Starr' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kentpincinlaw.com' WHERE attorney_name = 'Emily Rose Pincin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@reisnerking.com' WHERE attorney_name = 'Adam Reisner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@reismanandreisman.com' WHERE attorney_name = 'Daniel Reisman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rezlaw.com' WHERE attorney_name = 'Erin Pulaski' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@worklawmaw.com' WHERE attorney_name = 'Marjorie Wallace' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@macaraeglaw.com' WHERE attorney_name = 'April Macaraeg' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jaramilla.com' WHERE attorney_name = 'Toni Jaramilla' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@shakourilawfirm.com' WHERE attorney_name = 'Ashkan Shakouri' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@setyanlaw.com' WHERE attorney_name = 'Sam Setyan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@terplaw.com' WHERE attorney_name = 'Andrea Alejandra Nunez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@guptawessler.com' WHERE attorney_name = 'Hannah Kieschnick' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@moraemploymentlaw.com' WHERE attorney_name = 'Beth Wolf Mora' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@nicholslawyer.com' WHERE attorney_name = 'Sarah Nichols' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bmcclaw.com' WHERE attorney_name = 'Bryan McCormack' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@employment-lawyers.com' WHERE attorney_name = 'Leonard Emma' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sfbayemploymentlawyer.com' WHERE attorney_name = 'Bruce Weisenberg' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@attorneymattvandall.com' WHERE attorney_name = 'Matthew Peter Vandall' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rezlaw.com' WHERE attorney_name = 'John T Mullan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kenboydlaw.com' WHERE attorney_name = 'Ken Boyd' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rudolphdelson.com' WHERE attorney_name = 'Rudolph Delson' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@valerian.law' WHERE attorney_name = 'Xinying Valerian' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hindenlaw.com' WHERE attorney_name = 'Traci Michelle Hinden' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@webberlawgroup.com' WHERE attorney_name = 'Kelsey A. Webber' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sbm.law' WHERE attorney_name = 'Shannon Seibert' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sumagaysaylaw.com' WHERE attorney_name = 'Glicel Sumagaysay' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@pglusmanlaw.com' WHERE attorney_name = 'Paul Glusman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ktlawsf.com' WHERE attorney_name = 'Alison Kosinski' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@workerrightsattorney.com' WHERE attorney_name = 'Paul Pfeilschiefter' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@os-legal.com' WHERE attorney_name = 'Christian Schreiber' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bmdlegal.com' WHERE attorney_name = 'Laura Mazza' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@towerlegalgroup.com' WHERE attorney_name = 'James Clark' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leclerclaw.com' WHERE attorney_name = 'Christopher LeClerc' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@towerlegalgroup.com' WHERE attorney_name = 'Renee Parras Ortega' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jvlaw.com' WHERE attorney_name = 'Jeannette A. Vaccaro' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@tong-law.com' WHERE attorney_name = 'Vincent Tong' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@valerian.law' WHERE attorney_name = 'Xiaoqing Zhang' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kgworklaw.com' WHERE attorney_name = 'Aaron Kaufmann' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ratnermolineaux.com' WHERE attorney_name = 'David S. Ratner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sperberlaw.com' WHERE attorney_name = 'Anthony Sperber' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@servinginjuredworkers.com' WHERE attorney_name = 'Benjamin K. Karpilow' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bryanschwartzlaw.com' WHERE attorney_name = 'Bryan Schwartz' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@minnardlaw.com' WHERE attorney_name = 'Carla Minnard' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hoyerlaw.com' WHERE attorney_name = 'Ryan Hicks' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@avlonilaw.com' WHERE attorney_name = 'Navruz Avloni' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@classlawgroup.com' WHERE attorney_name = 'Steven Tindall' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kingsiegel.com' WHERE attorney_name = 'Julian Burns King' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@mhpsf.com' WHERE attorney_name = 'Cliff Palefsky' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@moltenilaw.com' WHERE attorney_name = 'Cristina Molteni' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@curtisallenlaw.com' WHERE attorney_name = 'Curtis Allen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@burrellkagin.com' WHERE attorney_name = 'Darci Elaine Burrell' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@dcenglandlaw.org' WHERE attorney_name = 'Deborah England' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kochanstephenson.com' WHERE attorney_name = 'Deborah Kochan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@collierlawsf.com' WHERE attorney_name = 'Dustin L. Collier' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@emilynugentlaw.com' WHERE attorney_name = 'Emily Nugent' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@altshulerberzon.com' WHERE attorney_name = 'Eve Cervantez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rbgg.com' WHERE attorney_name = 'Gay Crosthwait Grunfeld' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kauppfeinberg.com' WHERE attorney_name = 'Gordon Kaupp' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lawless-lawless.com' WHERE attorney_name = 'Emily McGrath' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bermannorth.com' WHERE attorney_name = 'Stacy Y. North' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@neumann-law.com' WHERE attorney_name = 'Michelle Neumann' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@looga.com' WHERE attorney_name = 'George Allen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@erlich.lawyer' WHERE attorney_name = 'Jason Erlich' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@giccb.com' WHERE attorney_name = 'Jayme L. Walker' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jenniferreischlaw.com' WHERE attorney_name = 'Jennifer A. Reisch' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@telferlaw.com' WHERE attorney_name = 'Jill Patricia Telfer' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@advocatesforworkers.com' WHERE attorney_name = 'Joseph D. Sutton' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kochanstephenson.com' WHERE attorney_name = 'Mathew N Stephenson' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@thearmstronglawfirm.com' WHERE attorney_name = 'Kelly Armstrong' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bmdlegal.com' WHERE attorney_name = 'Kathryn Bain' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bohmlaw.com' WHERE attorney_name = 'Lawrance Bohm' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bohmlaw.com' WHERE attorney_name = 'Catharine McGlynn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@bohmlaw.com' WHERE attorney_name = 'Andrew L. Thrasher' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@gobolaw.com' WHERE attorney_name = 'Maria Bourn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@adamsemploymentlawyer.com' WHERE attorney_name = 'Mark Stephen Adams' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@nka.com' WHERE attorney_name = 'Matthew Helland' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@michaelahmadlaw.com' WHERE attorney_name = 'Michael S. Ahmad' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@drewlewis.law' WHERE attorney_name = 'Drew Lewis' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sempervirenslaw.com' WHERE attorney_name = 'Elizabeth Rose Malay' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@mcquaidlaw.com' WHERE attorney_name = 'Moira McQuaid' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@righettilaw.com' WHERE attorney_name = 'Matthew Righetti' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@vinickhyams.com' WHERE attorney_name = 'Sharon Vinick' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sampathlaw.com' WHERE attorney_name = 'Supreeta Sampath' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@burrellkagin.com' WHERE attorney_name = 'Rebecca Kagin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@peretzlaw.com' WHERE attorney_name = 'Yosef Peretz' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hunterpylelaw.com' WHERE attorney_name = 'Daniel Brome' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@justice4you.com' WHERE attorney_name = 'Charlene Tsai' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@leonilawfirm.com' WHERE attorney_name = 'Terry R. Leoni' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rbgg.com' WHERE attorney_name = 'Jenny Yelin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@outtengolden.com' WHERE attorney_name = 'Molly Frandsen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wendymuselllaw.com' WHERE attorney_name = 'Wendy Musell' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@almeidalawgroup.com' WHERE attorney_name = 'John Robert Parker Jr.' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@outtengolden.com' WHERE attorney_name = 'Adam Koshkin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@highmanlaw.com' WHERE attorney_name = 'Bruce J. Highman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@pasternaklaw.com' WHERE attorney_name = 'Jeremy Pasternak' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kevinglittle.com' WHERE attorney_name = 'Jessica Juarez' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rezlaw.com' WHERE attorney_name = 'Michelle G. Lee' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@trombetta.law' WHERE attorney_name = 'Conor Trombetta' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@norcaladvocates.com' WHERE attorney_name = 'Connor Olson' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wbslawyers.com' WHERE attorney_name = 'Rahel H Alazar' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@gkglawoffice.com' WHERE attorney_name = 'Genevieve K. Guertin' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@peltongraham.com' WHERE attorney_name = 'Taylor Bell Graham' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kellergrover.com' WHERE attorney_name = 'Robert Spencer' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jaretlaw.com' WHERE attorney_name = 'Robert Stewart Jaret' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wbslawyers.com' WHERE attorney_name = 'Elana Jacobs' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@waukeenmccoy.com' WHERE attorney_name = 'Waukeen Q McCoy' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wanglegalgroup.com' WHERE attorney_name = 'David T. Wang' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@schneiderwallace.com' WHERE attorney_name = 'Caroline Louise Hill' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@civilrightsca.com' WHERE attorney_name = 'Julianne Stanford' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jaffetriallaw.com' WHERE attorney_name = 'Stephen R. Jaffe' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@katzbanks.com' WHERE attorney_name = 'Rebecca Peterson-Fisher' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@qhlegal.com' WHERE attorney_name = 'Ramsey Hanafi' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@qhlegal.com' WHERE attorney_name = 'Gelian Belong' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@reedwilliamslaw.com' WHERE attorney_name = 'Donald R. Williams Jr.' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wendymuselllaw.com' WHERE attorney_name = 'Maraka Willits' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@attorneyrenepotter.com' WHERE attorney_name = 'Rene Potter' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@philhorowitz.com' WHERE attorney_name = 'Phil Horowitz' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@devincoylelaw.com' WHERE attorney_name = 'Devin Coyle' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@flo-law.com' WHERE attorney_name = 'Matthew J Flynn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@flo-law.com' WHERE attorney_name = 'Robert Michael Flynn' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@alancohenlaw.com' WHERE attorney_name = 'Alan Cohen' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@liberationlawgroup.com' WHERE attorney_name = 'Arlo Uriarte' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sbm.law' WHERE attorney_name = 'Joe Bautista' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@jlcemploymentlaw.com' WHERE attorney_name = 'Justin Clark' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@kgworklaw.com' WHERE attorney_name = 'Elizabeth Gropman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@skinnerlawgroupca.com' WHERE attorney_name = 'Tom Skinner' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@rezlaw.com' WHERE attorney_name = 'David A. Lowe' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@cajoblaw.com' WHERE attorney_name = 'Richard Vaznaugh' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lawofficesofclairecochran.com' WHERE attorney_name = 'Claire Elizabeth Cochran' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@sl-employmentlaw.com' WHERE attorney_name = 'Laura Herron Weber' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@scottstillmanlaw.com' WHERE attorney_name = 'Scott M. Stillman' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@shuklalawfirm.com' WHERE attorney_name = 'Bobby Shukla' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@asmlawyers.com' WHERE attorney_name = 'Reed W. L. Marcy' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wynnelawfirm.com' WHERE attorney_name = 'George R. Nemiroff' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@lohlegal.com' WHERE attorney_name = 'Andrea Loh' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@terplaw.com' WHERE attorney_name = 'Rachel Terp' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@schwinghamerlaw.com' WHERE attorney_name = 'Noah Schwinghamer' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@ratnermolineaux.com' WHERE attorney_name = 'Shelley Molineaux' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@altshulerberzon.com' WHERE attorney_name = 'James Michael Finberg' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@e-licenciados.com' WHERE attorney_name = 'Virginia Villegas' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@hunterpylelaw.com' WHERE attorney_name = 'Bradan Litzinger' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@boucher-law.com' WHERE attorney_name = 'Robert Boucher' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@themmlawfirm.com' WHERE attorney_name = 'Cody Alexander Bolce' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@wbslawyers.com' WHERE attorney_name = 'Carole L Okolwicz' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@callanlawoffice.com' WHERE attorney_name = 'Grainne Callan' AND email IS NULL;  -- INFERRED
UPDATE public.crm_firms SET email = 'info@clarksonlawfirm.com' WHERE attorney_name = 'Brent A. Robinson' AND email IS NULL;  -- INFERRED
