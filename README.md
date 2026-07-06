# Your Day

Single-day planner: place prioritized activities from your pool onto today's timeline, overlap freely, get suggestions for what to schedule next (hard requirements first, then priority).

## Setup

1. `npm install`
2. Create a Supabase project; run `supabase/migrations/0001_schema.sql` in the SQL editor.
3. Enable Email (magic link) and Google providers under Authentication.
4. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
5. `npm run dev`

## Commands

- `npm run dev` — start dev server
- `npm test` — run test suite
- `npm run build` — production build

## Spec & plan

- `docs/superpowers/specs/2026-07-04-your-day-design.md`
- `docs/superpowers/plans/2026-07-04-your-day.md`

## AI planner (edge function)

The Autoplan and onboarding features call a Supabase Edge Function that proxies an OpenAI-compatible model (NVIDIA NIM by default). The API key lives only in Supabase secrets — never in the repo or the client.

1. Deploy the function:
   ```
   npx supabase functions deploy plan-day
   ```
2. Set secrets in the Supabase dashboard → Settings → Edge Functions → Secrets:
   - `AI_API_KEY` — your NVIDIA NIM key (`nvapi-...`) from build.nvidia.com
   - `AI_BASE_URL` — `https://integrate.api.nvidia.com/v1`
   - `AI_MODEL` — `meta/llama-3.3-70b-instruct`

   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the runtime automatically.
3. For local function dev, put the same values in `supabase/functions/.env` (gitignored) and run `npx supabase functions serve plan-day`.

To use a different provider later, change only the three `AI_*` values — no code change.
