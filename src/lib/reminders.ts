import type { Activity, PlanEntry } from '../types';
import { minutesToTime, timeToMinutes } from './time';

const LEAD_MINUTES = 10;

export interface Reminder {
  title: string;
  fireInMs: number;
}

export function computeReminders(
  entries: PlanEntry[],
  activities: Activity[],
  nowMinutes: number,
): Reminder[] {
  const byId = new Map(activities.map((a) => [a.id, a]));
  return entries.flatMap((e) => {
    const activity = byId.get(e.activity_id);
    if (!activity || activity.fixed_start_time === null) return [];
    const start = timeToMinutes(e.start_time);
    const fireAt = start - LEAD_MINUTES;
    if (fireAt <= nowMinutes) return [];
    return [{ title: `${activity.name} at ${minutesToTime(start)}`, fireInMs: (fireAt - nowMinutes) * 60 * 1000 }];
  });
}

export function scheduleReminders(
  reminders: Reminder[],
  notify: (title: string) => void = (title) => new Notification(title),
): () => void {
  const ids = reminders.map((r) => setTimeout(() => notify(r.title), r.fireInMs));
  return () => ids.forEach(clearTimeout);
}
