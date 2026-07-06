# AI Day Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI engine that drafts a user's day from their activity pool — honoring `fixed_start_time` hard requirements and priority, weaving in basic human needs — via a first-run onboarding flow and a reusable "Autoplan" button, with new users pre-seeded with adjustable baseline activities.

**Architecture:** A Supabase Edge Function `plan-day` is a thin authenticated proxy to an OpenAI-compatible provider (NVIDIA NIM first) and holds the API key. All business logic — prompt construction, response validation, retry, and mapping to activities/entries — lives in tested pure modules under `src/lib`. New users get a default activity pool from a Postgres signup trigger.

**Tech Stack:** React 19, Vite, TypeScript (strict), Supabase (Postgres + Auth + Edge Functions/Deno), Zustand, Vitest.

## Global Constraints

- Priority is int 1–5, 1 = highest. Durations are positive multiples of 30 (schema enforces `duration_minutes % 30 = 0`).
- `start_time` values from the AI are `"HH:MM"` on 30-minute boundaries.
- The AI key is NEVER in the browser or git. It lives only in Supabase Edge Function secrets.
- The edge function holds no scheduling logic — it proxies `{messages}` to the provider and returns `{content}`. Everything testable is client-side.
- Spec: `docs/superpowers/specs/2026-07-06-ai-day-planner-design.md`.

## File Structure

- `supabase/migrations/0003_seed_default_activities.sql` — signup trigger seeding baseline activities.
- `src/lib/planLogic.ts` — pure, dependency-free: types, `buildPlanPrompt`, `validatePlanResponse`.
- `src/lib/aiClient.ts` — `requestPlan`: builds prompt, invokes the edge function, parses/validates, retries once.
- `src/lib/applyPlan.ts` — `applyPlan`: maps a validated plan to activity/entry creation via injected deps.
- `src/store/day.ts` — add `registerActivity` action (insert an already-created activity into the pool).
- `src/components/AutoplanButton.tsx` — day-view button running Autoplan.
- `src/components/Onboarding.tsx` — first-run free-text setup modal + `shouldOnboard()`.
- `supabase/functions/plan-day/index.ts` — Deno proxy edge function.
- `src/App.tsx` — wire in `AutoplanButton` and `Onboarding`.
- `README.md` — setup: run migration, deploy function, set secrets.

---

### Task 1: Seed default activities on signup

**Files:**
- Create: `supabase/migrations/0003_seed_default_activities.sql`

**Interfaces:**
- Consumes: `auth.users` insert, `public.activities` table.
- Produces: five priority-1 flexible activities per new user.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_seed_default_activities.sql`:

```sql
create or replace function public.seed_default_activities()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  insert into public.activities (user_id, name, color, priority, default_duration_minutes, fixed_start_time)
  values
    (new.id, 'Sleep',             '#6366f1', 1, 480, null),
    (new.id, 'Breakfast',         '#f59e0b', 1, 30,  null),
    (new.id, 'Lunch',             '#f59e0b', 1, 30,  null),
    (new.id, 'Dinner',            '#f97316', 1, 60,  null),
    (new.id, 'Shower & hygiene',  '#0ea5e9', 1, 30,  null);
  return new;
end;
$$;

revoke execute on function public.seed_default_activities() from public, anon, authenticated;

create trigger seed_default_activities_on_signup
  after insert on auth.users
  for each row execute function public.seed_default_activities();
```

- [ ] **Step 2: Apply the migration**

If the Supabase project is linked: `npx supabase db push`.
Otherwise paste the SQL into the dashboard SQL editor and run it.
Expected: statements succeed, no errors.

- [ ] **Step 3: Verify with a fresh signup**

Sign up a new test user in the app (or dashboard → Authentication → Add user), then in the SQL editor:

```sql
select name, priority, default_duration_minutes
from public.activities
where user_id = '<new-user-id>'
order by name;
```

Expected: 5 rows (Breakfast, Dinner, Lunch, Shower & hygiene, Sleep), all priority 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_seed_default_activities.sql
git commit -m "feat: seed default activities on signup"
```

---

### Task 2: Pure plan logic — prompt + validation

**Files:**
- Create: `src/lib/planLogic.ts`
- Test: `src/lib/planLogic.test.ts`

**Interfaces:**
- Consumes: nothing (zero imports).
- Produces: types `PlanMode`, `PoolActivity`, `PlanInput`, `Placement`, `PlanResponse`, `PromptMessages`; `buildPlanPrompt(mode, input): PromptMessages`; `validatePlanResponse(raw): PlanResponse` (throws on invalid). Consumed by `aiClient` (Task 3) and `applyPlan` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/planLogic.test.ts`:

```ts
import { buildPlanPrompt, validatePlanResponse } from './planLogic';
import type { PlanInput } from './planLogic';

const baseInput: PlanInput = {
  pool: [
    { id: 'a1', name: 'Gym', priority: 1, default_duration_minutes: 60, fixed_start_time: null },
    { id: 'a2', name: 'Meeting', priority: 3, default_duration_minutes: 30, fixed_start_time: '14:00:00' },
  ],
  date: '2026-07-06',
  nowMinutes: 480,
};

test('buildPlanPrompt embeds rules, pool, and JSON shape', () => {
  const { system, user } = buildPlanPrompt('plan', baseInput);
  expect(system).toMatch(/fixed_start_time/);
  expect(system).toMatch(/multiples of 30/i);
  expect(system).toMatch(/"placements"/);
  expect(user).toMatch(/"id":"a1"/);
  expect(user).toMatch(/2026-07-06/);
});

test('onboard mode includes the user free text', () => {
  const { user } = buildPlanPrompt('onboard', { ...baseInput, text: 'I work 9 to 5' });
  expect(user).toMatch(/I work 9 to 5/);
});

test('validatePlanResponse accepts a valid response', () => {
  const out = validatePlanResponse({
    placements: [
      { activity_id: 'a1', start_time: '07:00', duration_minutes: 60 },
      { name: 'Standup', priority: 2, start_time: '09:30', duration_minutes: 30 },
    ],
  });
  expect(out.placements).toHaveLength(2);
  expect(out.placements[0].activity_id).toBe('a1');
  expect(out.placements[1].name).toBe('Standup');
});

test('validatePlanResponse rejects a bad start_time', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', start_time: '07:15', duration_minutes: 60 }] })).toThrow();
});

test('validatePlanResponse rejects a non-30 duration', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', start_time: '07:00', duration_minutes: 45 }] })).toThrow();
});

test('validatePlanResponse rejects both id and name', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', name: 'X', priority: 2, start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects neither id nor name', () => {
  expect(() => validatePlanResponse({ placements: [{ start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects an out-of-range priority', () => {
  expect(() => validatePlanResponse({ placements: [{ name: 'X', priority: 9, start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects a missing placements array', () => {
  expect(() => validatePlanResponse({})).toThrow();
});

test('validatePlanResponse rejects more than 20 placements', () => {
  const many = Array.from({ length: 21 }, () => ({ activity_id: 'a1', start_time: '07:00', duration_minutes: 30 }));
  expect(() => validatePlanResponse({ placements: many })).toThrow();
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/planLogic.test.ts`
Expected: FAIL — module `./planLogic` not found.

- [ ] **Step 3: Implement**

Create `src/lib/planLogic.ts`:

```ts
// Pure, dependency-free scheduling-AI logic: prompt construction + response validation.
// The plan-day edge function is a dumb proxy and holds none of this — it lives here so it is unit-testable.

export type PlanMode = 'onboard' | 'plan';

export interface PoolActivity {
  id: string;
  name: string;
  priority: number;
  default_duration_minutes: number;
  fixed_start_time: string | null; // "HH:MM:SS" | "HH:MM" | null
}

export interface PlanInput {
  pool: PoolActivity[];
  date: string; // "YYYY-MM-DD"
  nowMinutes: number; // minutes from midnight
  text?: string; // free text, onboarding only
}

export interface Placement {
  activity_id?: string;
  name?: string;
  priority?: number;
  start_time: string; // "HH:MM"
  duration_minutes: number;
}

export interface PlanResponse {
  placements: Placement[];
}

export interface PromptMessages {
  system: string;
  user: string;
}

export const MAX_PLACEMENTS = 20;

const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

export function buildPlanPrompt(mode: PlanMode, input: PlanInput): PromptMessages {
  const system = [
    'You are a day-planning assistant. You arrange a single calendar day.',
    'Rules:',
    '- Any activity with a fixed_start_time is a hard requirement: place it at exactly that time, never move it.',
    '- Order the rest by priority (1 = highest) and sensible sequencing.',
    '- Cover basic human needs already in the pool (sleep, meals) at realistic times.',
    '- All start_time values use 24h "HH:MM" on 30-minute boundaries (minutes ":00" or ":30").',
    '- All duration_minutes are positive multiples of 30.',
    '- Keep every entry within one day (00:00 to 24:00). Do not exceed 24:00.',
    `- Return at most ${MAX_PLACEMENTS} placements.`,
    'Respond with ONLY a JSON object, no prose, no code fences, of exactly this shape:',
    '{"placements":[{"activity_id":"<pool id>","start_time":"HH:MM","duration_minutes":30}]}',
    'For a brand-new activity not in the pool, omit activity_id and give "name" and "priority" (1-5):',
    '{"placements":[{"name":"Standup","priority":2,"start_time":"09:30","duration_minutes":30}]}',
  ].join('\n');

  const poolJson = JSON.stringify(
    input.pool.map((a) => ({
      id: a.id,
      name: a.name,
      priority: a.priority,
      default_duration_minutes: a.default_duration_minutes,
      fixed_start_time: a.fixed_start_time,
    })),
  );

  const lines = [
    `Date: ${input.date}. Current time (minutes from midnight): ${input.nowMinutes}.`,
    `Existing activity pool (JSON): ${poolJson}`,
  ];
  if (mode === 'onboard') {
    lines.push(
      `The user described their typical day: "${input.text ?? ''}".`,
      'Create any missing activities from that description (as new-activity placements) and lay out a full day.',
    );
  } else {
    lines.push(
      'Arrange the existing pool into a full day. Prefer higher-priority activities. Do not invent activities unless clearly needed.',
    );
  }
  return { system, user: lines.join('\n') };
}

export function validatePlanResponse(raw: unknown): PlanResponse {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { placements?: unknown }).placements)) {
    throw new Error('response missing placements array');
  }
  const placements = (raw as { placements: unknown[] }).placements;
  if (placements.length > MAX_PLACEMENTS) {
    throw new Error(`too many placements (${placements.length} > ${MAX_PLACEMENTS})`);
  }
  const out: Placement[] = placements.map((p, i) => {
    if (typeof p !== 'object' || p === null) throw new Error(`placement ${i} is not an object`);
    const o = p as Record<string, unknown>;
    if (typeof o.start_time !== 'string' || !TIME_RE.test(o.start_time)) {
      throw new Error(`placement ${i} has a bad start_time`);
    }
    if (typeof o.duration_minutes !== 'number' || o.duration_minutes <= 0 || o.duration_minutes % 30 !== 0) {
      throw new Error(`placement ${i} has a bad duration_minutes`);
    }
    const hasId = typeof o.activity_id === 'string' && o.activity_id.length > 0;
    const hasNew = typeof o.name === 'string' && o.name.length > 0 && typeof o.priority === 'number';
    if (hasId === hasNew) {
      throw new Error(`placement ${i} must have either activity_id or name+priority, not both or neither`);
    }
    const result: Placement = { start_time: o.start_time, duration_minutes: o.duration_minutes };
    if (hasId) {
      result.activity_id = o.activity_id as string;
    } else {
      const pr = o.priority as number;
      if (pr < 1 || pr > 5) throw new Error(`placement ${i} priority out of range`);
      result.name = o.name as string;
      result.priority = pr;
    }
    return result;
  });
  return { placements: out };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/planLogic.test.ts`
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planLogic.ts src/lib/planLogic.test.ts
git commit -m "feat: add AI plan prompt builder and response validator"
```

---

### Task 3: AI client — invoke edge function with retry

**Files:**
- Create: `src/lib/aiClient.ts`
- Test: `src/lib/aiClient.test.ts`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`), `buildPlanPrompt`/`validatePlanResponse` (Task 2).
- Produces: `requestPlan(mode: PlanMode, input: PlanInput): Promise<PlanResponse>` — builds the prompt, invokes `plan-day`, parses+validates the content, retries once with a correction on failure. Consumed by Tasks 7 and 8.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/aiClient.test.ts`:

```ts
import { beforeEach, expect, test, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke } } }));

import { requestPlan } from './aiClient';
import type { PlanInput } from './planLogic';

const input: PlanInput = {
  pool: [{ id: 'a1', name: 'Gym', priority: 1, default_duration_minutes: 60, fixed_start_time: null }],
  date: '2026-07-06',
  nowMinutes: 480,
};

beforeEach(() => vi.clearAllMocks());

test('returns a parsed plan on valid content', async () => {
  invoke.mockResolvedValue({
    data: { content: '{"placements":[{"activity_id":"a1","start_time":"07:00","duration_minutes":60}]}' },
    error: null,
  });
  const plan = await requestPlan('plan', input);
  expect(plan.placements[0].activity_id).toBe('a1');
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('strips accidental code fences before parsing', async () => {
  invoke.mockResolvedValue({
    data: { content: '```json\n{"placements":[{"activity_id":"a1","start_time":"07:00","duration_minutes":60}]}\n```' },
    error: null,
  });
  const plan = await requestPlan('plan', input);
  expect(plan.placements).toHaveLength(1);
});

test('retries once with a correction when the first reply is invalid', async () => {
  invoke
    .mockResolvedValueOnce({ data: { content: 'not json at all' }, error: null })
    .mockResolvedValueOnce({
      data: { content: '{"placements":[{"activity_id":"a1","start_time":"08:00","duration_minutes":30}]}' },
      error: null,
    });
  const plan = await requestPlan('plan', input);
  expect(plan.placements[0].start_time).toBe('08:00');
  expect(invoke).toHaveBeenCalledTimes(2);
  const secondBody = invoke.mock.calls[1][1].body;
  expect(JSON.stringify(secondBody)).toMatch(/invalid/i);
});

test('throws when both attempts are invalid', async () => {
  invoke.mockResolvedValue({ data: { content: 'garbage' }, error: null });
  await expect(requestPlan('plan', input)).rejects.toThrow();
  expect(invoke).toHaveBeenCalledTimes(2);
});

test('throws when the function returns an error', async () => {
  invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
  await expect(requestPlan('plan', input)).rejects.toThrow(/boom/);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/aiClient.test.ts`
Expected: FAIL — module `./aiClient` not found.

- [ ] **Step 3: Implement**

Create `src/lib/aiClient.ts`:

```ts
import { supabase } from './supabase';
import { buildPlanPrompt, validatePlanResponse } from './planLogic';
import type { PlanInput, PlanMode, PlanResponse } from './planLogic';

async function callFunction(system: string, user: string, correction?: string): Promise<string> {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: correction ? `${user}\n\n${correction}` : user },
  ];
  const { data, error } = await supabase.functions.invoke('plan-day', { body: { messages } });
  if (error) throw new Error(error.message);
  const content = (data as { content?: string } | null)?.content;
  if (typeof content !== 'string' || content.length === 0) throw new Error('plan-day returned no content');
  return content;
}

function parse(content: string): PlanResponse {
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return validatePlanResponse(JSON.parse(cleaned));
}

export async function requestPlan(mode: PlanMode, input: PlanInput): Promise<PlanResponse> {
  const { system, user } = buildPlanPrompt(mode, input);
  try {
    return parse(await callFunction(system, user));
  } catch (first) {
    const correction = `Your previous reply was invalid (${(first as Error).message}). Return ONLY the JSON object described, nothing else.`;
    return parse(await callFunction(system, user, correction));
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/aiClient.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiClient.ts src/lib/aiClient.test.ts
git commit -m "feat: add AI client with edge-function invoke and retry"
```

---

### Task 4: Store — registerActivity action

**Files:**
- Modify: `src/store/day.ts`
- Test: `src/store/day.test.ts` (add one test)

**Interfaces:**
- Consumes: existing store internals.
- Produces: `registerActivity(activity: Activity): void` — insert an already-created activity into the pool, keeping priority sort. Consumed by `applyPlan` wiring (Tasks 7, 8).

- [ ] **Step 1: Add the failing test**

Add to `src/store/day.test.ts` (new test at the end of the file):

```ts
test('registerActivity inserts into the pool sorted by priority', () => {
  useDayStore.setState({ activities: [
    { id: 'a1', user_id: 'u', name: 'Zeta', color: '#fff', priority: 3, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
  ] });
  useDayStore.getState().registerActivity({
    id: 'a2', user_id: 'u', name: 'Alpha', color: '#fff', priority: 1, default_duration_minutes: 30, fixed_start_time: null, is_archived: false,
  });
  const names = useDayStore.getState().activities.map((a) => a.name);
  expect(names).toEqual(['Alpha', 'Zeta']);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/store/day.test.ts -t registerActivity`
Expected: FAIL — `registerActivity is not a function`.

- [ ] **Step 3: Implement**

In `src/store/day.ts`, add to the `DayStore` interface (after `dismiss`):

```ts
  registerActivity: (activity: Activity) => void;
```

And add the action to the returned object (after the `dismiss` action):

```ts
    registerActivity: (activity) =>
      set((s) => ({ activities: sortActivitiesByPriority([...s.activities, activity]) })),
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/store/day.test.ts`
Expected: all PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/store/day.ts src/store/day.test.ts
git commit -m "feat: add registerActivity store action"
```

---

### Task 5: applyPlan — map a plan to activities and entries

**Files:**
- Create: `src/lib/applyPlan.ts`
- Test: `src/lib/applyPlan.test.ts`

**Interfaces:**
- Consumes: `Activity`/`NewActivity` (`src/types.ts`), `PlanResponse` (Task 2), `timeToMinutes` (`src/lib/time.ts`).
- Produces: `ApplyPlanDeps` and `applyPlan(plan, pool, deps): Promise<void>`. For each placement: existing id → place entry; new (name) → create activity, register it, place entry; unknown id with no name → skip. Consumed by Tasks 7 and 8.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/applyPlan.test.ts`:

```ts
import { expect, test, vi } from 'vitest';
import { applyPlan } from './applyPlan';
import type { ApplyPlanDeps } from './applyPlan';
import type { Activity } from '../types';
import type { PlanResponse } from './planLogic';

function pool(): Activity[] {
  return [
    { id: 'a1', user_id: 'u', name: 'Gym', color: '#fff', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
  ];
}

function deps(): ApplyPlanDeps & { created: unknown[]; entries: unknown[] } {
  const created: unknown[] = [];
  const entries: unknown[] = [];
  return {
    created,
    entries,
    createActivity: vi.fn(async (input) => {
      const a: Activity = { id: `new-${created.length}`, user_id: 'u', is_archived: false, ...input };
      created.push(a);
      return a;
    }),
    registerActivity: vi.fn(),
    addEntry: vi.fn(async (activityId, startMinutes, durationMinutes) => {
      entries.push({ activityId, startMinutes, durationMinutes });
    }),
  };
}

test('existing id places an entry with converted start minutes', async () => {
  const plan: PlanResponse = { placements: [{ activity_id: 'a1', start_time: '07:00', duration_minutes: 60 }] };
  const d = deps();
  await applyPlan(plan, pool(), d);
  expect(d.createActivity).not.toHaveBeenCalled();
  expect(d.entries).toEqual([{ activityId: 'a1', startMinutes: 420, durationMinutes: 60 }]);
});

test('new activity is created, registered, then placed', async () => {
  const plan: PlanResponse = { placements: [{ name: 'Standup', priority: 2, start_time: '09:30', duration_minutes: 30 }] };
  const d = deps();
  await applyPlan(plan, pool(), d);
  expect(d.createActivity).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Standup', priority: 2, default_duration_minutes: 30, fixed_start_time: null }),
  );
  expect(d.registerActivity).toHaveBeenCalledTimes(1);
  expect(d.entries).toEqual([{ activityId: 'new-0', startMinutes: 570, durationMinutes: 30 }]);
});

test('unknown id with no name is skipped', async () => {
  const plan: PlanResponse = { placements: [{ activity_id: 'ghost', start_time: '07:00', duration_minutes: 30 }] };
  const d = deps();
  await applyPlan(plan, pool(), d);
  expect(d.entries).toEqual([]);
  expect(d.createActivity).not.toHaveBeenCalled();
});

test('mixed placements: existing then new', async () => {
  const plan: PlanResponse = {
    placements: [
      { activity_id: 'a1', start_time: '06:30', duration_minutes: 60 },
      { name: 'Read', priority: 4, start_time: '21:00', duration_minutes: 30 },
    ],
  };
  const d = deps();
  await applyPlan(plan, pool(), d);
  expect(d.entries).toEqual([
    { activityId: 'a1', startMinutes: 390, durationMinutes: 60 },
    { activityId: 'new-0', startMinutes: 1260, durationMinutes: 30 },
  ]);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/applyPlan.test.ts`
Expected: FAIL — module `./applyPlan` not found.

- [ ] **Step 3: Implement**

Create `src/lib/applyPlan.ts`:

```ts
import type { Activity, NewActivity } from '../types';
import type { PlanResponse } from './planLogic';
import { timeToMinutes } from './time';

const DEFAULT_COLOR = '#4f6df5';

export interface ApplyPlanDeps {
  createActivity: (input: NewActivity) => Promise<Activity>;
  registerActivity: (activity: Activity) => void;
  addEntry: (activityId: string, startMinutes: number, durationMinutes: number) => Promise<void>;
}

export async function applyPlan(plan: PlanResponse, pool: Activity[], deps: ApplyPlanDeps): Promise<void> {
  const known = new Set(pool.map((a) => a.id));
  for (const p of plan.placements) {
    let activityId: string;
    if (p.activity_id && known.has(p.activity_id)) {
      activityId = p.activity_id;
    } else if (p.name) {
      const created = await deps.createActivity({
        name: p.name,
        color: DEFAULT_COLOR,
        priority: (p.priority ?? 3) as Activity['priority'],
        default_duration_minutes: p.duration_minutes,
        fixed_start_time: null,
      });
      deps.registerActivity(created);
      known.add(created.id);
      activityId = created.id;
    } else {
      continue;
    }
    await deps.addEntry(activityId, timeToMinutes(p.start_time), p.duration_minutes);
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/applyPlan.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/applyPlan.ts src/lib/applyPlan.test.ts
git commit -m "feat: add applyPlan mapping from AI plan to activities and entries"
```

---

### Task 6: Edge function `plan-day` (Deno proxy)

**Files:**
- Create: `supabase/functions/plan-day/index.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: request `{ messages: {role,content}[] }` + Supabase JWT; env `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` (+ runtime-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- Produces: `{ content: string }` on success; `{ error: string }` with non-2xx otherwise. No unit tests (Deno runtime) — verified live in Step 4.

- [ ] **Step 1: Implement the function**

Create `supabase/functions/plan-day/index.ts`:

```ts
// Thin authenticated proxy to an OpenAI-compatible chat API (NVIDIA NIM by default).
// Holds the AI key; contains no scheduling logic. All logic lives in src/lib (tested).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: 'unauthorized' }, 401);

    const { messages } = await req.json();
    if (!Array.isArray(messages)) return json({ error: 'messages array required' }, 400);

    const res = await fetch(`${Deno.env.get('AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: Deno.env.get('AI_MODEL'),
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) return json({ error: `ai upstream ${res.status}: ${await res.text()}` }, 502);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return json({ content }, 200);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
```

- [ ] **Step 2: Document setup in README**

Add a section to `README.md` under Setup (after the existing steps):

```markdown
## AI planner (edge function)

The Autoplan and onboarding features call a Supabase Edge Function that proxies an OpenAI-compatible model (NVIDIA NIM by default). The API key lives only in Supabase secrets — never in the repo or the client.

1. Deploy the function:
   ```
   npx supabase functions deploy plan-day
   ```
2. Set secrets in the Supabase dashboard → Settings → Edge Functions → Secrets:
   - `AI_API_KEY` — your NVIDIA NIM key (`nvapi-...`) from build.nvidia.com
   - `AI_BASE_URL` — `https://integrate.api.nvidia.com/v1`
   - `AI_MODEL` — `meta/llama-3.3-70b-instruct`
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the runtime automatically.
3. For local function dev, put the same values in `supabase/functions/.env` (gitignored) and run `npx supabase functions serve plan-day`.

To use a different provider later, change only the three `AI_*` values — no code change.
```

- [ ] **Step 3: Deploy**

Run: `npx supabase functions deploy plan-day`
Expected: deploy succeeds. (If the project is not linked, run `npx supabase link` first. If no key is set yet, deploy still succeeds; live calls will fail until secrets are added — that is expected.)

- [ ] **Step 4: Live verify (requires AI_API_KEY set)**

From the app after signing in, click "✨ Autoplan" (built in Task 7) or use the dashboard function tester with a body like:

```json
{ "messages": [ { "role": "user", "content": "Reply with the text OK" } ] }
```

Expected: `200` with `{ "content": "OK" }` (or similar). A `401` means the JWT was missing; a `502` means the AI key/URL is wrong.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/plan-day/index.ts README.md
git commit -m "feat: add plan-day edge function proxy and setup docs"
```

---

### Task 7: Autoplan button

**Files:**
- Create: `src/components/AutoplanButton.tsx`
- Test: `src/components/AutoplanButton.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `requestPlan` (Task 3), `applyPlan` (Task 5), `useDayStore` (`registerActivity`, `addEntry`, `activities`, `date`), `api.createActivity`, `useToastStore`.
- Produces: `<AutoplanButton nowMinutes={number} />` — runs a plan and applies it, showing busy state and toasts.

- [ ] **Step 1: Write the failing test**

Create `src/components/AutoplanButton.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../api', () => ({ createActivity: vi.fn() }));
const requestPlan = vi.fn();
vi.mock('../lib/aiClient', () => ({ requestPlan }));
const applyPlan = vi.fn();
vi.mock('../lib/applyPlan', () => ({ applyPlan }));

vi.mock('../store/day', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    date: '2026-07-06',
    activities: [{ id: 'a1', user_id: 'u', name: 'Gym', color: '#fff', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false }],
    addEntry: vi.fn(),
    registerActivity: vi.fn(),
  }));
  return { useDayStore: store };
});

const push = vi.fn();
vi.mock('../store/toast', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({ push }));
  return { useToastStore: store };
});

import { AutoplanButton } from './AutoplanButton';

beforeEach(() => vi.clearAllMocks());

test('clicking runs requestPlan then applyPlan', async () => {
  requestPlan.mockResolvedValue({ placements: [] });
  applyPlan.mockResolvedValue(undefined);
  render(<AutoplanButton nowMinutes={480} />);
  fireEvent.click(screen.getByRole('button', { name: /autoplan/i }));
  await waitFor(() => expect(applyPlan).toHaveBeenCalledTimes(1));
  expect(requestPlan).toHaveBeenCalledWith('plan', expect.objectContaining({ date: '2026-07-06', nowMinutes: 480 }));
});

test('toasts on failure', async () => {
  requestPlan.mockRejectedValue(new Error('nope'));
  render(<AutoplanButton nowMinutes={480} />);
  fireEvent.click(screen.getByRole('button', { name: /autoplan/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/nope/)));
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/AutoplanButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/AutoplanButton.tsx`:

```tsx
import { useState } from 'react';
import * as api from '../api';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import { requestPlan } from '../lib/aiClient';
import { applyPlan } from '../lib/applyPlan';

export function AutoplanButton({ nowMinutes }: { nowMinutes: number }) {
  const date = useDayStore((s) => s.date);
  const activities = useDayStore((s) => s.activities);
  const addEntry = useDayStore((s) => s.addEntry);
  const registerActivity = useDayStore((s) => s.registerActivity);
  const push = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const plan = await requestPlan('plan', {
        pool: activities.map((a) => ({
          id: a.id, name: a.name, priority: a.priority,
          default_duration_minutes: a.default_duration_minutes, fixed_start_time: a.fixed_start_time,
        })),
        date,
        nowMinutes,
      });
      await applyPlan(plan, activities, { createActivity: api.createActivity, registerActivity, addEntry });
      push('Day planned.');
    } catch (err) {
      push(`Autoplan failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="autoplan" onClick={run} disabled={busy}>
      {busy ? 'Planning…' : '✨ Autoplan'}
    </button>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/AutoplanButton.test.tsx`
Expected: 2 PASS.

- [ ] **Step 5: Wire into App**

In `src/App.tsx`, add the import near the other component imports:

```tsx
import { AutoplanButton } from './components/AutoplanButton';
```

In the `right-pane` aside, add the button above `SuggestionsPanel`:

```tsx
          <aside className="right-pane">
            <AutoplanButton nowMinutes={nowMinutes} />
            <SuggestionsPanel nowMinutes={nowMinutes} />
            <PoolPanel />
          </aside>
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/AutoplanButton.tsx src/components/AutoplanButton.test.tsx src/App.tsx
git commit -m "feat: add Autoplan button and wire into day view"
```

---

### Task 8: Onboarding modal

**Files:**
- Create: `src/components/Onboarding.tsx`
- Test: `src/components/Onboarding.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `requestPlan` (Task 3), `applyPlan` (Task 5), store + toast, `api.createActivity`.
- Produces: `<Onboarding nowMinutes={number} onDone={() => void} />` — free-text setup that drafts a day; `shouldOnboard(): boolean` gate backed by `localStorage`. Skipping and completing both set the flag.

- [ ] **Step 1: Write the failing test**

Create `src/components/Onboarding.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../api', () => ({ createActivity: vi.fn() }));
const requestPlan = vi.fn();
vi.mock('../lib/aiClient', () => ({ requestPlan }));
const applyPlan = vi.fn();
vi.mock('../lib/applyPlan', () => ({ applyPlan }));

vi.mock('../store/day', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    date: '2026-07-06',
    activities: [],
    addEntry: vi.fn(),
    registerActivity: vi.fn(),
  }));
  return { useDayStore: store };
});
vi.mock('../store/toast', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({ push: vi.fn() }));
  return { useToastStore: store };
});

import { Onboarding, shouldOnboard } from './Onboarding';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test('shouldOnboard is true until the flag is set', () => {
  expect(shouldOnboard()).toBe(true);
  localStorage.setItem('yourday.onboarded', '1');
  expect(shouldOnboard()).toBe(false);
});

test('submitting drafts a day, sets the flag, and calls onDone', async () => {
  requestPlan.mockResolvedValue({ placements: [] });
  applyPlan.mockResolvedValue(undefined);
  const onDone = vi.fn();
  render(<Onboarding nowMinutes={480} onDone={onDone} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I work 9 to 5' } });
  fireEvent.click(screen.getByRole('button', { name: /create my day/i }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(requestPlan).toHaveBeenCalledWith('onboard', expect.objectContaining({ text: 'I work 9 to 5' }));
  expect(localStorage.getItem('yourday.onboarded')).toBe('1');
});

test('skip sets the flag and calls onDone without planning', () => {
  const onDone = vi.fn();
  render(<Onboarding nowMinutes={480} onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: /skip/i }));
  expect(onDone).toHaveBeenCalled();
  expect(requestPlan).not.toHaveBeenCalled();
  expect(localStorage.getItem('yourday.onboarded')).toBe('1');
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/Onboarding.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/Onboarding.tsx`:

```tsx
import { useState } from 'react';
import * as api from '../api';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import { requestPlan } from '../lib/aiClient';
import { applyPlan } from '../lib/applyPlan';

const FLAG = 'yourday.onboarded';

export function shouldOnboard(): boolean {
  return localStorage.getItem(FLAG) !== '1';
}

export function Onboarding({ nowMinutes, onDone }: { nowMinutes: number; onDone: () => void }) {
  const date = useDayStore((s) => s.date);
  const activities = useDayStore((s) => s.activities);
  const addEntry = useDayStore((s) => s.addEntry);
  const registerActivity = useDayStore((s) => s.registerActivity);
  const push = useToastStore((s) => s.push);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  function finish() {
    localStorage.setItem(FLAG, '1');
    onDone();
  }

  async function submit() {
    setBusy(true);
    try {
      const plan = await requestPlan('onboard', {
        pool: activities.map((a) => ({
          id: a.id, name: a.name, priority: a.priority,
          default_duration_minutes: a.default_duration_minutes, fixed_start_time: a.fixed_start_time,
        })),
        date,
        nowMinutes,
        text,
      });
      await applyPlan(plan, activities, { createActivity: api.createActivity, registerActivity, addEntry });
      finish();
    } catch (err) {
      push(`Setup failed: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>Set up your day</h2>
        <p>Describe a typical day — work hours, workouts, errands. We'll draft a schedule you can tweak.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I work 9–5, gym most mornings, cook dinner around 7…"
          rows={5}
        />
        <div className="onboarding-actions">
          <button onClick={finish} disabled={busy}>Skip</button>
          <button onClick={submit} disabled={busy || !text.trim()}>
            {busy ? 'Planning…' : 'Create my day'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/Onboarding.test.tsx`
Expected: 3 PASS.

- [ ] **Step 5: Wire into App**

In `src/App.tsx`, add imports:

```tsx
import { Onboarding, shouldOnboard } from './components/Onboarding';
```

In the `Planner` component, add state and an effect (after the existing `useState`/`useEffect` hooks):

```tsx
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (shouldOnboard()) setOnboarding(true);
  }, []);
```

Render the modal inside the shell, right after `<TopBar />`:

```tsx
        {onboarding && <Onboarding nowMinutes={nowMinutes} onDone={() => setOnboarding(false)} />}
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test`
Expected: all PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Onboarding.tsx src/components/Onboarding.test.tsx src/App.tsx
git commit -m "feat: add first-run AI onboarding modal"
```

---

### Task 9: Styles + final verification

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: components from Tasks 7–8.
- Produces: minimal styling for the Autoplan button and onboarding overlay; a green full build.

- [ ] **Step 1: Add styles**

Append to `src/index.css`:

```css
.autoplan {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.autoplan:disabled {
  opacity: 0.6;
  cursor: default;
}

.onboarding-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  padding: 1rem;
}
.onboarding-card {
  background: var(--card-bg, #fff);
  color: inherit;
  max-width: 32rem;
  width: 100%;
  padding: 1.5rem;
  border-radius: 0.75rem;
}
.onboarding-card textarea {
  width: 100%;
  margin: 0.75rem 0;
  padding: 0.5rem;
  font: inherit;
}
.onboarding-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
```

- [ ] **Step 2: Full verification**

Run: `npm test`
Expected: all PASS.
Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke (optional, needs deployed function + key)**

Run: `npm run dev`, sign in as a fresh user. Expected: 5 default activities in the pool; onboarding modal appears on first load; "✨ Autoplan" fills the timeline. Errors toast without corrupting the timeline.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: style Autoplan button and onboarding modal"
```

---

## Notes / deferred

- **Onboarding trigger** uses a `localStorage` flag (`yourday.onboarded`). Simple; re-prompts on a new device/browser (user can skip). A per-user DB flag is a future improvement if cross-device suppression matters.
- **Autoplan on a non-empty day** appends entries (does not clear existing ones). Users delete what they don't want. A "clear + replan" option is future scope.
- **Retry** lives client-side (in `aiClient`), a refinement over the spec's server-side retry — keeps all logic testable and the edge function a pure proxy. Security is unchanged: the function still verifies the JWT before spending the API key.
