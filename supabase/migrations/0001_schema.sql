create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4f6df5',
  priority int not null default 3 check (priority between 1 and 5),
  default_duration_minutes int not null default 60 check (default_duration_minutes % 30 = 0 and default_duration_minutes > 0),
  fixed_start_time time,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  unique (user_id, date)
);

create table public.plan_entries (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid not null references public.day_plans(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  start_time time not null,
  duration_minutes int not null check (duration_minutes % 30 = 0 and duration_minutes > 0),
  done boolean not null default false
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null
);

create table public.template_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  start_time time not null,
  duration_minutes int not null check (duration_minutes % 30 = 0 and duration_minutes > 0)
);

alter table public.activities enable row level security;
alter table public.day_plans enable row level security;
alter table public.plan_entries enable row level security;
alter table public.templates enable row level security;
alter table public.template_entries enable row level security;

create policy "own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own day_plans" on public.day_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plan_entries" on public.plan_entries
  for all using (exists (select 1 from public.day_plans p where p.id = day_plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.day_plans p where p.id = day_plan_id and p.user_id = auth.uid()));
create policy "own templates" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own template_entries" on public.template_entries
  for all using (exists (select 1 from public.templates t where t.id = template_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.templates t where t.id = template_id and t.user_id = auth.uid()));
