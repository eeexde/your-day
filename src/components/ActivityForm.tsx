import { useState, type FormEvent } from 'react';
import type { Activity, NewActivity } from '../types';

interface Props {
  initial: Activity | null;
  onSubmit: (input: NewActivity) => void;
  onCancel: () => void;
  onArchive?: () => void;
}

export function ActivityForm({ initial, onSubmit, onCancel, onArchive }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#4f6df5');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(initial?.priority ?? 3);
  const [duration, setDuration] = useState(initial?.default_duration_minutes ?? 60);
  const [hasFixed, setHasFixed] = useState(initial?.fixed_start_time != null);
  const [fixedTime, setFixedTime] = useState(initial?.fixed_start_time?.slice(0, 5) ?? '09:00');

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      color,
      priority: priority as NewActivity['priority'],
      default_duration_minutes: duration,
      fixed_start_time: hasFixed ? fixedTime : null,
    });
  }

  return (
    <form className="activity-form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required aria-label="Name" />
      </label>
      <label>
        Color
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color" />
      </label>
      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)} aria-label="Priority">
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>{p}{p === 1 ? ' (highest)' : ''}</option>
          ))}
        </select>
      </label>
      <label>
        Duration
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Duration">
          {[30, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
        </select>
      </label>
      <label>
        <input
          type="checkbox" checked={hasFixed}
          onChange={(e) => setHasFixed(e.target.checked)}
          aria-label="Only at a specific hour"
        />
        Only at a specific hour
      </label>
      {hasFixed && (
        <label>
          Fixed time
          <input
            type="time" step={1800} value={fixedTime}
            onChange={(e) => setFixedTime(e.target.value)}
            aria-label="Fixed time"
          />
        </label>
      )}
      <div className="form-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
        {initial && onArchive && (
          <button type="button" onClick={onArchive}>Archive</button>
        )}
      </div>
    </form>
  );
}
