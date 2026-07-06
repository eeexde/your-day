import type { Activity, NewActivity } from '../types';
import type { PlanResponse } from './planLogic';
import { timeToMinutes } from './time';

const DEFAULT_COLOR = '#4f6df5';

export interface ApplyPlanDeps {
  createActivity: (input: NewActivity) => Promise<Activity>;
  registerActivity: (activity: Activity) => void;
  addEntry: (activityId: string, startMinutes: number, durationMinutes: number) => Promise<void>;
}

export async function applyPlan(plan: PlanResponse, pool: Activity[], deps: ApplyPlanDeps): Promise<void> {
  const known = new Set(pool.map((a) => a.id));
  for (const p of plan.placements) {
    let activityId: string;
    if (p.activity_id && known.has(p.activity_id)) {
      activityId = p.activity_id;
    } else if (p.name) {
      const created = await deps.createActivity({
        name: p.name,
        color: DEFAULT_COLOR,
        priority: (p.priority ?? 3) as Activity['priority'],
        default_duration_minutes: p.duration_minutes,
        fixed_start_time: null,
      });
      deps.registerActivity(created);
      known.add(created.id);
      activityId = created.id;
    } else {
      continue;
    }
    await deps.addEntry(activityId, timeToMinutes(p.start_time), p.duration_minutes);
  }
}
