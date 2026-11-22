-- 012_once_per_email.sql — an email address can only ever have one account
--
-- Run once, after 001–011. Supabase already refuses two live accounts with the same
-- email. This also refuses a NEW account for an email that had one before, even if that
-- account was deleted, so nobody can delete and re-register to start over (e.g. to farm
-- points again).
--
-- Only a SHA-256 hash of the lower-cased email is kept, never the address itself, and
-- the table is invisible to the app (RLS on, no policies, no grants).
--
-- Allow an email again (e.g. a mistake):
--   delete from public.used_emails
--   where email_hash = encode(sha256(convert_to(lower(trim('person@gmail.com')), 'UTF8')), 'hex');
-- Undo everything:
--   drop trigger if exists once_per_email on auth.users;
--   drop function if exists public.refuse_reused_email();
--   drop table if exists public.used_emails;

create table if not exists public.used_emails (
  email_hash     text primary key,
  first_used_at  timestamptz not null default now()
);

alter table public.used_emails enable row level security;
revoke all on public.used_emails from public, anon, authenticated;

create or replace function public.email_hash(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(lower(trim(p_email)), 'UTF8')), 'hex');
$$;

revoke execute on function public.email_hash(text) from public, anon, authenticated;

-- Every account that exists today has already "used" its email.
insert into public.used_emails (email_hash, first_used_at)
select public.email_hash(email), created_at
from auth.users
where coalesce(trim(email), '') <> ''
on conflict (email_hash) do nothing;

create or replace function public.refuse_reused_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if coalesce(trim(new.email), '') = '' then
    return new;
  end if;
  v_hash := public.email_hash(new.email);
  if tg_op = 'INSERT' and exists (select 1 from public.used_emails where email_hash = v_hash) then
    raise exception 'EMAIL_ALREADY_USED: this email already had an account'
      using errcode = '23505';
  end if;
  -- Remember it (new accounts, and an account switching to a new email address).
  insert into public.used_emails (email_hash) values (v_hash)
  on conflict (email_hash) do nothing;
  return new;
end;
$$;

revoke execute on function public.refuse_reused_email() from public, anon, authenticated;

drop trigger if exists once_per_email on auth.users;
create trigger once_per_email
  before insert or update of email on auth.users
  for each row execute function public.refuse_reused_email();

-- Check: both rows below should be true.
--   select exists (select 1 from pg_trigger where tgname = 'once_per_email') as trigger_ok,
--          (select count(*) from public.used_emails) >= (select count(*) from auth.users where email <> '') as backfill_ok;
