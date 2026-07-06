import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

// vi.mock is hoisted above top-level consts; share handles via vi.hoisted.
const { requestPlan, applyPlan, push } = vi.hoisted(() => ({ requestPlan: vi.fn(), applyPlan: vi.fn(), push: vi.fn() }));

vi.mock('../api', () => ({ createActivity: vi.fn() }));
vi.mock('../lib/aiClient', () => ({ requestPlan }));
vi.mock('../lib/applyPlan', () => ({ applyPlan }));

vi.mock('../store/day', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    date: '2026-07-06',
    activities: [{ id: 'a1', user_id: 'u', name: 'Gym', color: '#fff', priority: 1, default_duration_minutes: 60, fixed_start_time: null, is_archived: false }],
    addEntry: vi.fn(),
    registerActivity: vi.fn(),
  }));
  return { useDayStore: store };
});

vi.mock('../store/toast', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({ push }));
  return { useToastStore: store };
});

import { AutoplanButton } from './AutoplanButton';

beforeEach(() => vi.clearAllMocks());

test('clicking runs requestPlan then applyPlan', async () => {
  requestPlan.mockResolvedValue({ placements: [] });
  applyPlan.mockResolvedValue(undefined);
  render(<AutoplanButton nowMinutes={480} />);
  fireEvent.click(screen.getByRole('button', { name: /autoplan/i }));
  await waitFor(() => expect(applyPlan).toHaveBeenCalledTimes(1));
  expect(requestPlan).toHaveBeenCalledWith('plan', expect.objectContaining({ date: '2026-07-06', nowMinutes: 480 }));
});

test('toasts on failure', async () => {
  requestPlan.mockRejectedValue(new Error('nope'));
  render(<AutoplanButton nowMinutes={480} />);
  fireEvent.click(screen.getByRole('button', { name: /autoplan/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/nope/)));
});
