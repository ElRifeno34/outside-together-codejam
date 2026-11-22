-- 011_google_only_signups.sql — refuse new accounts that don't come from Google
--
-- Run once, after 001–010. The app only offers Google, but Supabase's Email provider may
-- still be on (turning it off needs an org Owner/Admin). This trigger refuses any new
-- auth.users row whose provider isn't Google, so email/password, magic-link, phone and
-- anonymous sign-ups fail even when someone calls the Supabase API directly.
--
-- Limits:
--   * Existing email/password accounts can still sign in. Only turning the Email provider
--     off in the dashboard stops that.
--   * "Add user" in the dashboard (email) is refused too. Drop the trigger to allow it.
--   * An existing email account that signs in with Google for the same address is linked,
--     not inserted, so this trigger doesn't affect it.
--
-- Undo:
--   drop trigger if exists google_only_signups on auth.users;
--   drop function if exists public.refuse_non_google_signup();

create or replace function public.refuse_non_google_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Google sign-ups carry provider = 'google' in app metadata and Google's token issuer
  -- in user metadata; either one is enough.
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     and coalesce(new.raw_user_meta_data ->> 'iss', '') not like '%accounts.google.com%' then
    raise exception 'GOOGLE_ONLY: sign up with Google (provider was %)',
      coalesce(new.raw_app_meta_data ->> 'provider', 'unknown')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_non_google_signup() from public, anon, authenticated;

drop trigger if exists google_only_signups on auth.users;
create trigger google_only_signups
  before insert on auth.users
  for each row execute function public.refuse_non_google_signup();

-- Check (should list the trigger):
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
