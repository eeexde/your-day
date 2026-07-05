import { useDraggable } from '@dnd-kit/core';
import type { Activity } from '../types';

interface Props {
  activity: Activity;
  onEdit: () => void;
  onPlace: () => void;
}

export function PoolItem({ activity, onEdit, onPlace }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `pool-${activity.id}`,
    data: { kind: 'pool', activity },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="pool-item"
      style={{
        borderLeft: `4px solid ${activity.color}`,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
    >
      <span className="pool-name">{activity.name}</span>
      <span className="pool-meta">
        P{activity.priority}
        {activity.fixed_start_time ? ` · fixed ${activity.fixed_start_time.slice(0, 5)}` : ''}
      </span>
      <button
        aria-label={`Place ${activity.name}`}
        onClick={onPlace} onPointerDown={(e) => e.stopPropagation()}
      >
        +
      </button>
      <button onClick={onEdit} onPointerDown={(e) => e.stopPropagation()}>Edit</button>
    </div>
  );
}
