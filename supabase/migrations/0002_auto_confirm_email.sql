create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  new.email_confirmed_at = coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

revoke execute on function public.auto_confirm_email() from public, anon, authenticated;

create trigger auto_confirm_email_on_signup
  before insert on auth.users
  for each row execute function public.auto_confirm_email();
