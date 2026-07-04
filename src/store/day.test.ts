import { beforeEach, expect, test, vi } from 'vitest';
import type { PlanEntry } from '../types';

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

test('dismiss adds id, loadDay resets dismissals', async () => {
  useDayStore.getState().dismiss('a9');
  expect(useDayStore.getState().dismissedIds).toEqual(['a9']);
  await useDayStore.getState().loadDay('2026-07-05');
  expect(useDayStore.getState().dismissedIds).toEqual([]);
  expect(mocked.ensureDayPlan).toHaveBeenCalledWith('2026-07-05');
});
