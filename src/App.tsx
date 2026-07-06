import { useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { TopBar } from './components/TopBar';
import { Timeline } from './components/Timeline';
import { DayDnd } from './components/DayDnd';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { AutoplanButton } from './components/AutoplanButton';
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
  const date = useDayStore((s) => s.date);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesLocal);
  const [view, setView] = useState<'day' | 'plan'>('day');

  useEffect(() => {
    loadDay(todayISO());
  }, [loadDay]);

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(nowMinutesLocal()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (date !== todayISO()) return;
    let cancel: (() => void) | undefined;
    let disposed = false;
    Notification.requestPermission().then(() => {
      if (disposed || Notification.permission !== 'granted') return;
      cancel = scheduleReminders(computeReminders(entries, activities, nowMinutesLocal()));
    });
    return () => {
      disposed = true;
      cancel?.();
    };
  }, [entries, activities, date]);

  return (
    <DayDnd>
      <div className="app-shell">
        <TopBar />
        <div className={`panes view-${view}`}>
          <main className="left-pane">
            <Timeline nowMinutes={nowMinutes} />
          </main>
          <aside className="right-pane">
            <AutoplanButton nowMinutes={nowMinutes} />
            <SuggestionsPanel nowMinutes={nowMinutes} />
            <PoolPanel />
          </aside>
        </div>
        <nav className="mobile-nav" aria-label="View">
          <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>
            Day
          </button>
          <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>
            Plan
          </button>
        </nav>
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
