You can Create a new "Signals Card" that outs score, signals, snapshot, iorad expansion analyzis... so there is room to everything elese... or just make these cards at the bottom of the new page.

# Rework Company Detail Page: CRM Dashboard Cards + Outreach

## Overview

Add a new "Generate Cards" action on the company page that calls a **separate edge function** with the master CRM prompt. The output (dashboard cards + email/LinkedIn sequences) is stored in a new `company_cards` table and rendered as a card-based UI on the company detail page. The existing story prompt and generation remain untouched.

The current Score Breakdown, Signals, and Snapshot History sections move behind a collapsible "Extra" panel.

---

## What Changes

### 1. New database table: `company_cards`

Stores the full JSON output from the master prompt per company.


| Column        | Type        | Notes                                            |
| ------------- | ----------- | ------------------------------------------------ |
| id            | uuid        | PK                                               |
| company_id    | uuid        | FK to companies                                  |
| cards_json    | jsonb       | The full `cards` array from the output           |
| assets_json   | jsonb       | The `assets` object (email + LinkedIn sequences) |
| account_json  | jsonb       | The `account` summary object                     |
| model_version | text        | Which AI model was used                          |
| created_at    | timestamptz | auto                                             |


RLS: same pattern as snapshots (anon + authenticated can read/insert, authenticated can update).

### 2. New edge function: `generate-cards`

- Accepts `{ company_id }` 
- Loads company data, contacts, signals, and the latest snapshot from DB
- Builds the master prompt (the one you pasted) with all available context injected
- Calls Lovable AI gateway
- Parses the JSON response
- Upserts into `company_cards` (one row per company, latest wins)
- Returns the parsed result

### 3. Reworked Company Detail page layout

```text
+--------------------------------------------------+
| Header: Company Name / Domain / Score / Status    |
| [Run v] [Generate Cards]                          |
+--------------------------------------------------+
| Contacts card (existing, unchanged)               |
+--------------------------------------------------+
| Company metadata pills (existing, unchanged)      |
+==================================================+
|                                                    |
|  DASHBOARD CARDS (new)                             |
|  ┌──────────────┐  ┌──────────────┐               |
|  │ Account      │  │ ICP Fit &    │               |
|  │ Summary      │  │ Deal Shape   │               |
|  └──────────────┘  └──────────────┘               |
|  ┌──────────────┐  ┌──────────────┐               |
|  │ AI Strategy  │  │ Personalizn  │               |
|  │ (Top Plays)  │  │ Angles       │               |
|  └──────────────┘  └──────────────┘               |
|  ┌──────────────┐  ┌──────────────┐               |
|  │ Objections & │  │ Next Actions │               |
|  │ Rebuttals    │  │ (Tasks)      │               |
|  └──────────────┘  └──────────────┘               |
|  ┌──────────────┐  ┌──────────────┐               |
|  │ Events &     │  │ Clarifying   │               |
|  │ Market       │  │ Questions    │               |
|  └──────────────┘  └──────────────┘               |
|                                                    |
+==================================================+
|                                                    |
|  OUTREACH ASSETS                                   |
|  ┌─────────────────────────────────┐               |
|  │ Email Sequence (5 emails)       │               |
|  │ Each with subject lines + body  │               |
|  │ [Copy] button per email         │               |
|  └─────────────────────────────────┘               |
|  ┌─────────────────────────────────┐               |
|  │ LinkedIn Sequence (5 steps)     │               |
|  │ Each with timing + message      │               |
|  │ [Copy] button per step          │               |
|  └─────────────────────────────────┘               |
|                                                    |
+==================================================+
|                                                    |
|  EXTRA (collapsible, closed by default)            |
|  > Score Breakdown                                 |
|  > Signals (existing)                              |
|  > iorad Expansion Analysis (existing accordion)   |
|  > Snapshot History                                 |
|                                                    |
+--------------------------------------------------+
```

### 4. How each card renders

Each card from the `cards` array has: `id`, `title`, `priority`, `fields[]` (label/value/status), and `actions[]`.

- Fields render as label-value rows with a small truth-status badge (Provided / Source-backed / Inference / Hypothesis / Unknown)
- The "AI Strategy" card gets special treatment: each strategy shows Title, Pitch, Why Now, Proof, What to Validate, Sources
- Email/LinkedIn sequences render as expandable accordions with a "Copy" button per touch

### 5. "Generate Cards" button

Added next to the existing "Run" dropdown. Calls the new edge function, shows a loading spinner, then refreshes the cards data.

---

## Technical Details

### New hook: `useCompanyCards(companyId)`

Fetches the latest row from `company_cards` for the given company.

### Edge function: `supabase/functions/generate-cards/index.ts`

- Reads company, contacts, signals, latest snapshot
- Builds context object with all available data
- Injects into the master prompt template
- Calls `ai.gateway.lovable.dev` with `google/gemini-2.5-flash` (or the model from `ai_config`)
- Parses JSON, validates required keys exist
- Upserts into `company_cards`

### Master prompt storage

The master prompt will be stored in a new column `cards_prompt_template` on `ai_config` so it can be edited from admin settings (just like the existing story prompt). Initially seeded with the prompt you provided.

### Files to create

- `supabase/functions/generate-cards/index.ts` — edge function
- Migration for `company_cards` table + `cards_prompt_template` column on `ai_config`

### Files to modify

- `src/pages/CompanyDetail.tsx` — major rework: add cards UI, outreach UI, collapse existing sections into "Extra"
- `src/hooks/useSupabase.ts` — add `useCompanyCards` hook