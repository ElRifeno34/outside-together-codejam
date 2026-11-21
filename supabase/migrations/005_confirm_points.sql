-- 005_confirm_points.sql — confirm attendance and award points
--
-- Rules (PlanOff §3.4):
--   * points = 10 + 5 × niche_value  (public.points_for)
--   * once per user per activity (unique constraint on points)
--   * only once 2+ participants have confirmed
--   * confirming is allowed any time after starts_at
--
-- When the 2nd person confirms, everyone confirmed so far gets points and the
-- activity becomes 'done'. Anyone confirming after that gets points immediately.
-- Calling it twice is harmless (idempotent).
--
-- Front end:  const { data, error } = await supabase.rpc('confirm_attendance', { p_activity_id: id })

create or replace function public.confirm_attendance(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_act        public.activities%rowtype;
  v_status     text;
  v_confirmed  int;
  v_amount     int;
  v_my_points  int;
  v_total      int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Lock the activity so two simultaneous confirmations are serialized
  select * into v_act from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;
  if v_act.status = 'cancelled' then
    raise exception 'ACTIVITY_CLOSED';
  end if;
  if now() < v_act.starts_at then
    raise exception 'ACTIVITY_NOT_STARTED';
  end if;

  select status into v_status
  from public.participants
  where activity_id = p_activity_id and user_id = v_user;

  if v_status is null or v_status = 'left' then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if v_status = 'joined' then
    update public.participants
    set status = 'confirmed', confirmed_at = now()
    where activity_id = p_activity_id and user_id = v_user;
  end if;

  select count(*) into v_confirmed
  from public.participants
  where activity_id = p_activity_id and status = 'confirmed';

  if v_confirmed >= 2 then
    select public.points_for(niche_value) into v_amount
    from public.activity_types
    where id = v_act.type_id;

    -- Award everyone confirmed who has no points yet, and bump their totals
    with awarded as (
      insert into public.points (user_id, activity_id, amount)
      select user_id, p_activity_id, v_amount
      from public.participants
      where activity_id = p_activity_id and status = 'confirmed'
      on conflict (user_id, activity_id) do nothing
      returning user_id, amount
    )
    update public.profiles pr
    set total_points = pr.total_points + awarded.amount
    from awarded
    where pr.id = awarded.user_id;

    update public.activities
    set status = 'done'
    where id = p_activity_id and status = 'open';
  end if;

  select coalesce((select amount from public.points
                   where user_id = v_user and activity_id = p_activity_id), 0)
    into v_my_points;
  select total_points into v_total from public.profiles where id = v_user;

  return json_build_object(
    'activity_id',      p_activity_id,
    'my_status',        'confirmed',
    'confirmed_count',  v_confirmed,
    'points_unlocked',  v_confirmed >= 2,
    'waiting_for',      greatest(2 - v_confirmed, 0),
    'points_earned',    v_my_points,
    'total_points',     coalesce(v_total, 0)
  );
end;
$$;

grant execute on function public.confirm_attendance(uuid) to anon, authenticated;
