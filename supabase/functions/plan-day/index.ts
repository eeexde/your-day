// Thin authenticated proxy to an OpenAI-compatible chat API (NVIDIA NIM by default).
// Holds the AI key; contains no scheduling logic. All logic lives in src/lib (tested).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: 'unauthorized' }, 401);

    const { messages } = await req.json();
    if (!Array.isArray(messages)) return json({ error: 'messages array required' }, 400);

    const res = await fetch(`${Deno.env.get('AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: Deno.env.get('AI_MODEL'),
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) return json({ error: `ai upstream ${res.status}: ${await res.text()}` }, 502);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return json({ content }, 200);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
