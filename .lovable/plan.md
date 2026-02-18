
# Change "Bulk Import" to Pull All Companies (Label + Toast Updates)

## Current State

The `bulkImportCompanies` function in `import-from-hubspot` already uses `GET /crm/v3/objects/companies` with **no date filter** — it fetches all companies from HubSpot. Only the UI labels are outdated and still say "12mo".

## What Changes

Three small label/text updates across two files:

### 1. `src/pages/Dashboard.tsx`

- **Line 75 (toast)**: `"Starting bulk HubSpot import (last 12 months)…"` → `"Starting bulk HubSpot import (all companies)…"`
- **Line 289 (button label)**: `"Bulk Import (12mo)"` → `"Bulk Import (All)"`

### 2. `src/pages/AdminSettings.tsx`

- **Line 1547 (toast, if present)**: Update any "12 months" text to "all companies"
- **Line 1596 (button label)**: `"Bulk Import from HubSpot (12mo)"` → `"Bulk Import from HubSpot (All Companies)"`

### 3. `src/hooks/useSupabase.ts`

- **Line 336 (comment)**: `"// ---- Bulk Import from HubSpot (12 months) ----"` → `"// ---- Bulk Import from HubSpot (all companies) ----"`

### 4. `supabase/functions/import-from-hubspot/index.ts`

- **Line 1081 (comment)**: `"// ── Bulk Import: all HubSpot companies created in the last 12 months"` → `"// ── Bulk Import: all HubSpot companies (no date filter)"`

No backend logic changes, no migration, no redeployment needed — the function already fetches all companies correctly.
