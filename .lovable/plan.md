

# Rework: From Research Report to ABM Conversion Microsite

## What Changes

The current story pages are structured as internal intelligence reports (signals, meta-patterns, operational friction, competitive insulation, quantified impact with math). The new structure is a customer-facing persuasion asset that feels insightful and helpful without being invasive.

## New Section Structure

The microsite will have these sections (replacing the current ones):

| Current Section | New Section | Purpose |
|---|---|---|
| StoryHero (signals-focused) | **StoryHero** (value-focused) | Personalized greeting, consultative tone |
| CompellingEventsSection | **WhatsHappeningSection** | "What's Happening at {Company}" - 1-3 initiatives, soft language |
| MetaPatternSection | **ExecutionFrictionSection** | "Where Execution Friction Usually Emerges" - educational, pattern-based |
| PartnerCeilingSection | **OpportunityAreasSection** | "Opportunity Areas for {Company}" - 2-4 use cases mapped to signals |
| EmbeddedLeverageSection | **HowIoradHelpsSection** | "How iorad Could Support These Initiatives" - outcome-focused, no feature dumping |
| EmbedDemo | **EmbedDemo** (keep) | Interactive walkthrough demo |
| ImpactSection (math/calculations) | **ConversationStartersSection** | 3 tailored discussion prompts |
| NarrativeSection | **REMOVED** | No longer needed |
| StoryCTA | **StoryCTA** (updated copy) | Softer, consultative CTA |
| (none) | **InternalSignalSummary** | Hidden section for sales team only (shown to authenticated users) |

## Changes Required

### 1. Data Model (`src/data/customers.ts`)

Replace the current `Customer` interface with a new one aligned to the ABM structure:

```
Customer {
  id, name, contactName, partner, persona
  whatsHappening: { title, detail }[]        // 1-3 initiatives
  executionFriction: string[]                 // educational friction patterns
  opportunityAreas: { title, detail }[]       // 2-4 mapped use cases
  howIoradHelps: { title, detail }[]          // outcome-focused support points
  conversationStarters: string[]              // 3 tailored prompts
  internalSignals: {                          // internal only
    signalTypes: string[]
    confidenceLevel: "High" | "Medium" | "Low"
    urgency: "Emerging" | "Active" | "High Momentum"
    primaryPersona: string
  }
}
```

### 2. AI Prompt (`supabase/functions/run-signals/prompt.ts`)

Replace the entire prompt with the new mega prompt. The JSON output schema changes to match:

```json
{
  "score_total": 0-100,
  "whats_happening": [{ "title": "...", "detail": "..." }],
  "execution_friction": ["pattern1", "pattern2"],
  "opportunity_areas": [{ "title": "...", "detail": "..." }],
  "how_iorad_helps": [{ "title": "...", "detail": "..." }],
  "conversation_starters": ["prompt1", "prompt2", "prompt3"],
  "internal_signals": {
    "signal_types": [...],
    "confidence_level": "High|Medium|Low",
    "urgency": "Emerging|Active|High Momentum",
    "primary_persona": "..."
  }
}
```

### 3. Snapshot-to-Customer Mapping (`src/pages/CustomerStory.tsx`)

Update `snapshotToCustomer()` to map the new JSON fields. Add backward compatibility so existing snapshots still render (graceful fallbacks for old field names).

### 4. Story Page Components (all in `src/pages/story/`)

**Replace/rewrite:**
- `CompellingEventsSection.tsx` becomes `WhatsHappeningSection.tsx` - soft initiative summaries
- `MetaPatternSection.tsx` becomes `ExecutionFrictionSection.tsx` - educational patterns, no accusations
- `PartnerCeilingSection.tsx` becomes `OpportunityAreasSection.tsx` - high-level use cases
- `EmbeddedLeverageSection.tsx` becomes `HowIoradHelpsSection.tsx` - outcomes, not features
- `ImpactSection.tsx` becomes `ConversationStartersSection.tsx` - 3 smart discussion prompts
- `NarrativeSection.tsx` - deleted (no longer part of the structure)

**Update:**
- `StoryHero.tsx` - softer headline, consultative tone, remove "unlock more value" framing
- `StoryCTA.tsx` - softer CTA language, conversation-oriented
- `EmbedDemo.tsx` - keep as-is

**New:**
- `InternalSignalSummary.tsx` - discreet section at bottom, only visible to authenticated/internal users

### 5. StoryPage Layout (`CustomerStory.tsx`)

Update the `StoryPage` component to render the new section order and conditionally show the internal signal summary only to authenticated users.

### 6. Edge Function (`supabase/functions/run-signals/index.ts`)

Minor update to `scoreSignals` - no structural changes needed since the AI output schema change is handled entirely in `prompt.ts`. The snapshot_json will naturally contain the new fields.

### 7. Hardcoded Example Data

Update the Intermedia example in `customers.ts` to match the new interface so the legacy route still works.

## Tone Guidelines (enforced in prompt + components)

- Use "It appears {Company} is investing in..." not "You are hiring 7 instructional designers"
- Use "When organizations invest in X, Y often follows" not "You are struggling with..."
- No scraping references, no exact counts, no LinkedIn mentions
- Strategic, consultative, executive-level, no hype

## What Stays the Same

- Routing structure (/:partner/:customer/stories/:contactName)
- Theme system (admin-controlled dark/light)
- EmbedDemo component
- CSS variables and animation system
- Contact name personalization
- Database tables (snapshots, companies) - just new JSON shape inside snapshot_json

