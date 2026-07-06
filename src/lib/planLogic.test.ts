import { buildPlanPrompt, validatePlanResponse } from './planLogic';
import type { PlanInput } from './planLogic';

const baseInput: PlanInput = {
  pool: [
    { id: 'a1', name: 'Gym', priority: 1, default_duration_minutes: 60, fixed_start_time: null },
    { id: 'a2', name: 'Meeting', priority: 3, default_duration_minutes: 30, fixed_start_time: '14:00:00' },
  ],
  date: '2026-07-06',
  nowMinutes: 480,
};

test('buildPlanPrompt embeds rules, pool, and JSON shape', () => {
  const { system, user } = buildPlanPrompt('plan', baseInput);
  expect(system).toMatch(/fixed_start_time/);
  expect(system).toMatch(/multiples of 30/i);
  expect(system).toMatch(/"placements"/);
  expect(user).toMatch(/"id":"a1"/);
  expect(user).toMatch(/2026-07-06/);
});

test('onboard mode includes the user free text', () => {
  const { user } = buildPlanPrompt('onboard', { ...baseInput, text: 'I work 9 to 5' });
  expect(user).toMatch(/I work 9 to 5/);
});

test('validatePlanResponse accepts a valid response', () => {
  const out = validatePlanResponse({
    placements: [
      { activity_id: 'a1', start_time: '07:00', duration_minutes: 60 },
      { name: 'Standup', priority: 2, start_time: '09:30', duration_minutes: 30 },
    ],
  });
  expect(out.placements).toHaveLength(2);
  expect(out.placements[0].activity_id).toBe('a1');
  expect(out.placements[1].name).toBe('Standup');
});

test('validatePlanResponse rejects a bad start_time', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', start_time: '07:15', duration_minutes: 60 }] })).toThrow();
});

test('validatePlanResponse rejects a non-30 duration', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', start_time: '07:00', duration_minutes: 45 }] })).toThrow();
});

test('validatePlanResponse rejects both id and name', () => {
  expect(() => validatePlanResponse({ placements: [{ activity_id: 'a1', name: 'X', priority: 2, start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects neither id nor name', () => {
  expect(() => validatePlanResponse({ placements: [{ start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects an out-of-range priority', () => {
  expect(() => validatePlanResponse({ placements: [{ name: 'X', priority: 9, start_time: '07:00', duration_minutes: 30 }] })).toThrow();
});

test('validatePlanResponse rejects a missing placements array', () => {
  expect(() => validatePlanResponse({})).toThrow();
});

test('validatePlanResponse rejects more than 20 placements', () => {
  const many = Array.from({ length: 21 }, () => ({ activity_id: 'a1', start_time: '07:00', duration_minutes: 30 }));
  expect(() => validatePlanResponse({ placements: many })).toThrow();
});
