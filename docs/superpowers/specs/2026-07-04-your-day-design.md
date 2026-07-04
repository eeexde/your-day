# Your Day — Design Spec

Date: 2026-07-04
Status: Approved

## Overview

Your Day is a single-day planner: a calendar focused on one day at a time. Users maintain a persistent pool of activities (each with a priority and optionally a fixed hour), place them onto a day timeline as blocks, allow overlaps (multitasking), and receive ranked suggestions for what else to schedule — hard requirements first, then by priority.

## Stack

- **Frontend:** React + Vite + TypeScript SPA
- **Backend:** Supabase (Postgres, Auth, RLS). Supabase JS client called directly from the browser.
- **Auth:** Email magic link + Google OAuth
- **Drag & drop:** dnd-kit
- **State:** Zustand
- **Tests:** Vitest + React Testing Library

## Data Model

All tables have `user_id` with RLS: users only see and modify their own rows.

### `activities` (the persistent pool)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | FK auth.users |
| name | text | required |
| color | text | hex, for timeline block |
| priority | int | 1–5, **1 = highest**; ties allowed |
| default_duration_minutes | int | default 60, multiple of 30 |
| fixed_start_time | time, nullable | set ⇒ **hard requirement**: activity may only be placed at this time |
| is_archived | bool | soft delete from pool |

### `day_plans`
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | |
| date | date | unique (user_id, date) |

### `plan_entries` (placements on a day's timeline)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| day_plan_id | uuid | FK day_plans |
| activity_id | uuid | FK activities |
| start_time | time | snapped to 30 min |
| duration_minutes | int | multiple of 30 |
| done | bool | checkoff |

**Overlaps are allowed by design** — no exclusion constraint. Multitasking is a feature.

### `templates` / `template_entries`
Same shape as `day_plans` / `plan_entries` but with a `name` instead of a `date`. "Copy yesterday" copies entries from date−1 into today; templates save/apply a named entry set (e.g. "Workday", "Weekend").

### Hard requirement rule
An activity with `fixed_start_time` can only be placed at that time. The UI blocks dropping it elsewhere (snap back + toast). The recommender always proposes it at its fixed time.

## UX

Two-pane layout:

### Left: timeline
- Vertical hour grid, default view 6:00–23:00, scrollable to full 24h. 30-minute snap.
- Entries render as colored blocks; height = duration. Overlapping entries render side-by-side as columns within the shared span (Google Calendar style).
- Red "now" line at current time.
- Block interactions: click for done-toggle / delete; drag to move (30-min snap); drag bottom edge to resize. Hard-requirement blocks refuse moves away from their fixed time.

### Right: pool + suggestions
- **Suggestions panel** (top): up to 5 ranked cards, e.g. "Gym • 7:00–8:00", with ✓ accept (places entry) and ✕ dismiss (hidden for the rest of the day).
- **Activity pool** (below): activities sorted by priority; drag onto timeline to place. Add/edit activity form (name, color, priority 1–5, default duration, optional fixed time).

### Top bar
- Date picker (default today)
- "Copy yesterday" button
- Templates menu: save current day as template / apply template
- Day stats chip: planned hours, done hours, priority coverage

## Recommender

Pure TypeScript function, runs client-side on every plan change.

**Input:** activity pool, today's entries, dismissed activity ids, current time.
**Output:** ranked list of `{activity, proposedStart}`, capped at 5.

1. Unplaced hard-requirement activities whose `fixed_start_time` is still ahead → suggest at their fixed time, top of list, ordered by time.
2. Unplaced flexible activities sorted by priority ascending (1 first) → propose the first gap after now that fits `default_duration_minutes`. A "gap" prefers slots with zero concurrent entries; since overlap is allowed, slots with the fewest concurrent entries are the fallback.
3. Dismissed activities are excluded for the current day.

## Reminders

Browser Notification API. On load, if permission granted, schedule notifications 10 minutes before hard-requirement entries via `setTimeout` while the tab is open. Known v1 limitation: no push infrastructure, so notifications only fire while the app is open.

## Error Handling

- Supabase writes are optimistic: apply locally, rollback + toast on failure.
- Offline: in-memory reads continue; writes fail visibly. No offline queue in v1.

## Testing

- Vitest unit suite for the recommender: hard-requirement ordering, priority ties, gap fitting, overlap-fallback, dismissals, past-fixed-time exclusion.
- Utils: 30-min snapping, overlap column layout.
- Store logic: optimistic write + rollback.
- Component tests: drag from pool to timeline happy path.
- RLS verified with two test users (each sees only own data).

## Out of Scope (backlog)

- Recurrence rules ("every weekday 8am")
- Multi-day / week view
- Push notifications (server-side)
- Offline write queue
- AI-powered suggestions (would move recommender server-side)
