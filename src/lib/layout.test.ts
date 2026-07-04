import { layoutColumns } from './layout';
import type { PlanEntry } from '../types';

function entry(id: string, start: string, duration: number): PlanEntry {
  return { id, day_plan_id: 'd', activity_id: `a-${id}`, start_time: start, duration_minutes: duration, done: false };
}

test('non-overlapping entries each get full width', () => {
  const out = layoutColumns([entry('1', '07:00', 60), entry('2', '09:00', 60)]);
  expect(out).toHaveLength(2);
  for (const l of out) {
    expect(l.col).toBe(0);
    expect(l.colCount).toBe(1);
  }
});

test('two overlapping entries share width side by side', () => {
  const out = layoutColumns([entry('1', '07:00', 120), entry('2', '08:00', 60)]);
  const one = out.find((l) => l.entry.id === '1')!;
  const two = out.find((l) => l.entry.id === '2')!;
  expect(one.colCount).toBe(2);
  expect(two.colCount).toBe(2);
  expect(one.col).not.toBe(two.col);
});

test('back-to-back entries do not overlap', () => {
  const out = layoutColumns([entry('1', '07:00', 60), entry('2', '08:00', 60)]);
  for (const l of out) expect(l.colCount).toBe(1);
});

test('three-way overlap gets three columns', () => {
  const out = layoutColumns([entry('1', '07:00', 180), entry('2', '07:30', 60), entry('3', '08:00', 90)]);
  const cols = out.map((l) => l.col).sort();
  expect(out.every((l) => l.colCount === 3)).toBe(true);
  expect(cols).toEqual([0, 1, 2]);
});
