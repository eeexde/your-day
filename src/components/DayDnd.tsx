import { type ReactNode } from 'react';
import { DndContext, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { resolveDrop, type DropPayload } from '../lib/dnd';
import { useDayStore } from '../store/day';
import { useToastStore } from '../store/toast';
import { PX_PER_MINUTE } from './EntryBlock';

export function TimelineDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'timeline' });
  return (
    <div ref={setNodeRef} className="timeline-drop" data-testid="timeline-drop">
      {children}
    </div>
  );
}

export function DayDnd({ children }: { children: ReactNode }) {
  const addEntry = useDayStore((s) => s.addEntry);
  const moveEntry = useDayStore((s) => s.moveEntry);
  const push = useToastStore((s) => s.push);

  function handleDragEnd(evt: DragEndEvent) {
    if (evt.over?.id !== 'timeline') return;
    const data = evt.active.data.current as (DropPayload & { kind: 'pool' | 'entry' }) | undefined;
    if (!data) return;

    const el = document.querySelector('.timeline');
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const activeRect = evt.active.rect.current.translated;
    if (!activeRect) return;
    const dropMinutes = (activeRect.top - rect.top) / PX_PER_MINUTE;

    const result = resolveDrop(data.kind, { ...data, dropMinutes });
    if (!result) return;
    if (result.action === 'rejected') {
      push('Fixed-time activity — scheduled at its set hour');
      return;
    }
    if (result.action === 'add') {
      addEntry(result.activityId, result.startMinutes, result.durationMinutes);
    } else {
      moveEntry(result.entryId, result.startMinutes);
    }
  }

  return <DndContext onDragEnd={handleDragEnd}>{children}</DndContext>;
}
