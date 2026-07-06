import { beforeEach, expect, test, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { functions: { invoke } } }));

import { requestPlan } from './aiClient';
import type { PlanInput } from './planLogic';

const input: PlanInput = {
  pool: [{ id: 'a1', name: 'Gym', priority: 1, default_duration_minutes: 60, fixed_start_time: null }],
  date: '2026-07-06',
  nowMinutes: 480,
};

beforeEach(() => vi.clearAllMocks());

test('returns a parsed plan on valid content', async () => {
  invoke.mockResolvedValue({
    data: { content: '{"placements":[{"activity_id":"a1","start_time":"07:00","duration_minutes":60}]}' },
    error: null,
  });
  const plan = await requestPlan('plan', input);
  expect(plan.placements[0].activity_id).toBe('a1');
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('strips accidental code fences before parsing', async () => {
  invoke.mockResolvedValue({
    data: { content: '```json\n{"placements":[{"activity_id":"a1","start_time":"07:00","duration_minutes":60}]}\n```' },
    error: null,
  });
  const plan = await requestPlan('plan', input);
  expect(plan.placements).toHaveLength(1);
});

test('retries once with a correction when the first reply is invalid', async () => {
  invoke
    .mockResolvedValueOnce({ data: { content: 'not json at all' }, error: null })
    .mockResolvedValueOnce({
      data: { content: '{"placements":[{"activity_id":"a1","start_time":"08:00","duration_minutes":30}]}' },
      error: null,
    });
  const plan = await requestPlan('plan', input);
  expect(plan.placements[0].start_time).toBe('08:00');
  expect(invoke).toHaveBeenCalledTimes(2);
  const secondBody = invoke.mock.calls[1][1].body;
  expect(JSON.stringify(secondBody)).toMatch(/invalid/i);
});

test('throws when both attempts are invalid', async () => {
  invoke.mockResolvedValue({ data: { content: 'garbage' }, error: null });
  await expect(requestPlan('plan', input)).rejects.toThrow();
  expect(invoke).toHaveBeenCalledTimes(2);
});

test('throws when the function returns an error', async () => {
  invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
  await expect(requestPlan('plan', input)).rejects.toThrow(/boom/);
});
