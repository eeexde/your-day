create or replace function public.seed_default_activities()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  insert into public.activities (user_id, name, color, priority, default_duration_minutes, fixed_start_time)
  values
    (new.id, 'Sleep',             '#6366f1', 1, 480, null),
    (new.id, 'Breakfast',         '#f59e0b', 1, 30,  null),
    (new.id, 'Lunch',             '#f59e0b', 1, 30,  null),
    (new.id, 'Dinner',            '#f97316', 1, 60,  null),
    (new.id, 'Shower & hygiene',  '#0ea5e9', 1, 30,  null);
  return new;
end;
$$;

revoke execute on function public.seed_default_activities() from public, anon, authenticated;

create trigger seed_default_activities_on_signup
  after insert on auth.users
  for each row execute function public.seed_default_activities();
