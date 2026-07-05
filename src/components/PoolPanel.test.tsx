import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, test, expect, beforeEach } from 'vitest';
import type { Activity } from '../types';

const addEntry = vi.fn();
const addActivity = vi.fn();
const editActivity = vi.fn();
const archive = vi.fn();

const fixedActivity: Activity = {
  id: 'a-fixed', user_id: 'u1', name: 'Standup', color: '#d9482b',
  priority: 1, default_duration_minutes: 30, fixed_start_time: '14:00:00', is_archived: false,
};
const flexActivity: Activity = {
  id: 'a-flex', user_id: 'u1', name: 'Reading', color: '#4f6df5',
  priority: 3, default_duration_minutes: 60, fixed_start_time: null, is_archived: false,
};

const state = {
  activities: [fixedActivity, flexActivity],
  addEntry, addActivity, editActivity, archive,
};

vi.mock('../store/day', () => ({
  useDayStore: (selector: (s: unknown) => unknown) => selector(state),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

import { PoolPanel } from './PoolPanel';

test('place button schedules fixed-time activity at its fixed hour', async () => {
  const user = userEvent.setup();
  render(<PoolPanel />);
  await user.click(screen.getByRole('button', { name: 'Place Standup' }));
  expect(addEntry).toHaveBeenCalledWith('a-fixed', 14 * 60, 30);
});

test('place button schedules flexible activity on an upcoming half-hour slot', async () => {
  const user = userEvent.setup();
  render(<PoolPanel />);
  await user.click(screen.getByRole('button', { name: 'Place Reading' }));
  expect(addEntry).toHaveBeenCalledTimes(1);
  const [id, start, duration] = addEntry.mock.calls[0];
  expect(id).toBe('a-flex');
  expect(duration).toBe(60);
  expect(start % 30).toBe(0);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(start).toBeLessThanOrEqual(24 * 60 - 30);
});
