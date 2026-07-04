export const SNAP_MINUTES = 30;

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function snapMinutes(m: number): number {
  return Math.round(m / SNAP_MINUTES) * SNAP_MINUTES;
}

function human(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min === 0 ? `${h}:00` : `${h}:${min}`;
}

export function formatRange(startMinutes: number, durationMinutes: number): string {
  return `${human(startMinutes)}–${human(startMinutes + durationMinutes)}`;
}
