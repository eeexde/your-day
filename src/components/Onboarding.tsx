import { useState } from 'react';
import * as api from '../api';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import { requestPlan } from '../lib/aiClient';
import { applyPlan } from '../lib/applyPlan';

const FLAG = 'yourday.onboarded';

export function shouldOnboard(): boolean {
  return localStorage.getItem(FLAG) !== '1';
}

export function Onboarding({ nowMinutes, onDone }: { nowMinutes: number; onDone: () => void }) {
  const date = useDayStore((s) => s.date);
  const activities = useDayStore((s) => s.activities);
  const addEntry = useDayStore((s) => s.addEntry);
  const registerActivity = useDayStore((s) => s.registerActivity);
  const push = useToastStore((s) => s.push);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  function finish() {
    localStorage.setItem(FLAG, '1');
    onDone();
  }

  async function submit() {
    setBusy(true);
    try {
      const plan = await requestPlan('onboard', {
        pool: activities.map((a) => ({
          id: a.id, name: a.name, priority: a.priority,
          default_duration_minutes: a.default_duration_minutes, fixed_start_time: a.fixed_start_time,
        })),
        date,
        nowMinutes,
        text,
      });
      await applyPlan(plan, activities, { createActivity: api.createActivity, registerActivity, addEntry });
      finish();
    } catch (err) {
      push(`Setup failed: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>Set up your day</h2>
        <p>Describe a typical day — work hours, workouts, errands. We'll draft a schedule you can tweak.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I work 9–5, gym most mornings, cook dinner around 7…"
          rows={5}
        />
        <div className="onboarding-actions">
          <button onClick={finish} disabled={busy}>Skip</button>
          <button onClick={submit} disabled={busy || !text.trim()}>
            {busy ? 'Planning…' : 'Create my day'}
          </button>
        </div>
      </div>
    </div>
  );
}
