import type { Activity, PlanEntry } from '../types';

export interface DayStats {
  plannedMinutes: number;
  doneMinutes: number;
  p1Covered: number;
  p1Total: number;
}

export function dayStats(entries: PlanEntry[], activities: Activity[]): DayStats {
  const plannedMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const doneMinutes = entries.filter((e) => e.done).reduce((sum, e) => sum + e.duration_minutes, 0);
  const p1 = activities.filter((a) => a.priority === 1 && !a.is_archived);
  const placed = new Set(entries.map((e) => e.activity_id));
  const p1Covered = p1.filter((a) => placed.has(a.id)).length;
  return { plannedMinutes, doneMinutes, p1Covered, p1Total: p1.length };
}
