-- 009_update_activity.sql — let the creator edit their activity before it starts
--
-- Run once, after 001–008. Same validation as create_activity (006), plus:
--   * only the creator (activities.created_by) may edit       → NOT_CREATOR
--   * only while it is open and hasn't started                → ACTIVITY_CLOSED / ACTIVITY_STARTED
--   * capacity can't drop below the people already registered → CAPACITY_BELOW_JOINED
--
-- Front end:
--   supabase.rpc('update_activity', {
--     p_activity_id, p_type_id, p_place_id, p_starts_at, p_duration_min, p_capacity, p_min_people
--   })

create or replace function public.update_activity(
  p_activity_id   uuid,
  p_type_id       uuid,
  p_place_id      uuid,
  p_starts_at     timestamptz,
  p_duration_min  int default 60,
  p_capacity      int default 6,
  p_min_people    int default 2
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
  if not exists (select 1 from public.places where id = p_place_id and is_public) then
    raise exception 'INVALID_PLACE';
  end if;
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
  set type_id      = p_type_id,
      place_id     = p_place_id,
      starts_at    = p_starts_at,
      duration_min = p_duration_min,
      capacity     = p_capacity,
      min_people   = p_min_people
  where id = p_activity_id;

  return json_build_object(
    'activity_id',       p_activity_id,
    'participant_count', v_joined,
    'spots_left',        p_capacity - v_joined
  );
end;
$$;

revoke execute on function public.update_activity(uuid, uuid, uuid, timestamptz, int, int, int)
  from public, anon;
grant execute on function public.update_activity(uuid, uuid, uuid, timestamptz, int, int, int)
  to authenticated;
