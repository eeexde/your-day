export interface Activity {
  id: string;
  user_id: string;
  name: string;
  color: string;
  priority: 1 | 2 | 3 | 4 | 5;
  default_duration_minutes: number;
  fixed_start_time: string | null; // "HH:MM:SS" from Postgres, null = flexible
  is_archived: boolean;
}

export type NewActivity = Omit<Activity, 'id' | 'user_id' | 'is_archived'>;

export interface DayPlan {
  id: string;
  user_id: string;
  date: string; // "YYYY-MM-DD"
}

export interface PlanEntry {
  id: string;
  day_plan_id: string;
  activity_id: string;
  start_time: string; // "HH:MM:SS"
  duration_minutes: number;
  done: boolean;
}

export type NewEntry = Omit<PlanEntry, 'id' | 'done'>;

export interface Template {
  id: string;
  user_id: string;
  name: string;
}

export interface TemplateEntry {
  id: string;
  template_id: string;
  activity_id: string;
  start_time: string;
  duration_minutes: number;
}
