
# Restructure: Company Categories & Stages

## What's Changing

The current binary `inbound / outbound` classification is replaced with a **3-category × 4-stage** model:

- **Categories**: `school` (EDU), `business` (corporate/B2B), `partner` (LMS resellers: Seismic, Docebo, etc.)
- **Stages**: `prospect` → `active_opp` → `customer` → `expansion`

Each category has its own AI prompt set. Stage is injected as a context variable into the prompt at generation time.

---

## Data Migration

Existing companies are automatically migrated using this mapping:

```text
source_type = "inbound"               → category = "business", stage = "prospect"
source_type = "outbound" + partner    → category = "partner",  stage = "prospect"
source_type = "outbound", no partner  → category = "business", stage = "prospect"
```

The `source_type` column is kept in the database for now (backward-compatible), but all new code will use `category` and `stage`.

---

## Implementation Plan

### 1. Database Migration (schema)

Add two new columns to the `companies` table:

```sql
ALTER TABLE companies
  ADD COLUMN category text NOT NULL DEFAULT 'business',
  ADD COLUMN stage    text NOT NULL DEFAULT 'prospect';
```

Run the auto-migration logic in the same migration:

```sql
-- outbound with partner → partner/prospect
UPDATE companies
  SET category = 'partner', stage = 'prospect'
  WHERE source_type = 'outbound' AND partner IS NOT NULL;

-- outbound without partner → business/prospect
UPDATE companies
  SET category = 'business', stage = 'prospect'
  WHERE source_type = 'outbound' AND (partner IS NULL OR partner = '');

-- inbound → business/prospect
UPDATE companies
  SET category = 'business', stage = 'prospect'
  WHERE source_type = 'inbound';
```

### 2. Database Migration (ai_config prompts)

Add three new prompt columns to `ai_config` — one system prompt per category:

```sql
ALTER TABLE ai_config
  ADD COLUMN school_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN school_prompt_template text NOT NULL DEFAULT '',
  ADD COLUMN business_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN business_prompt_template text NOT NULL DEFAULT '',
  ADD COLUMN partner_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN partner_prompt_template text NOT NULL DEFAULT '';
```

Pre-populate each with the existing relevant prompt so teams have a starting point:
- `partner_*` ← current `system_prompt` + `prompt_template` (outbound)
- `business_*` ← current `inbound_system_prompt` + `inbound_story_prompt`
- `school_*` ← blank (new vertical)

### 3. Dashboard (`src/pages/Dashboard.tsx`)

**Replace** the `inbound / outbound` tab switcher with a **3-tab category filter**: `School | Business | Partner`.

Each tab shows a count badge. The KPI strip changes:
- "Total tracked" stays
- "New inbound (24h)" → "New this week" (counts across all categories)
- "New outbound (24h)" → removed, replaced with a stage breakdown mini-bar

A **stage filter** (pill group: All / Prospect / Active Opp / Customer / Expansion) sits below the category tabs so users can slice within a category.

The `SourcePill` component becomes a `StagePill` showing the stage (e.g. `Prospect`, `Customer`).

### 4. Upload / Add Company Form (`src/pages/Upload.tsx`)

**Replace** the `inbound / outbound` switcher with a **category selector**: School / Business / Partner.

Add a **stage selector**: Prospect / Active Opp / Customer / Expansion (defaults to Prospect).

Partner field is only shown when category = `partner` (same logic as today's outbound-only partner field).

CSV column mapping adds `category` and `stage` as recognised headers alongside a backward-compat fallback that maps `source_type = inbound` → `business`.

### 5. Company Detail Page (`src/pages/CompanyDetail.tsx`)

**Header metadata row**: replace the source type badge with editable `Category` and `Stage` fields (inline `Select` dropdowns), so reps can move a company between stages directly.

**Regeneration logic**: the `isInbound` check that gates Apollo contact lookup and profile extraction is replaced by `category === "partner"` check (only partner companies get HubSpot-sourced contacts; school and business still get Apollo enrichment).

**Story URL**: the `source_type === "inbound"` guard for story URL construction changes to `category !== "partner"` (school and business use `company_cards.id` story URLs; partner still uses the `/:partner/:customer/stories/:contact` slug).

### 6. AI Generation (`supabase/functions/generate-cards/index.ts`)

The `isInbound` flag is replaced by `company.category`:

```typescript
const categoryPromptMap: Record<string, string> = {
  school:   aiConfig?.school_system_prompt   || "",
  business: aiConfig?.business_system_prompt || "",
  partner:  aiConfig?.partner_system_prompt  || "",
};
const systemPrompt = categoryPromptMap[company.category] || "";
```

The `stage` is injected into the user-facing context object so the AI can tailor its output:

```typescript
const context = {
  ...
  category: company.category,   // "school" | "business" | "partner"
  stage:    company.stage,       // "prospect" | "active_opp" | "customer" | "expansion"
  ...
};
```

### 7. Run-Signals (`supabase/functions/run-signals/index.ts`)

Replace the `source_type` reference with `company.category`. The `PARTNER_PERSONA_MAP` stays as-is since it's keyed by `partner` name, not `source_type`.

### 8. Admin Settings (`src/pages/AdminSettings.tsx`)

**AI & Prompts tab**: replace the `Inbound Prompt / Outbound Prompt / AI` sub-tabs with **`School | Business | Partner | AI`**.

Each category sub-tab contains:
- System Prompt textarea
- Prompt Template textarea (the "mega prompt" / story template)
- Plus the individual section prompts (Strategy, Outreach, Story, Transcript) inherited from today's structure

The export `.md` filename and section labels update accordingly.

### 9. Partner Story (`src/pages/CustomerStory.tsx` & `src/data/partnerMeta.ts`)

No structural change needed. The story URL routing already uses `partner` field. The `partnerMeta` inbound → `school` rename update: the fallback key `"inbound"` becomes `"business"` to match the new neutral category key for business/school. School companies will get the same neutral (no-partner-logo) hero treatment.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/...` | Add `category` + `stage` columns, migrate data, add prompt columns to `ai_config` |
| `src/pages/Dashboard.tsx` | 3-tab category filter, stage pill filter, updated KPIs |
| `src/pages/Upload.tsx` | Category + Stage selectors in manual form; CSV mapping |
| `src/types/index.ts` | Update `CSVRow` type with `category` + `stage` |
| `src/pages/CompanyDetail.tsx` | Category/stage editable badges, updated `isInbound` logic |
| `supabase/functions/generate-cards/index.ts` | Category-based prompt selection + stage context |
| `supabase/functions/run-signals/index.ts` | Replace `source_type` checks with `category` |
| `src/pages/AdminSettings.tsx` | 4-tab AI prompt panel (School / Business / Partner / AI) |
| `src/data/partnerMeta.ts` | Rename `inbound` key to `business` for fallback |
| `src/pages/CustomerStory.tsx` | Update fallback key reference |

---

## Notes

- `source_type` column is preserved in the database (not dropped) for safety — old code referencing it won't break immediately.
- The `is_existing_customer` flag is retained; the HubSpot lifecycle check in `generate-cards` continues to set it, but now the Customer/Expansion _stage_ is the primary UX signal for that status.
- No changes to routing, auth, or the public story microsite beyond the partner-meta key rename.
