

# Refine Product Signals UX

## Changes

### 1. Tabs: "Recent" and "Resolved" (subtle, underline-style)
Replace the pill-style "Open" / "Closed" toggles with subtle text tabs -- like Instagram's "Posts" / "Reels" row -- using a simple underline on the active tab. Labels become **Recent** (maps to `open`) and **Resolved** (maps to `closed`).

### 2. Compose prompt text
Change `"What's on your mind, {name}?"` to `"What's your idea or problem with Scout?"`.

### 3. Remove status badge from cards
Remove the `Open` / `Closed` badge from the signal card header since the tabs already separate them.

### 4. Admin-only close actions with resolution tags
The three-dot menu on each card becomes **admin-only** (using the existing `useIsAdmin` hook). Admin gets two close options:
- **Close as Complete** -- sets status to `closed`, adds a `resolution: "complete"` field
- **Close as Ignored** -- sets status to `closed`, adds a `resolution: "ignored"` field
- If already closed: **Reopen** option

A small subtle label ("Completed" or "Ignored") will show on cards in the Resolved tab so admins/users can see why it was closed.

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/InternalSignals.tsx` | Replace tab pills with underline-style tabs; update compose placeholder text |
| `src/components/signals/SignalCard.tsx` | Remove status Badge; conditionally render three-dot menu for admins only; show resolution label on closed cards |
| `src/hooks/useSignals.ts` | Update `useToggleSignalStatus` to accept a `resolution` parameter (`"complete"` or `"ignored"`) |
| Migration | Add `resolution` text column (nullable) to `internal_signals` table |

**Database migration:**
```sql
ALTER TABLE public.internal_signals ADD COLUMN resolution text;
```

No new dependencies needed. The `useIsAdmin` hook already exists and will be imported into `SignalCard`.
