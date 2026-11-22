-- 008_location_check_in.sql — "We're here" needs the phone's location
--
-- Run once, after 001–007. Replaces confirm_attendance(uuid) with a version that
-- takes the device position and refuses check-ins farther than 200 m from the
-- activity's place. The position and distance are kept on the participant row
-- as proof of presence (participants are only readable by their own user, see 003).
--
-- Places without coordinates skip the distance check (nothing to compare with).
--
-- Front end:
--   supabase.rpc('confirm_attendance', {
--     p_activity_id: id, p_lat: 45.52, p_lng: -73.58, p_accuracy_m: 25,
--   })

alter table public.participants
  add column if not exists confirmed_lat         double precision,
  add column if not exists confirmed_lng         double precision,
  add column if not exists confirmed_accuracy_m  double precision,
  add column if not exists confirmed_distance_m  int;

-- Great-circle distance in metres (haversine); no PostGIS needed.
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = public
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- The old one-argument version must go, or clients could still check in without a location.
drop function if exists public.confirm_attendance(uuid);

create or replace function public.confirm_attendance(
  p_activity_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy_m  double precision default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_m      constant int := 200;
  v_user       uuid := auth.uid();
  v_act        public.activities%rowtype;
  v_place      public.places%rowtype;
  v_status     text;
  v_distance   int;
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
    if p_lat is null or p_lng is null then
      raise exception 'LOCATION_REQUIRED';
    end if;
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'INVALID_LOCATION';
    end if;

    select * into v_place from public.places where id = v_act.place_id;
    if v_place.lat is not null and v_place.lng is not null then
      v_distance := round(public.distance_m(p_lat, p_lng, v_place.lat, v_place.lng));
      if v_distance > v_max_m then
        raise exception 'TOO_FAR_FROM_PLACE (% m)', v_distance;
      end if;
    end if;

    update public.participants
    set status = 'confirmed',
        confirmed_at = now(),
        confirmed_lat = p_lat,
        confirmed_lng = p_lng,
        confirmed_accuracy_m = p_accuracy_m,
        confirmed_distance_m = v_distance
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
    'total_points',     coalesce(v_total, 0),
    'distance_m',       v_distance
  );
end;
$$;

revoke execute on function public.confirm_attendance(uuid, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.confirm_attendance(uuid, double precision, double precision, double precision)
  to authenticated;
