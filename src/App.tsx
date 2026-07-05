import { useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { TopBar } from './components/TopBar';
import { Timeline } from './components/Timeline';
import { DayDnd } from './components/DayDnd';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { PoolPanel } from './components/PoolPanel';
import { Toasts } from './components/Toasts';
import { useDayStore } from './store/day';
import { computeReminders, scheduleReminders } from './lib/reminders';

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowMinutesLocal(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function Planner() {
  const loadDay = useDayStore((s) => s.loadDay);
  const entries = useDayStore((s) => s.entries);
  const activities = useDayStore((s) => s.activities);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesLocal);

  useEffect(() => {
    loadDay(todayISO());
  }, [loadDay]);

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(nowMinutesLocal()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    const cancel = scheduleReminders(computeReminders(entries, activities, nowMinutesLocal()));
    return cancel;
  }, [entries, activities]);

  return (
    <DayDnd>
      <div className="app-shell">
        <TopBar />
        <div className="panes">
          <main className="left-pane">
            <Timeline nowMinutes={nowMinutes} />
          </main>
          <aside className="right-pane">
            <SuggestionsPanel nowMinutes={nowMinutes} />
            <PoolPanel />
          </aside>
        </div>
      </div>
    </DayDnd>
  );
}

export default function App() {
  return (
    <AuthGate>
      <Planner />
      <Toasts />
    </AuthGate>
  );
}
