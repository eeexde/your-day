import { supabase } from './lib/supabase';
import type { Activity, DayPlan, NewActivity, NewEntry, PlanEntry, Template } from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

export async function fetchActivities(): Promise<Activity[]> {
  return unwrap(await supabase.from('activities').select('*').eq('is_archived', false).order('priority').order('name'));
}

export async function createActivity(input: NewActivity): Promise<Activity> {
  return unwrap(await supabase.from('activities').insert({ ...input, user_id: await userId() }).select().single());
}

export async function updateActivity(id: string, patch: Partial<NewActivity>): Promise<Activity> {
  return unwrap(await supabase.from('activities').update(patch).eq('id', id).select().single());
}

export async function archiveActivity(id: string): Promise<void> {
  unwrap(await supabase.from('activities').update({ is_archived: true }).eq('id', id));
}

export async function ensureDayPlan(date: string): Promise<DayPlan> {
  return unwrap(
    await supabase
      .from('day_plans')
      .upsert({ user_id: await userId(), date }, { onConflict: 'user_id,date' })
      .select()
      .single(),
  );
}

export async function fetchEntries(dayPlanId: string): Promise<PlanEntry[]> {
  return unwrap(await supabase.from('plan_entries').select('*').eq('day_plan_id', dayPlanId).order('start_time'));
}

export async function createEntry(input: NewEntry): Promise<PlanEntry> {
  return unwrap(await supabase.from('plan_entries').insert(input).select().single());
}

export async function updateEntry(
  id: string,
  patch: Partial<Pick<PlanEntry, 'start_time' | 'duration_minutes' | 'done'>>,
): Promise<PlanEntry> {
  return unwrap(await supabase.from('plan_entries').update(patch).eq('id', id).select().single());
}

export async function deleteEntry(id: string): Promise<void> {
  unwrap(await supabase.from('plan_entries').delete().eq('id', id));
}

export async function copyDay(fromDate: string, toDate: string): Promise<PlanEntry[]> {
  const from = await ensureDayPlan(fromDate);
  const to = await ensureDayPlan(toDate);
  const source = await fetchEntries(from.id);
  if (source.length === 0) return fetchEntries(to.id);
  const rows = source.map((e) => ({
    day_plan_id: to.id,
    activity_id: e.activity_id,
    start_time: e.start_time,
    duration_minutes: e.duration_minutes,
  }));
  unwrap(await supabase.from('plan_entries').insert(rows));
  return fetchEntries(to.id);
}

export async function listTemplates(): Promise<Template[]> {
  return unwrap(await supabase.from('templates').select('*').order('name'));
}

export async function saveTemplate(name: string, entries: PlanEntry[]): Promise<Template> {
  const tpl: Template = unwrap(
    await supabase.from('templates').insert({ user_id: await userId(), name }).select().single(),
  );
  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      template_id: tpl.id,
      activity_id: e.activity_id,
      start_time: e.start_time,
      duration_minutes: e.duration_minutes,
    }));
    unwrap(await supabase.from('template_entries').insert(rows));
  }
  return tpl;
}

export async function applyTemplate(templateId: string, date: string): Promise<PlanEntry[]> {
  const plan = await ensureDayPlan(date);
  const tplEntries = unwrap(
    await supabase.from('template_entries').select('*').eq('template_id', templateId),
  ) as { activity_id: string; start_time: string; duration_minutes: number }[];
  if (tplEntries.length > 0) {
    const rows = tplEntries.map((e) => ({
      day_plan_id: plan.id,
      activity_id: e.activity_id,
      start_time: e.start_time,
      duration_minutes: e.duration_minutes,
    }));
    unwrap(await supabase.from('plan_entries').insert(rows));
  }
  return fetchEntries(plan.id);
}
