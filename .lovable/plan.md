

# Internal Signals Feed

A new top-level page at `/signals` for capturing and discussing product ideas internally, styled as an Instagram-like feed.

---

## Database Schema

Three new tables:

### `signals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| author_id | uuid | references auth user, NOT NULL |
| author_name | text | denormalized for display |
| author_avatar | text | nullable |
| title | text | NOT NULL |
| description | text | NOT NULL |
| status | text | 'open' or 'closed', default 'open' |
| reactions | jsonb | default '{}', e.g. {"thumbsup": ["user-id-1"], "heart": ["user-id-2"]} |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### `signal_comments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| signal_id | uuid | FK to signals, NOT NULL |
| author_id | uuid | NOT NULL |
| author_name | text | denormalized |
| author_avatar | text | nullable |
| body | text | NOT NULL |
| parent_id | uuid | nullable, FK to self for replies |
| created_at | timestamptz | default now() |

### `signal_notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | recipient, NOT NULL |
| signal_id | uuid | FK to signals |
| type | text | 'comment', 'reply', 'status_change' |
| actor_name | text | who triggered it |
| read | boolean | default false |
| created_at | timestamptz | default now() |

RLS: All three tables -- authenticated users can SELECT, INSERT, UPDATE. Notifications: users can only SELECT/UPDATE their own rows.

Realtime enabled on `signal_notifications` for live badge updates.

---

## Frontend Components

### 1. Route and Navigation
- Add `/signals` route in `App.tsx` (protected)
- Add "Signals" nav item with a `MessageSquare` icon to the AppLayout header menu items array
- Show unread notification count badge on the nav item

### 2. `src/pages/InternalSignals.tsx` -- Main Page
- **Header**: Title "Internal Signals", unread notification bell icon, "+ New Signal" button
- **Tabs**: "Open" | "Closed" (pill-style, matching existing category tabs pattern)
- **Search bar**: Filters by title, description, author_name (client-side for simplicity)
- **Feed**: Vertical list of `SignalCard` components

### 3. `src/components/signals/SignalCard.tsx`
- Avatar + author name + relative timestamp (top row)
- Bold title + description text
- Bottom row: emoji reaction buttons (thumbsup, heart, fire, eyes) with counts, comment icon + count, status badge (Open/Closed)
- Clicking the card or comment icon opens the comment panel

### 4. `src/components/signals/NewSignalDialog.tsx`
- Dialog with title + description fields
- On submit: inserts into `signals` table with current user info

### 5. `src/components/signals/CommentPanel.tsx`
- Right-side sliding `Sheet` panel (using existing vaul/sheet component)
- Shows the signal details at top, then threaded comments below
- Text input at bottom to add a comment
- On comment: inserts into `signal_comments`, creates notification for signal author

### 6. `src/components/signals/NotificationBell.tsx`
- Bell icon with unread count badge
- Dropdown showing recent notifications
- Click marks as read and navigates to the signal

---

## Notification Logic

Handled client-side on insert:
- **Comment on signal**: Insert notification for `signals.author_id` (type: 'comment')
- **Reply to comment**: Insert notification for parent comment's `author_id` (type: 'reply')
- **Status change**: Insert notification for `signals.author_id` (type: 'status_change')

No edge function needed -- notifications are created as simple DB inserts alongside the action.

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Migration | New migration for 3 tables + RLS + realtime |
| Create | `src/pages/InternalSignals.tsx` |
| Create | `src/components/signals/SignalCard.tsx` |
| Create | `src/components/signals/NewSignalDialog.tsx` |
| Create | `src/components/signals/CommentPanel.tsx` |
| Create | `src/components/signals/NotificationBell.tsx` |
| Create | `src/hooks/useSignals.ts` |
| Edit | `src/App.tsx` -- add `/signals` route |
| Edit | `src/components/AppLayout.tsx` -- add Signals nav link + notification badge |

