// Pure, dependency-free scheduling-AI logic: prompt construction + response validation.
// The plan-day edge function is a dumb proxy and holds none of this — it lives here so it is unit-testable.

export type PlanMode = 'onboard' | 'plan';

export interface PoolActivity {
  id: string;
  name: string;
  priority: number;
  default_duration_minutes: number;
  fixed_start_time: string | null; // "HH:MM:SS" | "HH:MM" | null
}

export interface PlanInput {
  pool: PoolActivity[];
  date: string; // "YYYY-MM-DD"
  nowMinutes: number; // minutes from midnight
  text?: string; // free text, onboarding only
}

export interface Placement {
  activity_id?: string;
  name?: string;
  priority?: number;
  start_time: string; // "HH:MM"
  duration_minutes: number;
}

export interface PlanResponse {
  placements: Placement[];
}

export interface PromptMessages {
  system: string;
  user: string;
}

export const MAX_PLACEMENTS = 20;

const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

export function buildPlanPrompt(mode: PlanMode, input: PlanInput): PromptMessages {
  const system = [
    'You are a day-planning assistant. You arrange a single calendar day.',
    'Rules:',
    '- Any activity with a fixed_start_time is a hard requirement: place it at exactly that time, never move it.',
    '- Order the rest by priority (1 = highest) and sensible sequencing.',
    '- Cover basic human needs already in the pool (sleep, meals) at realistic times.',
    '- All start_time values use 24h "HH:MM" on 30-minute boundaries (minutes ":00" or ":30").',
    '- All duration_minutes are positive multiples of 30.',
    '- Keep every entry within one day (00:00 to 24:00). Do not exceed 24:00.',
    `- Return at most ${MAX_PLACEMENTS} placements.`,
    'Respond with ONLY a JSON object, no prose, no code fences, of exactly this shape:',
    '{"placements":[{"activity_id":"<pool id>","start_time":"HH:MM","duration_minutes":30}]}',
    'For a brand-new activity not in the pool, omit activity_id and give "name" and "priority" (1-5):',
    '{"placements":[{"name":"Standup","priority":2,"start_time":"09:30","duration_minutes":30}]}',
  ].join('\n');

  const poolJson = JSON.stringify(
    input.pool.map((a) => ({
      id: a.id,
      name: a.name,
      priority: a.priority,
      default_duration_minutes: a.default_duration_minutes,
      fixed_start_time: a.fixed_start_time,
    })),
  );

  const lines = [
    `Date: ${input.date}. Current time (minutes from midnight): ${input.nowMinutes}.`,
    `Existing activity pool (JSON): ${poolJson}`,
  ];
  if (mode === 'onboard') {
    lines.push(
      `The user described their typical day: "${input.text ?? ''}".`,
      'Create any missing activities from that description (as new-activity placements) and lay out a full day.',
    );
  } else {
    lines.push(
      'Arrange the existing pool into a full day. Prefer higher-priority activities. Do not invent activities unless clearly needed.',
    );
  }
  return { system, user: lines.join('\n') };
}

export function validatePlanResponse(raw: unknown): PlanResponse {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { placements?: unknown }).placements)) {
    throw new Error('response missing placements array');
  }
  const placements = (raw as { placements: unknown[] }).placements;
  if (placements.length > MAX_PLACEMENTS) {
    throw new Error(`too many placements (${placements.length} > ${MAX_PLACEMENTS})`);
  }
  const out: Placement[] = placements.map((p, i) => {
    if (typeof p !== 'object' || p === null) throw new Error(`placement ${i} is not an object`);
    const o = p as Record<string, unknown>;
    if (typeof o.start_time !== 'string' || !TIME_RE.test(o.start_time)) {
      throw new Error(`placement ${i} has a bad start_time`);
    }
    if (typeof o.duration_minutes !== 'number' || o.duration_minutes <= 0 || o.duration_minutes % 30 !== 0) {
      throw new Error(`placement ${i} has a bad duration_minutes`);
    }
    const hasId = typeof o.activity_id === 'string' && o.activity_id.length > 0;
    const hasNew = typeof o.name === 'string' && o.name.length > 0 && typeof o.priority === 'number';
    if (hasId === hasNew) {
      throw new Error(`placement ${i} must have either activity_id or name+priority, not both or neither`);
    }
    const result: Placement = { start_time: o.start_time, duration_minutes: o.duration_minutes };
    if (hasId) {
      result.activity_id = o.activity_id as string;
    } else {
      const pr = o.priority as number;
      if (pr < 1 || pr > 5) throw new Error(`placement ${i} priority out of range`);
      result.name = o.name as string;
      result.priority = pr;
    }
    return result;
  });
  return { placements: out };
}
