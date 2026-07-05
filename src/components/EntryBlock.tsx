import type { Activity, PlanEntry } from '../types';
import { formatRange, timeToMinutes } from '../lib/time';
import { useDayStore } from '../store/day';

export const PX_PER_MINUTE = 1;

interface Props {
  entry: PlanEntry;
  activity: Activity;
  col: number;
  colCount: number;
}

export function EntryBlock({ entry, activity, col, colCount }: Props) {
  const toggleDone = useDayStore((s) => s.toggleDone);
  const removeEntry = useDayStore((s) => s.removeEntry);
  const start = timeToMinutes(entry.start_time);
  const width = 100 / colCount;

  return (
    <div
      className={`entry-block${entry.done ? ' done' : ''}`}
      data-entry-id={entry.id}
      style={{
        top: start * PX_PER_MINUTE,
        height: entry.duration_minutes * PX_PER_MINUTE,
        left: `${col * width}%`,
        width: `${width}%`,
        background: activity.color,
      }}
    >
      <div className="entry-head">
        <input type="checkbox" checked={entry.done} onChange={() => toggleDone(entry.id)} />
        <span className="entry-name">{activity.name}</span>
        <button aria-label="Delete entry" onClick={() => removeEntry(entry.id)}>×</button>
      </div>
      <span className="entry-range">{formatRange(start, entry.duration_minutes)}</span>
    </div>
  );
}
