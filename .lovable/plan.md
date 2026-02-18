
# Bulk HubSpot Import (Last 12 Months) + Auto-Sync + Scout Score

## What We're Building

A complete pipeline that:
1. **Bulk imports all HubSpot companies created in the last 12 months** — runs as a self-chaining edge function so it doesn't time out on 1000s of companies
2. **Auto-syncs every 12 hours** — only re-imports companies where HubSpot data has changed
3. **Calculates a Scout Score (0–100)** for every company — deterministic math on contact activity data, no AI needed for the number itself
4. **Generates an AI activity summary** per company — Gemini reads the contacts' iorad activity fields and writes a 2-3 sentence narrative
5. **Displays Scout Score in the Dashboard** — sortable, colored tier badges (Hot / Warm / Lukewarm / Cold)
6. **Scout tab in Admin Settings** — editable scoring prompt + manual trigger buttons

---

## Current State

- **497 companies** in DB (all imported Feb 12–18, so most are from the current week, not 12 months)
- **1,665 contacts** — 186 have tutorial create dates, 414 have tutorial view dates, 16 have extension connections (all stored in `contacts.hubspot_properties` as JSON)
- **No `scout_score` columns** exist yet — needs migration
- **No `scout_scoring_prompt` column** on `ai_config` yet
- The existing `import-from-hubspot` function has `sync` (7 days), `sync_company`, `sync_hubspot_id`, `list_companies` actions — we add `bulk_import` and `auto_sync`
- `config.toml` already has `[functions.import-from-hubspot] verify_jwt = false` — no change needed there

---

## Database Changes (Migration)

Add to `companies` table:
- `scout_score` (integer, nullable) — 0–100
- `scout_score_breakdown` (jsonb, default `{}`) — `{ tutorial: 45, commercial: 15, recency: 7, intent: 5 }`
- `scout_scored_at` (timestamptz, nullable) — when score was last calculated
- `scout_summary` (text, nullable) — AI-generated activity narrative
- `scout_synced_at` (timestamptz, nullable) — last time this company was synced from HubSpot for change detection

Add to `ai_config` table:
- `scout_scoring_prompt` (text, NOT NULL, default = the full Master Prompt text from the user)

---

## Architecture

```text
TRIGGER: Dashboard "Bulk Import" button  OR  pg_cron every 12h
         ↓
import-from-hubspot  action:"bulk_import"
  • HubSpot search: createdate >= 12 months ago
  • Pages 100 companies at a time
  • For each: upsertCompany + importContactsForCompany (existing fns)
  • Sets scout_synced_at on each company
  • Self-chains via fetch to handle 1000s without timeout
  • After all companies imported → calls score-companies action:"score_all"
         ↓
score-companies  (NEW edge function)
  action:"score_all"  → scores every company in DB
  action:"score_one"  → scores a single company (called after individual syncs)
  action:"auto_sync"  → pg_cron target: re-imports only changed companies, then scores
  • Reads contacts.hubspot_properties for iorad activity
  • Runs deterministic formula (no AI)
  • If score changed ≥5 pts or first score → runs Gemini for scout_summary
  • Writes scout_score, scout_score_breakdown, scout_summary, scout_scored_at
```

---

## Scout Score Formula (Deterministic)

**Tutorial Activity — max 60 pts** (most important signal)
- Any contact with `first_tutorial_create_date` set: +20
- That date is within last 14 days: additional +15 (so +35 total for recent creation)
- Count of contacts with `first_tutorial_create_date` > 1 (multi-user): +5 per extra creator, max +20
- Any contact with `first_tutorial_view_date` within last 30 days: +8
- Any contact with `answers_with_own_tutorial_month_count` > 0: +7
- Any contact with `extension_connections` > 0: +5

**Commercial Motion — max 20 pts**
- `stage === 'expansion'`: +20
- `stage === 'customer'`: +15
- `stage === 'active_opp'`: +10
- `stage === 'prospect'` with `is_existing_customer: true`: +5

**Recency — max 10 pts**
- Any contact `hs_last_contacted` within 7 days: +10
- Within 30 days: +7
- Within 90 days: +3

**HubSpot Intent — max 10 pts**
- Any contact `hubspot_score` > 70: +10
- Any contact `hubspot_score` > 40: +5
- Any contact email opens + clicks > 10: +3
- Any contact `first_embed_tutorial_base_domain_name` set: +2

Score clamped to 0–100. Tiers: Hot (75+), Warm (50–74), Lukewarm (25–49), Cold (0–24).

---

## AI Activity Summary

After scoring, if the score changed by ≥5 points or `scout_scored_at` is null:
- Calls Gemini 2.5 Flash via `LOVABLE_API_KEY`
- System prompt: the `scout_scoring_prompt` from `ai_config`
- User input: list of contacts with their iorad activity fields (tutorial dates, counts, extension data)
- Output: 2–3 sentence plain-text narrative stored in `scout_summary`
- Example output: *"2 team members are actively creating iorad tutorials, with the most recent content built 6 days ago. One power user created 8 tutorials this month. The account is a prospect with strong tutorial creation intent."*

---

## Files to Create / Modify

| File | Action | What Changes |
|---|---|---|
| `supabase/migrations/TIMESTAMP.sql` | Create | Add 5 new columns to `companies`, 1 to `ai_config` |
| `supabase/functions/score-companies/index.ts` | **Create** | New edge function: score_all, score_one, auto_sync actions |
| `supabase/config.toml` | Edit | Add `[functions.score-companies] verify_jwt = false` |
| `supabase/functions/import-from-hubspot/index.ts` | Edit | Add `bulk_import` and `auto_sync` actions; update `scout_synced_at` after each upsert; call `score-companies` after bulk finishes |
| `src/pages/Dashboard.tsx` | Edit | Add Scout Score column + sort option + "Bulk Import" button in toolbar |
| `src/pages/AdminSettings.tsx` | Edit | Add new "Scout" tab (7th tab, grid-cols-7) with prompt editor + buttons |
| `src/pages/CompanyDetail.tsx` | Edit | Show Scout Score badge + `scout_summary` in company header area |
| `src/hooks/useSupabase.ts` | Edit | Add `useScoreCompanies` mutation |

---

## Bulk Import Action Details

The new `bulk_import` action in `import-from-hubspot`:

1. Accepts `{ action: "bulk_import", offset: 0, job_id?: string }`
2. HubSpot search: `createdate >= 12 months ago`, sorted by `createdate DESC`, 100 per page using `after` cursor pagination
3. For each company: calls existing `upsertCompany` + `importContactsForCompany`, then sets `scout_synced_at = now()`
4. After processing 100 companies, self-chains: calls itself with the next `after` cursor
5. When no more pages, calls `score-companies` with `action: "score_all"`
6. Tracks progress via `processing_jobs` table (same pattern as `run-signals`)

**Important**: Does NOT auto-trigger `run-signals` story generation — the queue clear is in effect. The import only refreshes HubSpot data and calculates Scout Scores.

---

## Auto-Sync Action (every 12 hours)

The `auto_sync` action in `score-companies`:

1. Fetches HubSpot companies where `hs_lastmodifieddate >= 12 hours ago`
2. For each: calls `import-from-hubspot` with `sync_hubspot_id` to refresh contacts
3. Then re-scores that company with `score_one`
4. Designed to be called by pg_cron — the Admin Settings "Scout" tab will show the SQL to set this up

---

## Dashboard UI Changes

- New **Scout Score column** in the company table: shows colored badge (🔴 Hot / 🟡 Warm / 🟢 Lukewarm / ⚪ Cold) + number
- New `scout_score` sort option added to `SortKey` type
- Default sort changed to `scout_score DESC` (hottest leads first)
- "Import from HubSpot" button replaced with two options: keep picker modal + add new **"Bulk Import (12mo)"** button that triggers the new action with a progress toast
- Small "Last synced" indicator showing `scout_synced_at` age

---

## Admin Settings: New "Scout" Tab

7th tab added to the existing 6-tab layout (`grid-cols-7`):

Contents:
1. **Scout Scoring Prompt** — editable textarea pre-filled with the Master Prompt, saved to `ai_config.scout_scoring_prompt`
2. **"Run Scoring Now"** button — calls `score-companies` with `action: "score_all"`, shows count of companies scored
3. **"Bulk Import from HubSpot (12 months)"** button — triggers the full import pipeline with progress feedback
4. **Score breakdown legend** — visual table showing what each component contributes (read-only reference)
5. **Auto-sync setup** — shows the pg_cron SQL snippet with a copy button, so the team can enable 12-hour scheduled syncs

---

## Key Design Decisions

1. **No story auto-generation during bulk import** — respects the cleared queue. The import only refreshes contact data and calculates Scout Scores.

2. **Self-chaining bulk import** — same pattern as `run-signals`, handles 500+ companies without timeouts. Each chain processes 100 companies then calls itself.

3. **Deterministic scoring** — no AI needed for the number. Fast, cheap, explainable to reps. AI only runs for the text summary, and only when the score changes materially.

4. **Change detection** — `bulk_import` sets `scout_synced_at` on each company. The `auto_sync` action uses `hs_lastmodifieddate` from HubSpot to only re-fetch companies that actually changed.

5. **Contact activity stored in `hubspot_properties` JSONB** — the scoring formula reads `hubspot_properties->>'first_tutorial_create_date'` etc., since that's how the existing import stores contact data.

6. **12-month filter uses HubSpot `createdate`** — matches the user's requirement exactly. HubSpot's `createdate` is the company creation date in HubSpot, which is close to when they first became a lead/contact.
