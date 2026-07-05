import { useState } from 'react';
import { useDayStore } from '../store/day';
import type { Activity, NewActivity } from '../types';
import { ActivityForm } from './ActivityForm';
import { PoolItem } from './PoolItem';

export function PoolPanel() {
  const activities = useDayStore((s) => s.activities);
  const addActivity = useDayStore((s) => s.addActivity);
  const editActivity = useDayStore((s) => s.editActivity);
  const archive = useDayStore((s) => s.archive);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);

  function submit(input: NewActivity) {
    if (editing) editActivity(editing.id, input);
    else addActivity(input);
    setEditing(null);
    setShowForm(false);
  }

  function archiveEditing() {
    if (!editing) return;
    archive(editing.id);
    setEditing(null);
    setShowForm(false);
  }

  return (
    <section className="pool-panel">
      <div className="pool-header">
        <h3>Activities</h3>
        <button onClick={() => { setEditing(null); setShowForm(true); }}>Add activity</button>
      </div>
      {showForm && (
        <ActivityForm
          initial={editing}
          onSubmit={submit}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onArchive={editing ? archiveEditing : undefined}
        />
      )}
      {activities.map((a) => (
        <PoolItem key={a.id} activity={a} onEdit={() => { setEditing(a); setShowForm(true); }} />
      ))}
    </section>
  );
}
