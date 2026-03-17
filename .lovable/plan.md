

## Plan: Create sync_checkpoints table and verify HubSpot count pipeline

### Problem
The `sync_checkpoints` table referenced by both `import-from-hubspot` (to store HubSpot counts) and `HubSpotStatus.tsx` (to read them) **does not exist**. The edge functions already have `contact_count` and `company_count` actions with the correct 2-year filter logic — they just fail silently when trying to upsert into a missing table.

### Steps

1. **Create the `sync_checkpoints` table** via migration:
   ```sql
   CREATE TABLE public.sync_checkpoints (
     key text PRIMARY KEY,
     value text NOT NULL DEFAULT '',
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;
   -- Authenticated users can read
   CREATE POLICY "Authenticated read" ON public.sync_checkpoints
     FOR SELECT TO authenticated USING (true);
   -- Service role can do everything (edge functions use service role key)
   CREATE POLICY "Service role full access" ON public.sync_checkpoints
     FOR ALL TO public USING (true) WITH CHECK (true);
   ```

2. **Trigger an initial count refresh** by calling `import-from-hubspot` with `action: "contact_count"` and `action: "company_count"` to populate the two checkpoint rows.

3. **Verify the UI** — after the table exists and counts are populated, the `StatPair` components in `HubSpotStatus.tsx` will automatically show `46,992 / X` with progress bars and gap indicators. No frontend changes needed — the code already handles this data correctly.

### No code changes needed
- `import-from-hubspot` already has both `contact_count` and `company_count` actions with 2-year filters
- `hubspot-daily-sync` already fires both counts as Step 0 every hourly run
- `HubSpotStatus.tsx` already queries `sync_checkpoints` and renders the comparison UI via `StatPair`

The only missing piece is the database table itself.

