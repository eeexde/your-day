import type { Activity, PlanEntry } from '../types';
import { SNAP_MINUTES, timeToMinutes } from './time';

export interface Suggestion {
  activity: Activity;
  proposedStartMinutes: number;
}

const DAY_END = 24 * 60;
const MAX_SUGGESTIONS = 5;

function maxConcurrency(entries: PlanEntry[], start: number, end: number): number {
  let max = 0;
  for (let t = start; t < end; t += SNAP_MINUTES) {
    let c = 0;
    for (const e of entries) {
      const es = timeToMinutes(e.start_time);
      if (es < t + SNAP_MINUTES && es + e.duration_minutes > t) c += 1;
    }
    max = Math.max(max, c);
  }
  return max;
}

function bestSlot(entries: PlanEntry[], nowMinutes: number, duration: number): number | null {
  const first = Math.ceil(nowMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  let fallback: { start: number; concurrency: number } | null = null;
  for (let start = first; start + duration <= DAY_END; start += SNAP_MINUTES) {
    const c = maxConcurrency(entries, start, start + duration);
    if (c === 0) return start;
    if (!fallback || c < fallback.concurrency) fallback = { start, concurrency: c };
  }
  return fallback ? fallback.start : null;
}

export function recommend(
  pool: Activity[],
  entries: PlanEntry[],
  dismissedIds: ReadonlySet<string>,
  nowMinutes: number,
): Suggestion[] {
  const placed = new Set(entries.map((e) => e.activity_id));
  const candidates = pool.filter(
    (a) => !a.is_archived && !placed.has(a.id) && !dismissedIds.has(a.id),
  );

  const hard: Suggestion[] = candidates
    .filter((a) => a.fixed_start_time !== null)
    .map((a) => ({ activity: a, proposedStartMinutes: timeToMinutes(a.fixed_start_time!) }))
    .filter((s) => s.proposedStartMinutes >= nowMinutes)
    .sort((a, b) => a.proposedStartMinutes - b.proposedStartMinutes);

  const flexible: Suggestion[] = candidates
    .filter((a) => a.fixed_start_time === null)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .flatMap((a) => {
      const slot = bestSlot(entries, nowMinutes, a.default_duration_minutes);
      return slot === null ? [] : [{ activity: a, proposedStartMinutes: slot }];
    });

  return [...hard, ...flexible].slice(0, MAX_SUGGESTIONS);
}
