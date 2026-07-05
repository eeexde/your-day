import { resolveDrop } from './dnd';
import type { Activity, PlanEntry } from '../types';

const flexible: Activity = {
  id: 'a1', user_id: 'u', name: 'Gym', color: '#f00', priority: 2,
  default_duration_minutes: 60, fixed_start_time: null, is_archived: false,
};
const fixed: Activity = { ...flexible, id: 'a2', name: 'Meeting', fixed_start_time: '14:00:00' };
const entryOf = (a: Activity, start: string): PlanEntry => ({
  id: 'e1', day_plan_id: 'd', activity_id: a.id, start_time: start, duration_minutes: 60, done: false,
});

test('pool drop of flexible activity adds at snapped time with default duration', () => {
  expect(resolveDrop('pool', { activity: flexible, dropMinutes: 444 })).toEqual({
    action: 'add', activityId: 'a1', startMinutes: 450, durationMinutes: 60,
  });
});

test('pool drop of fixed activity at its hour adds at fixed time', () => {
  expect(resolveDrop('pool', { activity: fixed, dropMinutes: 14 * 60 + 10 })).toEqual({
    action: 'add', activityId: 'a2', startMinutes: 14 * 60, durationMinutes: 60,
  });
});

test('pool drop of fixed activity elsewhere is rejected', () => {
  expect(resolveDrop('pool', { activity: fixed, dropMinutes: 9 * 60 })).toEqual({
    action: 'rejected', reason: 'fixed-time',
  });
});

test('entry drag of flexible entry moves to snapped time', () => {
  expect(resolveDrop('entry', { activity: flexible, entry: entryOf(flexible, '07:00:00'), dropMinutes: 605 })).toEqual({
    action: 'move', entryId: 'e1', startMinutes: 600,
  });
});

test('entry drag of fixed entry away from fixed time is rejected', () => {
  expect(resolveDrop('entry', { activity: fixed, entry: entryOf(fixed, '14:00:00'), dropMinutes: 9 * 60 })).toEqual({
    action: 'rejected', reason: 'fixed-time',
  });
});
