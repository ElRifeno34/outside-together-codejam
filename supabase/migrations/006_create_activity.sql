-- 006_create_activity.sql — create an activity and auto-join the creator
--
-- Used for the "no match → create it" path. Role C's create-activity Edge Function
-- (or the front end directly) calls this with the draft returned by ai-search:
--   supabase.rpc('create_activity', {
--     p_type_id, p_place_id, p_starts_at, p_duration_min, p_capacity, p_min_people
--   })
-- The Edge Function must forward the user's JWT so auth.uid() is the creator.

create or replace function public.create_activity(
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
  v_user  uuid := auth.uid();
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
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

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.activities (type_id, place_id, starts_at, duration_min, capacity, min_people, created_by)
  values (p_type_id, p_place_id, p_starts_at, p_duration_min, p_capacity, p_min_people, v_user)
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

grant execute on function public.create_activity(uuid, uuid, timestamptz, int, int, int) to anon, authenticated;
