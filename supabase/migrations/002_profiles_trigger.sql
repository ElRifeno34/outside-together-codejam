-- 002_profiles_trigger.sql — create a profile automatically on sign-up
--
-- Front end can pass a display name at sign-up:
--   supabase.auth.signUp({ email, password, options: { data: { display_name: 'Léa' } } })
-- Otherwise the part of the email before "@" is used.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New member'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: users who signed up before this migration ran
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'New member')
from auth.users u
on conflict (id) do nothing;
