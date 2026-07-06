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
