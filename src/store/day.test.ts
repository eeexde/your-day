import { beforeEach, expect, test, vi } from 'vitest';
import type { Activity, PlanEntry } from '../types';

vi.mock('../api', () => ({
  fetchActivities: vi.fn(async () => []),
  ensureDayPlan: vi.fn(async () => ({ id: 'plan-1', user_id: 'u', date: '2026-07-04' })),
  fetchEntries: vi.fn(async () => []),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  archiveActivity: vi.fn(),
}));

import * as api from '../api';
import { useDayStore } from './day';
import { useToastStore } from './toast';

const mocked = vi.mocked(api);

function seedEntry(): PlanEntry {
  return { id: 'e1', day_plan_id: 'plan-1', activity_id: 'a1', start_time: '09:00:00', duration_minutes: 60, done: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  useDayStore.setState({
    date: '2026-07-04', dayPlanId: 'plan-1', activities: [], entries: [seedEntry()], dismissedIds: [], loading: false,
  });
  useToastStore.setState({ toasts: [] });
});

test('moveEntry applies optimistically then keeps server value', async () => {
  mocked.updateEntry.mockResolvedValue({ ...seedEntry(), start_time: '10:00:00' });
  const p = useDayStore.getState().moveEntry('e1', 600);
  expect(useDayStore.getState().entries[0].start_time).toBe('10:00');
  await p;
  expect(useDayStore.getState().entries[0].start_time).toBe('10:00:00');
  expect(mocked.updateEntry).toHaveBeenCalledWith('e1', { start_time: '10:00' });
});

test('moveEntry rolls back and toasts on API failure', async () => {
  mocked.updateEntry.mockRejectedValue(new Error('network down'));
  await useDayStore.getState().moveEntry('e1', 600);
  expect(useDayStore.getState().entries[0].start_time).toBe('09:00:00');
  expect(useToastStore.getState().toasts).toHaveLength(1);
});

test('addEntry inserts optimistic entry then replaces with server row', async () => {
  const server: PlanEntry = { id: 'server-id', day_plan_id: 'plan-1', activity_id: 'a2', start_time: '11:00:00', duration_minutes: 30, done: false };
  mocked.createEntry.mockResolvedValue(server);
  await useDayStore.getState().addEntry('a2', 660, 30);
  const ids = useDayStore.getState().entries.map((e) => e.id);
  expect(ids).toContain('server-id');
  expect(useDayStore.getState().entries).toHaveLength(2);
});

test('addEntry rolls back on failure', async () => {
  mocked.createEntry.mockRejectedValue(new Error('boom'));
  await useDayStore.getState().addEntry('a2', 660, 30);
  expect(useDayStore.getState().entries).toHaveLength(1);
  expect(useToastStore.getState().toasts).toHaveLength(1);
});

test('removeEntry deletes optimistically and restores on failure', async () => {
  mocked.deleteEntry.mockRejectedValue(new Error('boom'));
  await useDayStore.getState().removeEntry('e1');
  expect(useDayStore.getState().entries).toHaveLength(1);
});

test('toggleDone flips done', async () => {
  mocked.updateEntry.mockResolvedValue({ ...seedEntry(), done: true });
  await useDayStore.getState().toggleDone('e1');
  expect(useDayStore.getState().entries[0].done).toBe(true);
  expect(mocked.updateEntry).toHaveBeenCalledWith('e1', { done: true });
});

test('concurrent mutations: second succeeds survives first failure', async () => {
  const e2: PlanEntry = { id: 'e2', day_plan_id: 'plan-1', activity_id: 'a2', start_time: '10:00:00', duration_minutes: 30, done: false };
  useDayStore.setState({ entries: [seedEntry(), e2] });

  // Control the timing with manually-resolved promises
  // @ts-ignore - assigned in Promise constructor, used later
  let resolveFirst: ((value: PlanEntry) => void) | null = null;
  let rejectFirst: ((err: Error) => void) | null = null;
  const firstPromise = new Promise<PlanEntry>((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });

  let resolveSecond: ((value: PlanEntry) => void) | null = null;
  const secondPromise = new Promise<PlanEntry>((resolve) => {
    resolveSecond = resolve;
  });

  mocked.updateEntry.mockImplementation((id) => {
    if (id === 'e1') return firstPromise;
    if (id === 'e2') return secondPromise;
    return Promise.reject(new Error('unknown id'));
  });

  // Start both mutations concurrently
  const p1 = useDayStore.getState().moveEntry('e1', 600); // will fail
  const p2 = useDayStore.getState().moveEntry('e2', 600); // will succeed

  // After both are optimistically updated
  expect(useDayStore.getState().entries[0].start_time).toBe('10:00'); // optimistic
  expect(useDayStore.getState().entries[1].start_time).toBe('10:00'); // optimistic

  // Resolve second FIRST (succeeds)
  resolveSecond!({ ...e2, start_time: '10:00:00' });
  await p2;
  expect(useDayStore.getState().entries[1].start_time).toBe('10:00:00'); // second persisted

  // Now reject first (after second succeeded)
  rejectFirst!(new Error('network down'));
  await p1;

  // First should be rolled back to original
  expect(useDayStore.getState().entries[0].start_time).toBe('09:00:00');
  // Second should still have its successful update (NOT clobbered)
  expect(useDayStore.getState().entries[1].start_time).toBe('10:00:00');
  expect(useToastStore.getState().toasts).toHaveLength(1);
});

test('dismiss adds id, loadDay resets dismissals', async () => {
  useDayStore.getState().dismiss('a9');
  expect(useDayStore.getState().dismissedIds).toEqual(['a9']);
  await useDayStore.getState().loadDay('2026-07-05');
  expect(useDayStore.getState().dismissedIds).toEqual([]);
  expect(mocked.ensureDayPlan).toHaveBeenCalledWith('2026-07-05');
});

test('addActivity keeps pool sorted by priority then name', async () => {
  const existing: Activity[] = [
    { id: 'a1', user_id: 'u', name: 'Bravo', color: '#000', priority: 2, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
    { id: 'a2', user_id: 'u', name: 'Charlie', color: '#000', priority: 3, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
  ];
  useDayStore.setState({ activities: existing });

  const newHigh: Activity = {
    id: 'a3', user_id: 'u', name: 'Alpha', color: '#000', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false,
  };
  mocked.createActivity.mockResolvedValue(newHigh);

  await useDayStore.getState().addActivity({ name: 'Alpha', color: '#000', priority: 1, default_duration_minutes: 60, fixed_start_time: null });

  const activities = useDayStore.getState().activities;
  expect(activities.map((a) => a.id)).toEqual(['a3', 'a1', 'a2']);
  expect(activities.map((a) => a.priority)).toEqual([1, 2, 3]);
});

test('editActivity keeps pool sorted by priority then name after priority change', async () => {
  const existing: Activity[] = [
    { id: 'a1', user_id: 'u', name: 'Bravo', color: '#000', priority: 2, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
    { id: 'a2', user_id: 'u', name: 'Zulu', color: '#000', priority: 3, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
  ];
  useDayStore.setState({ activities: existing });

  const edited: Activity = {
    id: 'a2', user_id: 'u', name: 'Zulu', color: '#000', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false,
  };
  mocked.updateActivity.mockResolvedValue(edited);

  await useDayStore.getState().editActivity('a2', { priority: 1 });

  const activities = useDayStore.getState().activities;
  expect(activities.map((a) => a.id)).toEqual(['a2', 'a1']);
  expect(activities.map((a) => a.priority)).toEqual([1, 2]);
});
