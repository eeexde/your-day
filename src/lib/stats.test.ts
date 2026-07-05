import { dayStats } from './stats';
import type { Activity, PlanEntry } from '../types';

const act = (id: string, priority: 1 | 2 | 3 | 4 | 5): Activity => ({
  id, user_id: 'u', name: id, color: '#fff', priority,
  default_duration_minutes: 60, fixed_start_time: null, is_archived: false,
});
const ent = (activity_id: string, duration: number, done: boolean): PlanEntry => ({
  id: `e-${activity_id}-${duration}`, day_plan_id: 'd', activity_id,
  start_time: '08:00:00', duration_minutes: duration, done,
});

test('computes planned, done, and p1 coverage', () => {
  const activities = [act('a', 1), act('b', 1), act('c', 3)];
  const entries = [ent('a', 60, true), ent('c', 90, false)];
  expect(dayStats(entries, activities)).toEqual({
    plannedMinutes: 150, doneMinutes: 60, p1Covered: 1, p1Total: 2,
  });
});

test('empty day', () => {
  expect(dayStats([], [act('a', 1)])).toEqual({ plannedMinutes: 0, doneMinutes: 0, p1Covered: 0, p1Total: 1 });
});
