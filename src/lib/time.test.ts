import { timeToMinutes, minutesToTime, snapMinutes, formatRange } from './time';

test('timeToMinutes parses HH:MM and HH:MM:SS', () => {
  expect(timeToMinutes('07:30')).toBe(450);
  expect(timeToMinutes('00:00')).toBe(0);
  expect(timeToMinutes('23:30:00')).toBe(1410);
});

test('minutesToTime formats zero-padded HH:MM', () => {
  expect(minutesToTime(450)).toBe('07:30');
  expect(minutesToTime(0)).toBe('00:00');
  expect(minutesToTime(1410)).toBe('23:30');
});

test('snapMinutes snaps to nearest 30', () => {
  expect(snapMinutes(444)).toBe(450);
  expect(snapMinutes(430)).toBe(420);
  expect(snapMinutes(435)).toBe(450);
  expect(snapMinutes(450)).toBe(450);
});

test('formatRange renders human range', () => {
  expect(formatRange(420, 60)).toBe('7:00–8:00');
  expect(formatRange(450, 90)).toBe('7:30–9:00');
});
