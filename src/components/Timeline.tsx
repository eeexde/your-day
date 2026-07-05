import { useEffect, useRef } from 'react';
import { useDayStore } from '../store/day';
import { layoutColumns } from '../lib/layout';
import { minutesToTime } from '../lib/time';
import { EntryBlock, PX_PER_MINUTE } from './EntryBlock';
import { TimelineDropZone } from './DayDnd';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const SCROLL_TO_MINUTES = 6 * 60;

export function Timeline({ nowMinutes }: { nowMinutes: number }) {
  const entries = useDayStore((s) => s.entries);
  const activities = useDayStore((s) => s.activities);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: SCROLL_TO_MINUTES * PX_PER_MINUTE });
  }, []);

  const laid = layoutColumns(entries);
  const byId = new Map(activities.map((a) => [a.id, a]));

  return (
    <div className="timeline-scroll" ref={scrollRef}>
      <TimelineDropZone>
        <div className="timeline" style={{ height: 24 * 60 * PX_PER_MINUTE }}>
          {HOURS.map((h) => (
            <div key={h} className="hour-row" style={{ top: h * 60 * PX_PER_MINUTE }}>
              <span className="hour-label">{minutesToTime(h * 60)}</span>
            </div>
          ))}
          <div className="now-line" data-testid="now-line" style={{ top: nowMinutes * PX_PER_MINUTE }} />
          <div className="entries-layer">
            {laid.map(({ entry, col, colCount }) => {
              const activity = byId.get(entry.activity_id);
              if (!activity) return null;
              return <EntryBlock key={entry.id} entry={entry} activity={activity} col={col} colCount={colCount} />;
            })}
          </div>
        </div>
      </TimelineDropZone>
    </div>
  );
}
