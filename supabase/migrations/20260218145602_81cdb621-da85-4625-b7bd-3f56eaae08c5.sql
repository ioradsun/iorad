
ALTER TABLE public.companies 
DROP CONSTRAINT companies_snapshot_status_check;

ALTER TABLE public.companies 
ADD CONSTRAINT companies_snapshot_status_check 
CHECK (snapshot_status = ANY (ARRAY['Generated'::text, 'Low Signal'::text, 'No Change'::text, 'Error'::text, 'cleared'::text]));
