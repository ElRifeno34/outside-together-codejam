-- 007_security_hardening.sql — creator privacy, tighter grants, faster RLS
--
-- Run once, after 001–006. Safe to re-run (drop-if-exists / alter / grant / revoke only).
-- No change to join / leave / confirm / points / capacity / create behavior.

-- ---------------------------------------------------------------------------
-- PART 1: activity_board without the creator's user id
--
-- Same definition as deployed by 003, except a.created_by is replaced by is_mine
-- (true for the caller's own activities, false for others', null when logged out
-- or for seeded activities).
--
-- security_invoker is deliberately OFF: the view runs with its owner's rights so
-- participant_count / spots_left / is_full count everyone's rows. Under the
-- caller's RLS, anon would see 0 participants and users only their own row.
-- The view exposes aggregate counts only, never who the participants are.
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
  p.name                                            as place_name,
  p.address                                         as place_address,
  p.lat,
  p.lng,
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
  me.status                                         as my_status
from public.activities a
join public.activity_types t on t.id = a.type_id
join public.places p         on p.id = a.place_id
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
-- PART 2: browser roles can read every activities column except created_by
-- (SECURITY DEFINER functions and the view run as the owner: unaffected)
-- ---------------------------------------------------------------------------
revoke select on public.activities from anon, authenticated;
grant select (id, type_id, place_id, starts_at, duration_min, capacity,
              min_people, status, created_at)
  on public.activities to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART 3: function execution
-- ---------------------------------------------------------------------------
-- App RPCs: logged-in users only
revoke execute on function public.join_activity(uuid)      from public, anon;
revoke execute on function public.leave_activity(uuid)     from public, anon;
revoke execute on function public.confirm_attendance(uuid) from public, anon;
revoke execute on function public.create_activity(uuid, uuid, timestamptz, int, int, int) from public, anon;

grant execute on function public.join_activity(uuid)      to authenticated;
grant execute on function public.leave_activity(uuid)     to authenticated;
grant execute on function public.confirm_attendance(uuid) to authenticated;
grant execute on function public.create_activity(uuid, uuid, timestamptz, int, int, int) to authenticated;

-- Trigger function: never callable directly. The auth.users trigger still fires
-- (EXECUTE is only checked when a trigger is created, not when it runs).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- points_for is called inside activity_board, and Postgres checks EXECUTE on
-- functions in a view as the *caller*, so anon and authenticated need it.
-- It's a pure formula (no data access, not SECURITY DEFINER). Drop PUBLIC only.
revoke execute on function public.points_for(int) from public;
grant execute on function public.points_for(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART 4: evaluate auth.uid() once per query instead of once per row
-- (same conditions as 003, so identical authorization)
-- ---------------------------------------------------------------------------
alter policy "users update own profile" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy "see own participations" on public.participants
  using (user_id = (select auth.uid()));

alter policy "see own points" on public.points
  using (user_id = (select auth.uid()));
