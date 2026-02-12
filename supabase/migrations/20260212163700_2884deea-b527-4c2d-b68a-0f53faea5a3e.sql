
-- Fix RLS policies: change restrictive anon SELECT to permissive for public story access

-- companies
DROP POLICY IF EXISTS "Anon can read companies" ON public.companies;
CREATE POLICY "Anon can read companies" ON public.companies FOR SELECT USING (true);

-- snapshots
DROP POLICY IF EXISTS "Anon can read snapshots" ON public.snapshots;
CREATE POLICY "Anon can read snapshots" ON public.snapshots FOR SELECT USING (true);

-- partner_config
DROP POLICY IF EXISTS "Anon can read partner_config" ON public.partner_config;
CREATE POLICY "Anon can read partner_config" ON public.partner_config FOR SELECT USING (true);

-- Also fix authenticated SELECT policies to be permissive
DROP POLICY IF EXISTS "Authenticated users can read companies" ON public.companies;
CREATE POLICY "Authenticated users can read companies" ON public.companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can read snapshots" ON public.snapshots;
CREATE POLICY "Authenticated users can read snapshots" ON public.snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can read partner_config" ON public.partner_config;
CREATE POLICY "Authenticated users can read partner_config" ON public.partner_config FOR SELECT USING (true);
