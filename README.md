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
