import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

// vi.mock is hoisted above top-level consts; share handles via vi.hoisted.
const { requestPlan, applyPlan } = vi.hoisted(() => ({ requestPlan: vi.fn(), applyPlan: vi.fn() }));

vi.mock('../api', () => ({ createActivity: vi.fn() }));
vi.mock('../lib/aiClient', () => ({ requestPlan }));
vi.mock('../lib/applyPlan', () => ({ applyPlan }));

vi.mock('../store/day', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    date: '2026-07-06',
    activities: [],
    addEntry: vi.fn(),
    registerActivity: vi.fn(),
  }));
  return { useDayStore: store };
});
vi.mock('../store/toast', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({ push: vi.fn() }));
  return { useToastStore: store };
});

import { Onboarding, shouldOnboard } from './Onboarding';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test('shouldOnboard is true until the flag is set', () => {
  expect(shouldOnboard()).toBe(true);
  localStorage.setItem('yourday.onboarded', '1');
  expect(shouldOnboard()).toBe(false);
});

test('submitting drafts a day, sets the flag, and calls onDone', async () => {
  requestPlan.mockResolvedValue({ placements: [] });
  applyPlan.mockResolvedValue(undefined);
  const onDone = vi.fn();
  render(<Onboarding nowMinutes={480} onDone={onDone} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I work 9 to 5' } });
  fireEvent.click(screen.getByRole('button', { name: /create my day/i }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(requestPlan).toHaveBeenCalledWith('onboard', expect.objectContaining({ text: 'I work 9 to 5' }));
  expect(localStorage.getItem('yourday.onboarded')).toBe('1');
});

test('skip sets the flag and calls onDone without planning', () => {
  const onDone = vi.fn();
  render(<Onboarding nowMinutes={480} onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: /skip/i }));
  expect(onDone).toHaveBeenCalled();
  expect(requestPlan).not.toHaveBeenCalled();
  expect(localStorage.getItem('yourday.onboarded')).toBe('1');
});
