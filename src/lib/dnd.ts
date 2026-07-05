import type { Activity, PlanEntry } from '../types';
import { snapMinutes, timeToMinutes } from './time';

export interface DropPayload {
  activity: Activity;
  entry?: PlanEntry;
  dropMinutes: number;
}

export type DropResult =
  | { action: 'add'; activityId: string; startMinutes: number; durationMinutes: number }
  | { action: 'move'; entryId: string; startMinutes: number }
  | { action: 'rejected'; reason: 'fixed-time' };

export function resolveDrop(kind: 'pool' | 'entry', payload: DropPayload): DropResult | null {
  const { activity, entry } = payload;
  const snapped = snapMinutes(payload.dropMinutes);
  const fixedMinutes = activity.fixed_start_time === null ? null : timeToMinutes(activity.fixed_start_time);

  if (kind === 'pool') {
    if (fixedMinutes !== null && snapped !== fixedMinutes) {
      return { action: 'rejected', reason: 'fixed-time' };
    }
    return {
      action: 'add',
      activityId: activity.id,
      startMinutes: fixedMinutes ?? snapped,
      durationMinutes: activity.default_duration_minutes,
    };
  }

  if (!entry) return null;
  if (fixedMinutes !== null && snapped !== fixedMinutes) {
    return { action: 'rejected', reason: 'fixed-time' };
  }
  return { action: 'move', entryId: entry.id, startMinutes: snapped };
}
