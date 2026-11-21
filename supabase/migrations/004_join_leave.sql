-- 004_join_leave.sql — join / leave an activity
--
-- Front end:  const { data, error } = await supabase.rpc('join_activity', { p_activity_id: id })
-- On failure, error.message is one of the codes listed in docs/BACKEND.md.
--
-- Concurrency: the activity row is locked (FOR UPDATE) so two people taking the
-- last spot at the same time are serialized; only one succeeds.

create or replace function public.join_activity(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_act      public.activities%rowtype;
  v_existing text;
  v_count    int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_act from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;
  if v_act.status <> 'open' then
    raise exception 'ACTIVITY_CLOSED';
  end if;
  if v_act.starts_at <= now() then
    raise exception 'ACTIVITY_STARTED';
  end if;

  select status into v_existing
  from public.participants
  where activity_id = p_activity_id and user_id = v_user;

  if v_existing in ('joined', 'confirmed') then
    raise exception 'ALREADY_JOINED';
  end if;

  select count(*) into v_count
  from public.participants
  where activity_id = p_activity_id and status in ('joined', 'confirmed');

  if v_count >= v_act.capacity then
    raise exception 'ACTIVITY_FULL';
  end if;

  -- Safety net in case the profile trigger missed this user
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  -- Re-joining after leaving reuses the same row
  insert into public.participants (activity_id, user_id, status, joined_at)
  values (p_activity_id, v_user, 'joined', now())
  on conflict (activity_id, user_id)
  do update set status = 'joined', joined_at = now(), confirmed_at = null;

  return json_build_object(
    'activity_id',       p_activity_id,
    'my_status',         'joined',
    'participant_count', v_count + 1,
    'spots_left',        v_act.capacity - (v_count + 1)
  );
end;
$$;


create or replace function public.leave_activity(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_act    public.activities%rowtype;
  v_status text;
  v_count  int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_act from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;

  select status into v_status
  from public.participants
  where activity_id = p_activity_id and user_id = v_user;

  if v_status is null or v_status = 'left' then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  if v_status = 'confirmed' or v_act.starts_at <= now() then
    raise exception 'ACTIVITY_STARTED';
  end if;

  update public.participants
  set status = 'left'
  where activity_id = p_activity_id and user_id = v_user;

  select count(*) into v_count
  from public.participants
  where activity_id = p_activity_id and status in ('joined', 'confirmed');

  return json_build_object(
    'activity_id',       p_activity_id,
    'my_status',         'left',
    'participant_count', v_count,
    'spots_left',        v_act.capacity - v_count
  );
end;
$$;

-- Callable by anon on purpose: a logged-out caller gets a clean NOT_AUTHENTICATED
-- error instead of a generic permission error.
grant execute on function public.join_activity(uuid)  to anon, authenticated;
grant execute on function public.leave_activity(uuid) to anon, authenticated;
