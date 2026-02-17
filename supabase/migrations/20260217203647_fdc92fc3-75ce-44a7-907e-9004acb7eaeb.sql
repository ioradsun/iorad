
-- Allow delete on company_cards for the delete+insert pattern
CREATE POLICY "Anon can delete company_cards" ON public.company_cards FOR DELETE USING (true);
CREATE POLICY "Authenticated users can delete company_cards" ON public.company_cards FOR DELETE USING (true);
