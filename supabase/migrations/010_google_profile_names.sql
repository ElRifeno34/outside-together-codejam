-- 010_google_profile_names.sql — use the Google name for new profiles
--
-- Run once, after 001–009. Sign-in is Google only, and Google sends the person's name
-- as full_name / name (not display_name), so new profiles used the email prefix
-- ("jio" for jio@gmail.com). This version prefers Google's name, then falls back as before.
-- Existing profiles are left alone (see the optional query at the end).

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
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New member'
    ), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Keep the 007 hardening: only the auth trigger may run this.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Optional, run by hand: give existing Google users their Google name when their
-- profile still shows the email prefix.
--
-- update public.profiles p
-- set display_name = left(coalesce(
--       nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
--       nullif(trim(u.raw_user_meta_data ->> 'name'), '')), 60)
-- from auth.users u
-- where u.id = p.id
--   and p.display_name = split_part(u.email, '@', 1)
--   and coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') is not null;
