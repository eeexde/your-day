import { vi, test, expect } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

import { shiftDate } from './TopBar';

test('shiftDate shifts backward by N days', () => {
  expect(shiftDate('2024-03-15', -1)).toBe('2024-03-14');
});

test('shiftDate handles month boundary (leap year)', () => {
  expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
});

test('shiftDate handles year boundary', () => {
  expect(shiftDate('2024-01-01', -1)).toBe('2023-12-31');
});
