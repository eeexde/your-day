import { readableTextColor } from './color';

test('dark backgrounds get white text', () => {
  expect(readableTextColor('#221c14')).toBe('#ffffff'); // near-black
  expect(readableTextColor('#6366f1')).toBe('#ffffff'); // indigo
  expect(readableTextColor('#0ea5e9')).toBe('#ffffff'); // sky blue
});

test('light backgrounds get dark text', () => {
  expect(readableTextColor('#ffffff')).toBe('#221c14'); // white
  expect(readableTextColor('#f59e0b')).toBe('#221c14'); // amber
  expect(readableTextColor('#fde68a')).toBe('#221c14'); // pale yellow
});

test('accepts 3-digit hex and a missing leading hash', () => {
  expect(readableTextColor('fff')).toBe('#221c14');
  expect(readableTextColor('#000')).toBe('#ffffff');
});

test('falls back to white on an unparseable color', () => {
  expect(readableTextColor('not-a-color')).toBe('#ffffff');
  expect(readableTextColor('')).toBe('#ffffff');
});
