import { render, screen, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

vi.mock('../api', () => ({}));

const { toggleDone, removeEntry } = vi.hoisted(() => ({
  toggleDone: vi.fn(),
  removeEntry: vi.fn(),
}));

vi.mock(
  '../store/day',
  async () => {
    const { create } = await import('zustand');
    const store = create(() => ({
      activities: [
        { id: 'a1', user_id: 'u', name: 'Gym', color: '#f00', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
      ],
      entries: [
        { id: 'e1', day_plan_id: 'd', activity_id: 'a1', start_time: '07:00:00', duration_minutes: 60, done: false },
      ],
      toggleDone,
      removeEntry,
      moveEntry: vi.fn(),
      resizeEntry: vi.fn(),
    }));
    return { useDayStore: store };
  }
);

import { Timeline } from './Timeline';

beforeEach(() => {
  vi.clearAllMocks();
  // Mock scrollTo on div elements
  Element.prototype.scrollTo = vi.fn();
});

test('renders entry block with name and range', () => {
  render(<Timeline nowMinutes={480} />);
  expect(screen.getByText('Gym')).toBeInTheDocument();
  expect(screen.getByText('7:00–8:00')).toBeInTheDocument();
});

test('renders hour labels and now line', () => {
  render(<Timeline nowMinutes={480} />);
  expect(screen.getByText('07:00')).toBeInTheDocument();
  expect(screen.getByTestId('now-line')).toBeInTheDocument();
});

test('done checkbox calls toggleDone', () => {
  render(<Timeline nowMinutes={480} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(toggleDone).toHaveBeenCalledWith('e1');
});

test('delete button calls removeEntry', () => {
  render(<Timeline nowMinutes={480} />);
  fireEvent.click(screen.getByLabelText('Delete entry'));
  expect(removeEntry).toHaveBeenCalledWith('e1');
});
