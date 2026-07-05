import { useMemo } from 'react';
import { useDayStore } from '../store/day';
import { recommend } from '../lib/recommend';
import { formatRange } from '../lib/time';

export function SuggestionsPanel({ nowMinutes }: { nowMinutes: number }) {
  const activities = useDayStore((s) => s.activities);
  const entries = useDayStore((s) => s.entries);
  const dismissedIds = useDayStore((s) => s.dismissedIds);
  const addEntry = useDayStore((s) => s.addEntry);
  const dismiss = useDayStore((s) => s.dismiss);

  const suggestions = useMemo(
    () => recommend(activities, entries, new Set(dismissedIds), nowMinutes),
    [activities, entries, dismissedIds, nowMinutes],
  );

  if (suggestions.length === 0) return null;

  return (
    <section className="suggestions">
      <h3>Suggestions</h3>
      {suggestions.map(({ activity, proposedStartMinutes }) => (
        <div key={activity.id} className="suggestion-card" style={{ borderLeft: `4px solid ${activity.color}` }}>
          <div>
            <span className="pool-name">{activity.name}</span>
            <span className="pool-meta"> {formatRange(proposedStartMinutes, activity.default_duration_minutes)}</span>
            {activity.fixed_start_time && <span className="badge">fixed</span>}
          </div>
          <button aria-label={`Accept ${activity.name}`} onClick={() => addEntry(activity.id, proposedStartMinutes, activity.default_duration_minutes)}>✓</button>
          <button aria-label={`Dismiss ${activity.name}`} onClick={() => dismiss(activity.id)}>✕</button>
        </div>
      ))}
    </section>
  );
}
