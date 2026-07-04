import { recommend } from './recommend';
import type { Activity, PlanEntry } from '../types';

let seq = 0;
function activity(over: Partial<Activity>): Activity {
  seq += 1;
  return {
    id: `act-${seq}`, user_id: 'u', name: `A${seq}`, color: '#fff', priority: 3,
    default_duration_minutes: 60, fixed_start_time: null, is_archived: false, ...over,
  };
}
function entry(activity_id: string, start: string, duration: number): PlanEntry {
  seq += 1;
  return { id: `e-${seq}`, day_plan_id: 'd', activity_id, start_time: start, duration_minutes: duration, done: false };
}
const none = new Set<string>();

test('hard requirements come first ordered by time, at their fixed time', () => {
  const meeting = activity({ name: 'Meeting', fixed_start_time: '14:00:00', priority: 5 });
  const school = activity({ name: 'School run', fixed_start_time: '15:30:00', priority: 5 });
  const gym = activity({ name: 'Gym', priority: 1 });
  const out = recommend([school, gym, meeting], [], none, 8 * 60);
  expect(out.map((s) => s.activity.name)).toEqual(['Meeting', 'School run', 'Gym']);
  expect(out[0].proposedStartMinutes).toBe(14 * 60);
  expect(out[1].proposedStartMinutes).toBe(15 * 60 + 30);
});

test('past-fixed-time hard requirements are excluded', () => {
  const missed = activity({ fixed_start_time: '07:00:00' });
  const out = recommend([missed], [], none, 9 * 60);
  expect(out).toHaveLength(0);
});

test('flexible sorted by priority ascending, ties by name', () => {
  const b = activity({ name: 'Bravo', priority: 2 });
  const a = activity({ name: 'Alpha', priority: 2 });
  const top = activity({ name: 'Top', priority: 1 });
  const out = recommend([b, a, top], [], none, 8 * 60);
  expect(out.map((s) => s.activity.name)).toEqual(['Top', 'Alpha', 'Bravo']);
});

test('placed, archived, and dismissed activities are excluded', () => {
  const placed = activity({});
  const archived = activity({ is_archived: true });
  const dismissed = activity({});
  const ok = activity({});
  const out = recommend(
    [placed, archived, dismissed, ok],
    [entry(placed.id, '09:00', 60)],
    new Set([dismissed.id]),
    8 * 60,
  );
  expect(out.map((s) => s.activity.id)).toEqual([ok.id]);
});

test('flexible proposed in first zero-concurrency gap after now', () => {
  const busyAct = activity({});
  const gym = activity({ name: 'Gym', default_duration_minutes: 60 });
  const entries = [entry(busyAct.id, '08:00', 120)]; // 8:00–10:00 busy
  const out = recommend([gym], entries, none, 8 * 60);
  expect(out[0].proposedStartMinutes).toBe(10 * 60);
});

test('now is snapped up to next slot boundary', () => {
  const gym = activity({});
  const out = recommend([gym], [], none, 8 * 60 + 10); // 8:10 → 8:30
  expect(out[0].proposedStartMinutes).toBe(8 * 60 + 30);
});

test('falls back to minimal-concurrency window when day is full', () => {
  const a1 = activity({});
  const a2 = activity({});
  const task = activity({ name: 'Task', default_duration_minutes: 60 });
  // 22:00–24:00 single-covered, everything before double-covered
  const entries = [
    entry(a1.id, '08:00', 14 * 60),
    entry(a2.id, '08:00', 14 * 60),
    entry(a1.id, '22:00', 120),
  ];
  const out = recommend([task], entries, none, 8 * 60);
  expect(out[0].proposedStartMinutes).toBe(22 * 60);
});

test('caps at 5 suggestions', () => {
  const pool = Array.from({ length: 8 }, () => activity({}));
  const out = recommend(pool, [], none, 8 * 60);
  expect(out).toHaveLength(5);
});

test('activity that cannot fit before midnight is excluded', () => {
  const long = activity({ default_duration_minutes: 120 });
  const out = recommend([long], [], none, 23 * 60);
  expect(out).toHaveLength(0);
});
