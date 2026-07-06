import { supabase } from './supabase';
import { buildPlanPrompt, validatePlanResponse } from './planLogic';
import type { PlanInput, PlanMode, PlanResponse } from './planLogic';

async function callFunction(system: string, user: string, correction?: string): Promise<string> {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: correction ? `${user}\n\n${correction}` : user },
  ];
  const { data, error } = await supabase.functions.invoke('plan-day', { body: { messages } });
  if (error) throw new Error(error.message);
  const content = (data as { content?: string } | null)?.content;
  if (typeof content !== 'string' || content.length === 0) throw new Error('plan-day returned no content');
  return content;
}

function parse(content: string): PlanResponse {
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return validatePlanResponse(JSON.parse(cleaned));
}

export async function requestPlan(mode: PlanMode, input: PlanInput): Promise<PlanResponse> {
  const { system, user } = buildPlanPrompt(mode, input);
  try {
    return parse(await callFunction(system, user));
  } catch (first) {
    const correction = `Your previous reply was invalid (${(first as Error).message}). Return ONLY the JSON object described, nothing else.`;
    return parse(await callFunction(system, user, correction));
  }
}
