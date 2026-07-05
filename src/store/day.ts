import { create } from 'zustand';
import * as api from '../api';
import type { Activity, NewActivity, PlanEntry } from '../types';
import { minutesToTime } from '../lib/time';
import { useToastStore } from './toast';

interface DayStore {
  date: string;
  dayPlanId: string | null;
  activities: Activity[];
  entries: PlanEntry[];
  dismissedIds: string[];
  loading: boolean;
  loadDay: (date: string) => Promise<void>;
  addEntry: (activityId: string, startMinutes: number, durationMinutes: number) => Promise<void>;
  moveEntry: (id: string, startMinutes: number) => Promise<void>;
  resizeEntry: (id: string, durationMinutes: number) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  dismiss: (activityId: string) => void;
  addActivity: (input: NewActivity) => Promise<void>;
  editActivity: (id: string, patch: Partial<NewActivity>) => Promise<void>;
  archive: (id: string) => Promise<void>;
}

function toast(message: string) {
  useToastStore.getState().push(message);
}

function sortActivitiesByPriority(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

export const useDayStore = create<DayStore>((set, get) => {
  async function optimisticEntryUpdate(
    id: string,
    local: Partial<PlanEntry>,
    remote: Parameters<typeof api.updateEntry>[1],
  ): Promise<void> {
    const previous = get().entries.find((e) => e.id === id);
    set({ entries: get().entries.map((e) => (e.id === id ? { ...e, ...local } : e)) });
    try {
      const saved = await api.updateEntry(id, remote);
      set({ entries: get().entries.map((e) => (e.id === id ? saved : e)) });
    } catch (err) {
      if (previous) {
        set({ entries: get().entries.map((e) => (e.id === id ? previous : e)) });
      }
      toast(`Save failed: ${(err as Error).message}`);
    }
  }

  return {
    date: '',
    dayPlanId: null,
    activities: [],
    entries: [],
    dismissedIds: [],
    loading: false,

    loadDay: async (date) => {
      set({ loading: true, date, dismissedIds: [] });
      try {
        const [activities, plan] = await Promise.all([api.fetchActivities(), api.ensureDayPlan(date)]);
        const entries = await api.fetchEntries(plan.id);
        if (get().date !== date) return;
        set({ activities, dayPlanId: plan.id, entries, loading: false });
      } catch (err) {
        if (get().date !== date) return;
        set({ loading: false });
        toast(`Load failed: ${(err as Error).message}`);
      }
    },

    addEntry: async (activityId, startMinutes, durationMinutes) => {
      const { dayPlanId, entries } = get();
      if (!dayPlanId) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: PlanEntry = {
        id: tempId, day_plan_id: dayPlanId, activity_id: activityId,
        start_time: minutesToTime(startMinutes), duration_minutes: durationMinutes, done: false,
      };
      set({ entries: [...entries, optimistic] });
      try {
        const saved = await api.createEntry({
          day_plan_id: dayPlanId, activity_id: activityId,
          start_time: minutesToTime(startMinutes), duration_minutes: durationMinutes,
        });
        set({ entries: get().entries.map((e) => (e.id === tempId ? saved : e)) });
      } catch (err) {
        set({ entries: get().entries.filter((e) => e.id !== tempId) });
        toast(`Add failed: ${(err as Error).message}`);
      }
    },

    moveEntry: (id, startMinutes) =>
      optimisticEntryUpdate(id, { start_time: minutesToTime(startMinutes) }, { start_time: minutesToTime(startMinutes) }),

    resizeEntry: (id, durationMinutes) =>
      optimisticEntryUpdate(id, { duration_minutes: durationMinutes }, { duration_minutes: durationMinutes }),

    toggleDone: async (id) => {
      const current = get().entries.find((e) => e.id === id);
      if (!current) return;
      await optimisticEntryUpdate(id, { done: !current.done }, { done: !current.done });
    },

    removeEntry: async (id) => {
      const removed = get().entries.find((e) => e.id === id);
      set({ entries: get().entries.filter((e) => e.id !== id) });
      try {
        await api.deleteEntry(id);
      } catch (err) {
        if (removed) {
          set({ entries: [...get().entries, removed] });
        }
        toast(`Delete failed: ${(err as Error).message}`);
      }
    },

    dismiss: (activityId) => set((s) => ({ dismissedIds: [...s.dismissedIds, activityId] })),

    addActivity: async (input) => {
      try {
        const created = await api.createActivity(input);
        set((s) => ({ activities: sortActivitiesByPriority([...s.activities, created]) }));
      } catch (err) {
        toast(`Add activity failed: ${(err as Error).message}`);
      }
    },

    editActivity: async (id, patch) => {
      try {
        const saved = await api.updateActivity(id, patch);
        set((s) => ({ activities: sortActivitiesByPriority(s.activities.map((a) => (a.id === id ? saved : a))) }));
      } catch (err) {
        toast(`Update failed: ${(err as Error).message}`);
      }
    },

    archive: async (id) => {
      const before = get().activities;
      set({ activities: before.filter((a) => a.id !== id) });
      try {
        await api.archiveActivity(id);
      } catch (err) {
        set({ activities: before });
        toast(`Archive failed: ${(err as Error).message}`);
      }
    },
  };
});
