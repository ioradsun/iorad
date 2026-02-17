

# Restructure Company Detail into 4 Tabs

## Overview

Split the current monolithic Company Detail page into **4 tabs**: Company, Strategy, Outreach, and Story. Each tab has its own "Generate" button where applicable. The Story tab adds two user-editable fields: a Loom video URL and an iorad tutorial URL, both saved to the `companies` table for per-company persistence.

## Tab Structure

```text
+----------------------------------------------------------+
| Header: Company Name / Domain / Score / Status            |
| [Run v] dropdown (stays global)                           |
+----------------------------------------------------------+
| [Company] [Strategy] [Outreach] [Story]                   |
+----------------------------------------------------------+
```

### Tab 1: Company (default)
- Contacts section (existing)
- Company metadata pills (existing)
- Extra panel (Score, Signals, Analysis, History) -- now open by default since it's the main content here

### Tab 2: Strategy
- "Generate Cards" button at top
- Dashboard Cards grid (Account Summary, ICP Fit, AI Strategy, etc.)
- Story Assets (Loom script config + iorad tutorial config from AI generation)

### Tab 3: Outreach
- "Generate Cards" button at top (shared generation with Strategy -- same edge function produces both)
- Email Sequence (5-touch accordion)
- LinkedIn Sequence (5-step accordion)

### Tab 4: Story
- Two input fields at the top:
  - **Loom Video URL** -- paste a Loom share URL, renders as embedded video
  - **iorad Tutorial URL** -- paste an iorad link, replaces the hardcoded tutorial in the customer story page
- Both fields save to new columns on the `companies` table (`loom_url`, `iorad_url`)
- Below the inputs, show embedded previews:
  - Loom video iframe (using Loom's embed format)
  - iorad tutorial iframe (same embed pattern as EmbedDemo)
- Readiness indicators: shows green badge when URL is populated
- Link to open the full customer story page (existing route)

## Database Changes

Add two nullable text columns to the `companies` table:

| Column | Type | Purpose |
|--------|------|---------|
| loom_url | text | Loom video share URL for this company's story |
| iorad_url | text | iorad tutorial URL replacing the hardcoded default |

These are user-entered per company and used by:
1. The Story tab on the Company Detail page (edit + preview)
2. The CustomerStory/EmbedDemo component (reads `iorad_url` from the company record instead of the hardcoded URL)

## Technical Details

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/CompanyDetail.tsx` | Wrap content in Radix Tabs; split into 4 tab panels; add Loom/iorad URL inputs with save; add embedded previews |
| `src/pages/story/EmbedDemo.tsx` | Read `iorad_url` from company record (passed via context or prop) instead of using the hardcoded fallback |
| `src/hooks/useSupabase.ts` | Add a `useUpdateCompany` mutation hook for saving loom_url/iorad_url |

### Migration
- `ALTER TABLE companies ADD COLUMN loom_url text, ADD COLUMN iorad_url text;`

### Loom embed logic
Loom share URLs follow the pattern `https://www.loom.com/share/{id}`. The embed URL is `https://www.loom.com/embed/{id}`. The UI will auto-convert share URLs to embed URLs for the iframe.

### iorad embed logic
The iorad URL entered by the user gets `?oembed=1` appended (same pattern as the existing EmbedDemo component). This URL also flows through to the CustomerStory page so the public-facing story shows the correct tutorial.

### Generate buttons
- Strategy and Outreach tabs share the same "Generate Cards" call (the edge function produces cards + outreach + story assets in one call). The button appears on whichever tab is active, and generating refreshes data for both tabs.
- The Story tab has a "Save" button for the Loom/iorad URLs (simple database update, no AI call needed).

### No Loom API integration
There is no Loom connector available. Users paste their Loom share URL manually. The embed renders immediately as a preview. This is the standard approach -- Loom's embed iframe works with just the URL.

