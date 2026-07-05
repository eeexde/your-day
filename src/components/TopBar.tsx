import { useEffect, useState } from 'react';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import * as api from '../api';
import { dayStats } from '../lib/stats';
import type { Template } from '../types';
import { supabase } from '../lib/supabase';

export function shiftDate(date: string, days: number): string {
  const [y, m, day] = date.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TopBar() {
  const { date, entries, activities, loadDay } = useDayStore();
  const push = useToastStore((s) => s.push);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTpl, setSelectedTpl] = useState('');

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  const stats = dayStats(entries, activities);
  const h = (m: number) => (m / 60).toFixed(1);

  async function copyYesterday() {
    try {
      await api.copyDay(shiftDate(date, -1), date);
      await loadDay(date);
    } catch (err) {
      push(`Copy failed: ${(err as Error).message}`);
    }
  }

  async function applyTpl() {
    if (!selectedTpl) return;
    try {
      await api.applyTemplate(selectedTpl, date);
      await loadDay(date);
    } catch (err) {
      push(`Apply failed: ${(err as Error).message}`);
    }
  }

  async function saveTpl() {
    const name = window.prompt('Template name?');
    if (!name) return;
    try {
      const tpl = await api.saveTemplate(name, entries);
      setTemplates((t) => [...t, tpl]);
    } catch (err) {
      push(`Save failed: ${(err as Error).message}`);
    }
  }

  return (
    <header className="top-bar">
      <input type="date" value={date} onChange={(e) => loadDay(e.target.value)} aria-label="Date" />
      <button onClick={copyYesterday}>Copy yesterday</button>
      <select value={selectedTpl} onChange={(e) => setSelectedTpl(e.target.value)} aria-label="Template">
        <option value="">Template…</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button onClick={applyTpl} disabled={!selectedTpl}>Apply</button>
      <button onClick={saveTpl}>Save as template</button>
      <span className="stats-chip">
        {h(stats.plannedMinutes)}h planned · {h(stats.doneMinutes)}h done · P1 {stats.p1Covered}/{stats.p1Total}
      </span>
      <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </header>
  );
}
