import { vi, test, expect } from 'vitest';
import { computeReminders, scheduleReminders } from './reminders';
import type { Activity, PlanEntry } from '../types';

const fixedAct: Activity = {
  id: 'a1', user_id: 'u', name: 'Meeting', color: '#fff', priority: 1,
  default_duration_minutes: 60, fixed_start_time: '14:00:00', is_archived: false,
};
const flexAct: Activity = { ...fixedAct, id: 'a2', name: 'Gym', fixed_start_time: null };
const ent = (activity_id: string, start: string): PlanEntry => ({
  id: `e-${activity_id}`, day_plan_id: 'd', activity_id, start_time: start, duration_minutes: 60, done: false,
});

test('reminds 10 min before hard-requirement entries only', () => {
  const out = computeReminders([ent('a1', '14:00:00'), ent('a2', '15:00:00')], [fixedAct, flexAct], 13 * 60);
  expect(out).toHaveLength(1);
  expect(out[0].title).toBe('Meeting at 14:00');
  expect(out[0].fireInMs).toBe(50 * 60 * 1000); // 13:00 → 13:50
});

test('skips entries starting within 10 minutes or in the past', () => {
  const out = computeReminders([ent('a1', '14:00:00')], [fixedAct], 13 * 60 + 55);
  expect(out).toHaveLength(0);
});

test('skips entries already marked done', () => {
  const doneEntry = { ...ent('a1', '14:00:00'), done: true };
  const out = computeReminders([doneEntry], [fixedAct], 13 * 60);
  expect(out).toHaveLength(0);
});

test('scheduleReminders fires notify and cancel stops pending', () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const cancel = scheduleReminders([{ title: 'A', fireInMs: 1000 }, { title: 'B', fireInMs: 5000 }], notify);
  vi.advanceTimersByTime(1500);
  expect(notify).toHaveBeenCalledWith('A');
  cancel();
  vi.advanceTimersByTime(10000);
  expect(notify).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
