import { useState } from 'react';
import * as api from '../api';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import { requestPlan } from '../lib/aiClient';
import { applyPlan } from '../lib/applyPlan';

export function AutoplanButton({ nowMinutes }: { nowMinutes: number }) {
  const date = useDayStore((s) => s.date);
  const activities = useDayStore((s) => s.activities);
  const addEntry = useDayStore((s) => s.addEntry);
  const registerActivity = useDayStore((s) => s.registerActivity);
  const push = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const plan = await requestPlan('plan', {
        pool: activities.map((a) => ({
          id: a.id, name: a.name, priority: a.priority,
          default_duration_minutes: a.default_duration_minutes, fixed_start_time: a.fixed_start_time,
        })),
        date,
        nowMinutes,
      });
      await applyPlan(plan, activities, { createActivity: api.createActivity, registerActivity, addEntry });
      push('Day planned.');
    } catch (err) {
      push(`Autoplan failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="autoplan" onClick={run} disabled={busy}>
      {busy ? 'Planning…' : '✨ Autoplan'}
    </button>
  );
}
