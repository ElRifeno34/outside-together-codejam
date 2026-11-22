-- 016_delete_activity.sql — the creator can delete their activity before it starts
--
-- Run once, after 001–015.
--   * only the creator                          → NOT_CREATOR
--   * only before it starts and while not done  → DELETE_TOO_LATE
--     (after the start, points may have been awarded; deleting would leave totals wrong)
-- Participants' registrations are removed with it (on delete cascade). Returns the
-- photo path so the app can remove the uploaded photo from storage.
--
-- Front end:  supabase.rpc('delete_activity', { p_activity_id })

create or replace function public.delete_activity(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_act     public.activities%rowtype;
  v_others  int;
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
  if v_act.status = 'done' or now() >= v_act.starts_at then
    raise exception 'DELETE_TOO_LATE';
  end if;

  select count(*) into v_others
  from public.participants
  where activity_id = p_activity_id and user_id <> v_user and status in ('joined', 'confirmed');

  delete from public.activities where id = p_activity_id;

  return json_build_object(
    'activity_id',     p_activity_id,
    'others_removed',  v_others,
    'photo_path',      v_act.photo_path
  );
end;
$$;

revoke execute on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;

notify pgrst, 'reload schema';
