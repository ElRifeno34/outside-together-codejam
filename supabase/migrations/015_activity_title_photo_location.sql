-- 015_activity_title_photo_location.sql — custom title, uploaded photo, map-picked location
--
-- Run once, after 001–014.
--
--   * activities.title         optional custom title (3–80 chars); the type name otherwise
--   * activities.photo_path    optional photo in the public "activity-photos" bucket,
--                              under <creator id>/…; the type's photo otherwise
--   * activities.location_*    optional spot picked on the map, for this activity only.
--                              When set it replaces the preset place everywhere
--                              (board, map, "We're here" 200 m check).
--   An activity has a preset place OR a custom location (or both; the custom one wins).
--
-- create_activity / update_activity get the new optional parameters; the old
-- signatures are dropped so the app can't call them by mistake.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.activities alter column place_id drop not null;
alter table public.activities
  add column if not exists title             text,
  add column if not exists photo_path        text,
  add column if not exists location_name     text,
  add column if not exists location_address  text,
  add column if not exists location_lat      double precision,
  add column if not exists location_lng      double precision;

alter table public.activities drop constraint if exists activities_has_location;
alter table public.activities add constraint activities_has_location check (
  place_id is not null
  or (location_lat is not null and location_lng is not null and location_name is not null)
);

grant select (title, photo_path, location_name, location_address, location_lat, location_lng)
  on public.activities to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Board view: same as 007 plus title / photo_path, and the custom location
-- taking over place_name / place_address / lat / lng when set.
-- ---------------------------------------------------------------------------
drop view if exists public.activity_board;

create view public.activity_board
with (security_invoker = false)
as
select
  a.id,
  a.type_id,
  t.name                                            as activity_name,
  t.niche_value,
  t.keywords,
  public.points_for(t.niche_value)                  as points_value,
  a.place_id,
  coalesce(a.location_name, p.name)                 as place_name,
  case when a.location_lat is not null then coalesce(a.location_address, '')
       else p.address end                           as place_address,
  coalesce(a.location_lat, p.lat)                   as lat,
  coalesce(a.location_lng, p.lng)                   as lng,
  a.starts_at,
  a.duration_min,
  a.starts_at + make_interval(mins => a.duration_min) as ends_at,
  a.capacity,
  a.min_people,
  a.status,
  (a.created_by = auth.uid())                       as is_mine,
  coalesce(c.participant_count, 0)::int             as participant_count,
  greatest(a.capacity - coalesce(c.participant_count, 0), 0)::int as spots_left,
  (coalesce(c.participant_count, 0) >= a.capacity)  as is_full,
  me.status                                         as my_status,
  a.title,
  a.photo_path,
  (a.location_lat is not null)                      as is_custom_location
from public.activities a
join public.activity_types t on t.id = a.type_id
left join public.places p    on p.id = a.place_id
left join (
  select activity_id, count(*) as participant_count
  from public.participants
  where status in ('joined', 'confirmed')
  group by activity_id
) c on c.activity_id = a.id
left join public.participants me
  on me.activity_id = a.id
 and me.user_id = auth.uid()
 and me.status <> 'left';

revoke all on public.activity_board from public, anon, authenticated;
grant select on public.activity_board to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: public bucket, 5 MB, images only; people write in their own folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-photos', 'activity-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "activity photos: upload to own folder" on storage.objects;
create policy "activity photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'activity-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "activity photos: change own files" on storage.objects;
create policy "activity photos: change own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'activity-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "activity photos: delete own files" on storage.objects;
create policy "activity photos: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Shared validation for create / update
-- ---------------------------------------------------------------------------
create or replace function public.check_activity_details(
  p_user           uuid,
  p_place_id       uuid,
  p_title          text,
  p_photo_path     text,
  p_location_name  text,
  p_location_lat   double precision,
  p_location_lng   double precision
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_title is not null and length(trim(p_title)) not between 3 and 80 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_photo_path is not null
     and (p_photo_path not like p_user::text || '/%' or p_photo_path like '%..%') then
    raise exception 'INVALID_PHOTO';
  end if;
  if p_location_lat is not null or p_location_lng is not null then
    if p_location_lat is null or p_location_lng is null
       or coalesce(trim(p_location_name), '') = '' then
      raise exception 'INVALID_PIN';
    end if;
    -- Greater Montréal only.
    if p_location_lat not between 45.30 and 45.80 or p_location_lng not between -74.20 and -73.30 then
      raise exception 'LOCATION_OUTSIDE_MONTREAL';
    end if;
  elsif p_place_id is null then
    raise exception 'INVALID_PLACE';
  end if;
  if p_place_id is not null
     and not exists (select 1 from public.places where id = p_place_id and is_public) then
    raise exception 'INVALID_PLACE';
  end if;
end;
$$;

revoke execute on function public.check_activity_details(uuid, uuid, text, text, text, double precision, double precision)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_activity (replaces 006)
-- ---------------------------------------------------------------------------
drop function if exists public.create_activity(uuid, uuid, timestamptz, int, int, int);

create or replace function public.create_activity(
  p_type_id           uuid,
  p_place_id          uuid,
  p_starts_at         timestamptz,
  p_duration_min      int default 60,
  p_capacity          int default 6,
  p_min_people        int default 2,
  p_title             text default null,
  p_photo_path        text default null,
  p_location_name     text default null,
  p_location_address  text default null,
  p_location_lat      double precision default null,
  p_location_lng      double precision default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.activity_types where id = p_type_id) then
    raise exception 'INVALID_TYPE';
  end if;
  perform public.check_activity_details(v_user, p_place_id, p_title, p_photo_path,
                                        p_location_name, p_location_lat, p_location_lng);
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'INVALID_TIME';
  end if;
  if p_duration_min is null or p_duration_min not between 15 and 240 then
    raise exception 'INVALID_DURATION';
  end if;
  if p_capacity is null or p_capacity not between 2 and 20
     or p_min_people is null or p_min_people not between 1 and p_capacity then
    raise exception 'INVALID_CAPACITY';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.activities (type_id, place_id, starts_at, duration_min, capacity, min_people,
                                 created_by, title, photo_path, location_name, location_address,
                                 location_lat, location_lng)
  values (p_type_id, p_place_id, p_starts_at, p_duration_min, p_capacity, p_min_people,
          v_user, nullif(trim(p_title), ''), p_photo_path,
          case when p_location_lat is not null then trim(p_location_name) end,
          case when p_location_lat is not null then nullif(trim(p_location_address), '') end,
          p_location_lat, p_location_lng)
  returning id into v_id;

  insert into public.participants (activity_id, user_id, status)
  values (v_id, v_user, 'joined');

  return json_build_object(
    'activity_id',       v_id,
    'my_status',         'joined',
    'participant_count', 1,
    'spots_left',        p_capacity - 1
  );
end;
$$;

revoke execute on function public.create_activity(uuid, uuid, timestamptz, int, int, int, text, text, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.create_activity(uuid, uuid, timestamptz, int, int, int, text, text, text, text, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- update_activity (replaces 009)
-- ---------------------------------------------------------------------------
drop function if exists public.update_activity(uuid, uuid, uuid, timestamptz, int, int, int);

create or replace function public.update_activity(
  p_activity_id       uuid,
  p_type_id           uuid,
  p_place_id          uuid,
  p_starts_at         timestamptz,
  p_duration_min      int default 60,
  p_capacity          int default 6,
  p_min_people        int default 2,
  p_title             text default null,
  p_photo_path        text default null,
  p_location_name     text default null,
  p_location_address  text default null,
  p_location_lat      double precision default null,
  p_location_lng      double precision default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_act     public.activities%rowtype;
  v_joined  int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_act from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;
  if v_act.created_by is distinct from v_user then
    raise exception 'NOT_CREATOR';
  end if;
  if v_act.status <> 'open' then
    raise exception 'ACTIVITY_CLOSED';
  end if;
  if now() >= v_act.starts_at then
    raise exception 'ACTIVITY_STARTED';
  end if;

  if not exists (select 1 from public.activity_types where id = p_type_id) then
    raise exception 'INVALID_TYPE';
  end if;
  -- Keeping the photo already on the activity is always allowed.
  perform public.check_activity_details(
    v_user, p_place_id, p_title,
    case when p_photo_path is not distinct from v_act.photo_path then null else p_photo_path end,
    p_location_name, p_location_lat, p_location_lng);
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'INVALID_TIME';
  end if;
  if p_duration_min is null or p_duration_min not between 15 and 240 then
    raise exception 'INVALID_DURATION';
  end if;
  if p_capacity is null or p_capacity not between 2 and 20
     or p_min_people is null or p_min_people not between 1 and p_capacity then
    raise exception 'INVALID_CAPACITY';
  end if;

  select count(*) into v_joined
  from public.participants
  where activity_id = p_activity_id and status in ('joined', 'confirmed');
  if p_capacity < v_joined then
    raise exception 'CAPACITY_BELOW_JOINED';
  end if;

  update public.activities
  set type_id          = p_type_id,
      place_id         = p_place_id,
      starts_at        = p_starts_at,
      duration_min     = p_duration_min,
      capacity         = p_capacity,
      min_people       = p_min_people,
      title            = nullif(trim(p_title), ''),
      photo_path       = p_photo_path,
      location_name    = case when p_location_lat is not null then trim(p_location_name) end,
      location_address = case when p_location_lat is not null then nullif(trim(p_location_address), '') end,
      location_lat     = p_location_lat,
      location_lng     = p_location_lng
  where id = p_activity_id;

  return json_build_object(
    'activity_id',       p_activity_id,
    'participant_count', v_joined,
    'spots_left',        p_capacity - v_joined
  );
end;
$$;

revoke execute on function public.update_activity(uuid, uuid, uuid, timestamptz, int, int, int, text, text, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.update_activity(uuid, uuid, uuid, timestamptz, int, int, int, text, text, text, text, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- "We're here" (008): measure from the custom pin when there is one
-- ---------------------------------------------------------------------------
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
  v_lat        double precision;
  v_lng        double precision;
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

    if v_act.location_lat is not null then
      v_lat := v_act.location_lat;
      v_lng := v_act.location_lng;
    else
      select lat, lng into v_lat, v_lng from public.places where id = v_act.place_id;
    end if;
    if v_lat is not null and v_lng is not null then
      v_distance := round(public.distance_m(p_lat, p_lng, v_lat, v_lng));
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

notify pgrst, 'reload schema';
