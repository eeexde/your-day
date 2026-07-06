# AI Day Planner — Design

**Goal:** Add an AI engine that suggests a user's day from their activity pool, honoring hard requirements (`fixed_start_time`) and priority, and weaving in basic human needs (sleep, meals). Two entry points share one engine: a first-run **onboarding** flow (free-text → activities + first day) and a reusable **"Autoplan"** action on the day view. New users start with a seeded set of adjustable baseline activities.

**Non-goals (v1):** recurrence rules, multi-day planning, preview/confirm modal before writing, streaming responses, provider tool-calling. All out of scope.

## Context

The app is a client-side React + Vite SPA talking directly to Supabase (Postgres + Auth + RLS) via supabase-js. Scheduling today is a pure-TS deterministic `recommend()` (fixed-first, then priority) feeding a suggestions panel. There is no backend beyond Supabase and no AI. This design adds the first server-side component (a Supabase Edge Function) so an API key never reaches the browser.

The AI complements — does not replace — `recommend()`. The recommender keeps powering the suggestions panel. The AI does whole-day arrangement the greedy recommender can't: ordering, durations, buffers, and human-needs coverage reasoned about together.

---

## Section 1 — Seed default activities

New users get a baseline pool created **at signup**, before they interact.

**Mechanism:** Postgres trigger on `auth.users` insert calls a `SECURITY DEFINER` function that inserts default `activities` rows for the new `user_id`. Migration `0003_seed_default_activities.sql`. Chosen over a client-side "if pool empty" check: no race, no per-load work, and the pool genuinely exists before first load.

**Default set** — all `priority 1`, **flexible** (`fixed_start_time = null`), and ordinary editable/deletable activities:

| Name | Duration (min) |
|------|----------------|
| Sleep | 480 |
| Breakfast | 30 |
| Lunch | 30 |
| Dinner | 60 |
| Shower & hygiene | 30 |

All durations are multiples of 30, required by the existing schema check (`duration_minutes % 30 = 0`). Priority 1 surfaces them at the top of the pool and recommender; the user adjusts duration, places them, or ignores them like any activity.

---

## Section 2 — AI architecture

**Supabase Edge Function `plan-day`** (Deno), the only holder of the AI key.

- **Provider:** NVIDIA NIM first, via its OpenAI-compatible endpoint. Provider-agnostic by env:
  - `AI_BASE_URL` = `https://integrate.api.nvidia.com/v1`
  - `AI_MODEL` = `meta/llama-3.3-70b-instruct`
  - `AI_API_KEY` = NIM key (**secret**)
  Switching providers later = change these three env values, no code change.
- **Auth:** client calls the function with the user's Supabase JWT; the function verifies the user before doing work.
- **Structured output:** no reliance on provider tool-calling (free models are inconsistent). The function enforces JSON via a strict prompt ("return ONLY this JSON shape") plus **server-side schema validation with one retry** on malformed output. After a second failure it returns an error.
- **Thin function:** call AI → validate JSON → return. All logic that can live client-side and be unit-tested does.

### Key handling (never in git or chat)

- Set in **Supabase Dashboard → Settings → Edge Functions → Secrets**: `AI_API_KEY` (and `AI_BASE_URL`, `AI_MODEL`). Read at runtime via `Deno.env.get(...)`.
- Local function dev only: `supabase/functions/.env` (gitignored). Never the committed `.env.example`, which carries placeholder names with no values.

---

## Section 3 — UX (two modes, one engine)

Both modes call `plan-day` and map its response through the same client code.

**Onboarding** (once, after signup):
- A *"Describe your typical day"* textarea + submit; skippable. Pool is already seeded, so this captures the user's real activities.
- Client → `plan-day` `{ mode: 'onboard', text, pool }`. AI returns **new activities to create** and a **placement for today**.
- Client creates missing activities (`api.createActivity`), then places entries via the store (`addEntry`, optimistic). User lands on a filled timeline.

**Autoplan** (reusable, day view button *"✨ Autoplan"*):
- Client → `plan-day` `{ mode: 'plan', pool, date, nowMinutes }`.
- AI arranges the whole day: `fixed_start_time` activities are immovable at their time; others ordered by priority; durations respected; human needs (sleep, meals) woven in. Returns placements referencing **existing activity ids**.
- Written via the optimistic store; the user tweaks or deletes afterward. v1 writes directly — no preview modal (undo = delete/move).

**ID mapping (the testable seam):** the pool is sent as JSON with ids. The AI returns `activity_id` for an existing activity, or `name + duration_minutes + priority` for a new one. Client logic in `src/lib/applyPlan.ts`: for each returned item, if `activity_id` is present use it; else create the activity, then place the entry. Isolated and unit-tested with a mocked api.

### Response shape (validated)

```json
{
  "placements": [
    { "activity_id": "uuid", "start_time": "07:00", "duration_minutes": 60 },
    { "name": "Standup", "priority": 2, "start_time": "09:30", "duration_minutes": 30 }
  ]
}
```

Rules enforced by the validator: `start_time` is `"HH:MM"` on a 30-min boundary; `duration_minutes` is a positive multiple of 30; exactly one of `activity_id` or (`name` + `priority`) present; array length capped (e.g. ≤ 20) to bound writes.

---

## Section 4 — Error handling + testing

**Errors:**
- AI unreachable, rate-limited, or malformed JSON after **one retry** → function returns a non-2xx with a message; client toasts it; **timeline is untouched** (no partial writes on the plan path — validate fully before applying).
- Onboarding partial failure (some activity creates succeed, a later one fails) → surfaced via existing optimistic-store rollback + toast per operation; the user keeps whatever placed successfully and can retry.

**Testing (Vitest, mocked api):**
- `applyPlan.ts` — maps a validated response to create/place calls; covers existing-id path, new-activity path, and mixed.
- `buildPlanPrompt()` — pure prompt builder for both modes; snapshot/asserts key constraints are present (fixed times, priority, human needs, JSON-only instruction).
- AI-output **schema validator** — valid input passes; malformed inputs (bad time, non-30 duration, both/neither id-and-name, over cap) rejected; retry path exercised.
- The Deno edge function itself is **not** in the Vitest suite; live-verified manually with a real key.

---

## Files

- Create: `supabase/migrations/0003_seed_default_activities.sql`
- Create: `supabase/functions/plan-day/index.ts` (Deno edge function)
- Create: `src/lib/applyPlan.ts` + `src/lib/applyPlan.test.ts`
- Create: `src/lib/planPrompt.ts` (buildPlanPrompt + validator) + test
- Create: `src/lib/aiClient.ts` (client wrapper that invokes the edge function with JWT)
- Create: onboarding component (e.g. `src/components/Onboarding.tsx`) + Autoplan button wiring on the day view
- Modify: `.env.example` (placeholder names only), `.gitignore` (function env — done), `README.md` (setup: seed migration, function deploy, secret placement)

## Open items deferred to the plan

- Exact onboarding trigger (first-login flag vs. "no day_plan yet").
- Whether Autoplan clears existing entries or appends when the day is non-empty (lean: append; user deletes).
- Prompt wording iteration once the model is live.
