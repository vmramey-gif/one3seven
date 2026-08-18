-- One-time cleanup: two firm_profiles rows created during live vulnerability testing of
-- 20260817220000/223000 (before the SECURITY DEFINER bug in 20260817230000 was found and fixed --
-- while that bug was live, self-service firm_profiles inserts with an explicit firm_code briefly
-- succeeded). Both are obviously synthetic test data (firm_name='X'), not real accounts.
delete from public.firm_profiles where firm_code in ('FAKE02', 'FAKE03') and firm_name = 'X';
