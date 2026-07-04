import type { PlanEntry } from '../types';
import { timeToMinutes } from './time';

export interface LaidOutEntry {
  entry: PlanEntry;
  col: number;
  colCount: number;
}

interface Span { entry: PlanEntry; start: number; end: number; col: number; cluster: number }

export function layoutColumns(entries: PlanEntry[]): LaidOutEntry[] {
  const spans: Span[] = entries
    .map((e) => ({
      entry: e,
      start: timeToMinutes(e.start_time),
      end: timeToMinutes(e.start_time) + e.duration_minutes,
      col: 0,
      cluster: 0,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Assign clusters: a cluster is a maximal chain of transitively overlapping spans.
  let clusterId = 0;
  let clusterEnd = -1;
  for (const s of spans) {
    if (s.start >= clusterEnd) {
      clusterId += 1;
      clusterEnd = s.end;
    } else {
      clusterEnd = Math.max(clusterEnd, s.end);
    }
    s.cluster = clusterId;
  }

  // Within each cluster, greedily assign the lowest column whose last entry has ended.
  const result: LaidOutEntry[] = [];
  const byCluster = new Map<number, Span[]>();
  for (const s of spans) {
    if (!byCluster.has(s.cluster)) byCluster.set(s.cluster, []);
    byCluster.get(s.cluster)!.push(s);
  }
  for (const cluster of byCluster.values()) {
    const colEnds: number[] = [];
    for (const s of cluster) {
      let col = colEnds.findIndex((end) => end <= s.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(s.end);
      } else {
        colEnds[col] = s.end;
      }
      s.col = col;
    }
    const colCount = colEnds.length;
    for (const s of cluster) {
      result.push({ entry: s.entry, col: s.col, colCount });
    }
  }
  return result;
}
