-- 018_friend_requests.sql — friend codes send a request; the other person accepts or declines
--
-- Run once, after 001–017. Replaces 013's add_friend, which made the friendship at once.
--   * add_friend(code)            → sends a request ('requested'), or accepts theirs if they
--                                   had already asked you ('accepted')
--   * respond_friend_request(from, accept) → accept makes you friends both ways; decline drops it
--   * cancel_friend_request(to)   → withdraw a request you sent
--   * my_friend_requests()        → incoming and outgoing requests with names
-- Existing friendships are kept.

create table if not exists public.friend_requests (
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);

alter table public.friend_requests enable row level security;
drop policy if exists "see own friend requests" on public.friend_requests;
create policy "see own friend requests" on public.friend_requests for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
grant select on public.friend_requests to authenticated;

create or replace function public.add_friend(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_friend  uuid;
  v_name    text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select user_id into v_friend from public.friend_codes
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_friend is null then
    raise exception 'FRIEND_CODE_NOT_FOUND';
  end if;
  if v_friend = v_user then
    raise exception 'CANNOT_ADD_SELF';
  end if;
  if exists (select 1 from public.friendships where user_id = v_user and friend_id = v_friend) then
    raise exception 'ALREADY_FRIENDS';
  end if;
  select display_name into v_name from public.profiles where id = v_friend;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  -- They already asked you: this is a yes.
  if exists (select 1 from public.friend_requests where from_user = v_friend and to_user = v_user) then
    delete from public.friend_requests where from_user = v_friend and to_user = v_user;
    insert into public.friendships (user_id, friend_id) values (v_user, v_friend), (v_friend, v_user)
    on conflict do nothing;
    return json_build_object('status', 'accepted', 'friend_id', v_friend, 'display_name', v_name);
  end if;

  if exists (select 1 from public.friend_requests where from_user = v_user and to_user = v_friend) then
    raise exception 'REQUEST_ALREADY_SENT';
  end if;
  insert into public.friend_requests (from_user, to_user) values (v_user, v_friend);
  return json_build_object('status', 'requested', 'friend_id', v_friend, 'display_name', v_name);
end;
$$;

create or replace function public.respond_friend_request(p_from uuid, p_accept boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from public.friend_requests where from_user = p_from and to_user = v_user;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if p_accept then
    insert into public.friendships (user_id, friend_id) values (v_user, p_from), (p_from, v_user)
    on conflict do nothing;
  end if;
  return json_build_object('from_user', p_from, 'accepted', p_accept);
end;
$$;

create or replace function public.cancel_friend_request(p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from public.friend_requests where from_user = v_user and to_user = p_to;
end;
$$;

create or replace function public.my_friend_requests()
returns table (
  direction     text,        -- 'incoming' (they asked you) or 'outgoing' (you asked them)
  user_id       uuid,
  display_name  text,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  return query
  select 'incoming'::text, r.from_user, p.display_name, r.created_at
  from public.friend_requests r join public.profiles p on p.id = r.from_user
  where r.to_user = v_user
  union all
  select 'outgoing'::text, r.to_user, p.display_name, r.created_at
  from public.friend_requests r join public.profiles p on p.id = r.to_user
  where r.from_user = v_user
  order by 4 desc;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.cancel_friend_request(uuid) from public, anon;
revoke execute on function public.my_friend_requests() from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.my_friend_requests() to authenticated;

notify pgrst, 'reload schema';
