import { render, screen, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

vi.mock('../api', () => ({}));

vi.mock('../store/day', async () => {
  const { create } = await import('zustand');
  const addEntry = vi.fn();
  const dismiss = vi.fn();
  const store = create(() => ({
    activities: [
      { id: 'a1', user_id: 'u', name: 'Gym', color: '#f00', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false },
    ],
    entries: [],
    dismissedIds: [],
    addEntry,
    dismiss,
  }));
  return {
    useDayStore: store,
    __addEntry: addEntry,
    __dismiss: dismiss,
  };
});

import { SuggestionsPanel } from './SuggestionsPanel';
import * as dayStore from '../store/day';

const addEntry = (dayStore as any).__addEntry;
const dismiss = (dayStore as any).__dismiss;

beforeEach(() => {
  addEntry.mockClear();
  dismiss.mockClear();
});

test('shows suggestion with proposed slot', () => {
  render(<SuggestionsPanel nowMinutes={8 * 60} />);
  expect(screen.getByText('Gym')).toBeInTheDocument();
  expect(screen.getByText('8:00–9:00')).toBeInTheDocument();
});

test('accept places entry at proposed slot', () => {
  render(<SuggestionsPanel nowMinutes={8 * 60} />);
  fireEvent.click(screen.getByLabelText('Accept Gym'));
  expect(addEntry).toHaveBeenCalledWith('a1', 480, 60);
});

test('dismiss hides activity for today', () => {
  render(<SuggestionsPanel nowMinutes={8 * 60} />);
  fireEvent.click(screen.getByLabelText('Dismiss Gym'));
  expect(dismiss).toHaveBeenCalledWith('a1');
});
