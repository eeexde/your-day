import { useRef, type PointerEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Activity, PlanEntry } from '../types';
import { formatRange, snapMinutes, timeToMinutes, SNAP_MINUTES } from '../lib/time';
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
  const resizeEntry = useDayStore((s) => s.resizeEntry);
  const start = timeToMinutes(entry.start_time);
  const width = 100 / colCount;
  const resizeStart = useRef<{ y: number; duration: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `entry-${entry.id}`,
    data: { kind: 'entry', activity, entry },
  });

  function onResizeDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    resizeStart.current = { y: e.clientY, duration: entry.duration_minutes };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeUp(e: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current) return;
    const deltaMinutes = (e.clientY - resizeStart.current.y) / PX_PER_MINUTE;
    const next = Math.max(SNAP_MINUTES, snapMinutes(resizeStart.current.duration + deltaMinutes));
    if (next !== entry.duration_minutes) resizeEntry(entry.id, next);
    resizeStart.current = null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`entry-block${entry.done ? ' done' : ''}`}
      data-entry-id={entry.id}
      style={{
        top: start * PX_PER_MINUTE,
        height: entry.duration_minutes * PX_PER_MINUTE,
        left: `${col * width}%`,
        width: `${width}%`,
        background: activity.color,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
    >
      <div className="entry-head" {...listeners} {...attributes}>
        <input
          type="checkbox" checked={entry.done}
          onChange={() => toggleDone(entry.id)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <span className="entry-name">{activity.name}</span>
        <button aria-label="Delete entry" onClick={() => removeEntry(entry.id)} onPointerDown={(e) => e.stopPropagation()}>×</button>
      </div>
      <span className="entry-range">{formatRange(start, entry.duration_minutes)}</span>
      <div className="resize-handle" onPointerDown={onResizeDown} onPointerUp={onResizeUp} />
    </div>
  );
}
