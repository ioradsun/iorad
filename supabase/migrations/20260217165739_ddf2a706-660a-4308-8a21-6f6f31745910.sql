CREATE POLICY "Authenticated users can update snapshots"
ON public.snapshots
FOR UPDATE
USING (true)
WITH CHECK (true);