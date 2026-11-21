-- 003_rls_and_board.sql — security rules + the public activity board view
--
-- Principle: everyone can READ the catalogue; nobody writes directly from the
-- browser. All writes go through the SQL functions in 004–006 (security definer),
-- or through the service role (seed scripts, Edge Functions).

alter table public.profiles       enable row level security;
alter table public.places         enable row level security;
alter table public.activity_types enable row level security;
alter table public.activities     enable row level security;
alter table public.participants   enable row level security;
alter table public.points         enable row level security;

-- Block direct writes from the browser roles (belt and braces on top of RLS)
revoke insert, update, delete, truncate, references, trigger, maintain on
  public.profiles, public.places, public.activity_types,
  public.activities, public.participants, public.points
from anon, authenticated;

-- Users may rename themselves, and only that column (not total_points)
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Read policies
-- ---------------------------------------------------------------------------
create policy "profiles are public"
  on public.profiles for select to anon, authenticated using (true);

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "places are public"
  on public.places for select to anon, authenticated using (true);

create policy "activity types are public"
  on public.activity_types for select to anon, authenticated using (true);

create policy "activities are public"
  on public.activities for select to anon, authenticated using (true);

-- Participant rows reveal who goes where: only your own rows are readable.
-- Counts are public through activity_board below.
create policy "see own participations"
  on public.participants for select to authenticated using (user_id = auth.uid());

create policy "see own points"
  on public.points for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_board: what the board / activity page / AI search should read.
-- Runs with the owner's rights so it can count participants without exposing
-- who they are. my_status is per caller (null when logged out / not joined).
-- ---------------------------------------------------------------------------
create or replace view public.activity_board as
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
  a.created_by,
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

grant select on public.activity_board to anon, authenticated;

-- Trigger function is internal only
revoke execute on function public.handle_new_user() from public, anon, authenticated;
