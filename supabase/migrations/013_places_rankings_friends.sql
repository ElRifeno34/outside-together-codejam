-- 013_places_rankings_friends.sql — places to visit, neighbourhood/world/friends rankings
--
-- Run once, after 001–012.
--
-- Places to visit ("spots") are a catalogue of their own, independent of activities.
-- Visiting one (phone within 200 m) earns 10 + 5 × niche_value points, once per spot
-- per person. Points go into profiles.total_points, like activity points.
--
-- Rankings: by Montréal borough or suburb (profiles.area, chosen by each person),
-- worldwide (everyone), and between friends. Friends are added with a private friend
-- code; adding someone's code makes you friends both ways.
--
-- Front end:
--   supabase.from('spots').select('*')
--   supabase.from('spot_visits').select('spot_id, points, visited_at')        -- own visits only
--   supabase.rpc('visit_spot', { p_spot_id, p_lat, p_lng, p_accuracy_m })
--   supabase.from('areas').select('*');  supabase.from('profiles').update({ area }).eq('id', me)
--   supabase.rpc('get_leaderboard', { p_scope: 'world' | 'area' | 'friends', p_area })
--   supabase.rpc('my_friend_code'); supabase.rpc('add_friend', { p_code }); supabase.rpc('remove_friend', { p_friend_id })

-- ---------------------------------------------------------------------------
-- Areas: Montréal boroughs and the suburbs around them
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  name  text primary key,
  kind  text not null check (kind in ('borough', 'suburb'))
);

insert into public.areas (name, kind) values
  ('Ahuntsic-Cartierville', 'borough'),
  ('Anjou', 'borough'),
  ('Côte-des-Neiges–Notre-Dame-de-Grâce', 'borough'),
  ('Lachine', 'borough'),
  ('LaSalle', 'borough'),
  ('L''Île-Bizard–Sainte-Geneviève', 'borough'),
  ('Mercier–Hochelaga-Maisonneuve', 'borough'),
  ('Montréal-Nord', 'borough'),
  ('Outremont', 'borough'),
  ('Pierrefonds-Roxboro', 'borough'),
  ('Le Plateau-Mont-Royal', 'borough'),
  ('Rivière-des-Prairies–Pointe-aux-Trembles', 'borough'),
  ('Rosemont–La Petite-Patrie', 'borough'),
  ('Saint-Laurent', 'borough'),
  ('Saint-Léonard', 'borough'),
  ('Le Sud-Ouest', 'borough'),
  ('Verdun', 'borough'),
  ('Ville-Marie', 'borough'),
  ('Villeray–Saint-Michel–Parc-Extension', 'borough'),
  ('Baie-D''Urfé', 'suburb'),
  ('Beaconsfield', 'suburb'),
  ('Côte-Saint-Luc', 'suburb'),
  ('Dollard-des-Ormeaux', 'suburb'),
  ('Dorval', 'suburb'),
  ('Hampstead', 'suburb'),
  ('Kirkland', 'suburb'),
  ('Montréal-Est', 'suburb'),
  ('Montréal-Ouest', 'suburb'),
  ('Mont-Royal', 'suburb'),
  ('Pointe-Claire', 'suburb'),
  ('Sainte-Anne-de-Bellevue', 'suburb'),
  ('Senneville', 'suburb'),
  ('Westmount', 'suburb'),
  ('Laval', 'suburb'),
  ('Longueuil', 'suburb'),
  ('Brossard', 'suburb'),
  ('Saint-Lambert', 'suburb'),
  ('Boucherville', 'suburb'),
  ('Terrebonne', 'suburb'),
  ('Repentigny', 'suburb'),
  ('Châteauguay', 'suburb'),
  ('La Prairie', 'suburb'),
  ('Candiac', 'suburb'),
  ('Vaudreuil-Dorion', 'suburb')
on conflict (name) do nothing;

alter table public.areas enable row level security;
drop policy if exists "areas are public" on public.areas;
create policy "areas are public" on public.areas for select to anon, authenticated using (true);
grant select on public.areas to anon, authenticated;

-- Each person picks their own area (profiles are public, so it shows in rankings).
alter table public.profiles add column if not exists area text references public.areas (name);
grant update (area) on public.profiles to authenticated;   -- "users update own profile" limits it to their row

-- ---------------------------------------------------------------------------
-- Spots: places to visit, independent of activities
-- ---------------------------------------------------------------------------
create table if not exists public.spots (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null,
  area         text references public.areas (name),
  lat          double precision not null,
  lng          double precision not null,
  niche_value  int  not null check (niche_value between 1 and 5),
  photo        text not null default 'walk',
  is_active    boolean not null default true
);

alter table public.spots enable row level security;
drop policy if exists "spots are public" on public.spots;
create policy "spots are public" on public.spots for select to anon, authenticated using (is_active);
grant select on public.spots to anon, authenticated;

-- Coordinates from OpenStreetMap (Nominatim), checked by name.
insert into public.spots (id, name, description, area, lat, lng, niche_value, photo) values
  ('5b070000-0000-4000-8000-000000000001', 'Belvédère Kondiaronk', 'The classic downtown view from the top of Mont Royal.', 'Ville-Marie', 45.50353, -73.58705, 1, 'sunset'),
  ('5b070000-0000-4000-8000-000000000002', 'Marché Jean-Talon', 'Montréal''s big open-air market: stalls, smells and seasonal colour.', 'Rosemont–La Petite-Patrie', 45.53591, -73.61506, 1, 'coffee'),
  ('5b070000-0000-4000-8000-000000000003', 'Place Jacques-Cartier', 'The cobbled heart of Old Montréal, street performers included.', 'Ville-Marie', 45.50794, -73.55296, 1, 'photo'),
  ('5b070000-0000-4000-8000-000000000004', 'Marché Atwater', 'Art deco market hall right next to the Lachine Canal.', 'Le Sud-Ouest', 45.47964, -73.57678, 1, 'coffee'),
  ('5b070000-0000-4000-8000-000000000005', 'Square Dorchester', 'A green downtown square framed by old stone and glass towers.', 'Ville-Marie', 45.49958, -73.57089, 1, 'walk'),
  ('5b070000-0000-4000-8000-000000000006', 'Lac aux Castors', 'The quiet pond on the mountain: ducks in summer, skates in winter.', 'Ville-Marie', 45.49871, -73.59742, 2, 'picnic'),
  ('5b070000-0000-4000-8000-000000000007', 'Tour de l''Horloge', 'The clock tower at the end of the Old Port, facing the river.', 'Ville-Marie', 45.51224, -73.54570, 2, 'photo'),
  ('5b070000-0000-4000-8000-000000000008', 'Oratoire Saint-Joseph', 'Climb the long stairs for one of the widest views in the city.', 'Côte-des-Neiges–Notre-Dame-de-Grâce', 45.49205, -73.61670, 2, 'walk'),
  ('5b070000-0000-4000-8000-000000000009', 'Plage de Verdun', 'An urban beach on the St. Lawrence, a short walk from the métro.', 'Verdun', 45.46229, -73.56024, 2, 'sunset'),
  ('5b070000-0000-4000-8000-000000000010', 'Parc Sir-Wilfrid-Laurier', 'The Plateau''s neighbourhood park: chess tables, dogs and picnics.', 'Le Plateau-Mont-Royal', 45.53208, -73.58785, 2, 'chess'),
  ('5b070000-0000-4000-8000-000000000011', 'Croix du Mont-Royal', 'The illuminated cross at the summit, up a quieter forest path.', 'Ville-Marie', 45.50884, -73.58790, 3, 'walk'),
  ('5b070000-0000-4000-8000-000000000012', 'Biosphère', 'Buckminster Fuller''s geodesic dome from Expo 67 on Île Sainte-Hélène.', 'Ville-Marie', 45.51409, -73.53143, 3, 'photo'),
  ('5b070000-0000-4000-8000-000000000013', 'Habitat 67', 'Moshe Safdie''s stacked concrete homes on the Cité du Havre.', 'Ville-Marie', 45.49988, -73.54379, 3, 'sketch'),
  ('5b070000-0000-4000-8000-000000000014', 'Parc Molson', 'A small Rosemont square with fountains and long summer evenings.', 'Rosemont–La Petite-Patrie', 45.54939, -73.59244, 3, 'picnic'),
  ('5b070000-0000-4000-8000-000000000015', 'Champ des Possibles', 'A wild, community-kept meadow beside the Mile End rail tracks.', 'Le Plateau-Mont-Royal', 45.52834, -73.59697, 4, 'bird'),
  ('5b070000-0000-4000-8000-000000000016', 'Parc Frédéric-Back', 'A former quarry and landfill turned into a huge park in Saint-Michel.', 'Villeray–Saint-Michel–Parc-Extension', 45.56282, -73.61956, 4, 'walk'),
  ('5b070000-0000-4000-8000-000000000017', 'Gibeau Orange Julep', 'The giant orange on Décarie, a roadside landmark since the 1940s.', 'Côte-des-Neiges–Notre-Dame-de-Grâce', 45.49572, -73.65678, 4, 'photo'),
  ('5b070000-0000-4000-8000-000000000018', 'Parc des Rapides', 'Watch the Lachine Rapids and the herons from the LaSalle shore.', 'LaSalle', 45.42627, -73.59581, 5, 'bird'),
  ('5b070000-0000-4000-8000-000000000019', 'Maison du Pressoir', 'An 18th-century cider-press house on the Île de la Visitation.', 'Ahuntsic-Cartierville', 45.57601, -73.65960, 5, 'sketch'),
  ('5b070000-0000-4000-8000-000000000020', 'Promenade Bellerive', 'A long riverside promenade in the east end, with islands offshore.', 'Mercier–Hochelaga-Maisonneuve', 45.59501, -73.50919, 5, 'sunset'),
  ('5b070000-0000-4000-8000-000000000021', 'Parc du Bout-de-l''Île', 'The very eastern tip of the island, where two rivers meet.', 'Rivière-des-Prairies–Pointe-aux-Trembles', 45.70176, -73.47811, 5, 'bird')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Visits: one reward per spot per person
-- ---------------------------------------------------------------------------
create table if not exists public.spot_visits (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  spot_id      uuid not null references public.spots (id) on delete cascade,
  visited_at   timestamptz not null default now(),
  points       int  not null check (points > 0),
  distance_m   int,
  accuracy_m   double precision,
  primary key (user_id, spot_id)
);

alter table public.spot_visits enable row level security;
drop policy if exists "see own visits" on public.spot_visits;
create policy "see own visits" on public.spot_visits for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.spot_visits to authenticated;

create or replace function public.visit_spot(
  p_spot_id     uuid,
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
  v_max_m     constant int := 200;
  v_user      uuid := auth.uid();
  v_spot      public.spots%rowtype;
  v_distance  int;
  v_points    int;
  v_total     int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_spot from public.spots where id = p_spot_id and is_active;
  if not found then
    raise exception 'SPOT_NOT_FOUND';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'LOCATION_REQUIRED';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_LOCATION';
  end if;
  if exists (select 1 from public.spot_visits where user_id = v_user and spot_id = p_spot_id) then
    raise exception 'ALREADY_VISITED';
  end if;

  v_distance := round(public.distance_m(p_lat, p_lng, v_spot.lat, v_spot.lng));
  if v_distance > v_max_m then
    raise exception 'TOO_FAR_FROM_SPOT (% m)', v_distance;
  end if;

  v_points := public.points_for(v_spot.niche_value);   -- 10 + 5 × niche_value
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.spot_visits (user_id, spot_id, points, distance_m, accuracy_m)
  values (v_user, p_spot_id, v_points, v_distance, p_accuracy_m);
  update public.profiles set total_points = total_points + v_points
  where id = v_user
  returning total_points into v_total;

  return json_build_object(
    'spot_id',        p_spot_id,
    'points_earned',  v_points,
    'total_points',   v_total,
    'distance_m',     v_distance
  );
end;
$$;

revoke execute on function public.visit_spot(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.visit_spot(uuid, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Friends: private codes, mutual friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friend_codes (
  user_id  uuid primary key references public.profiles (id) on delete cascade,
  code     text not null unique
);
alter table public.friend_codes enable row level security;   -- no policies: only the RPCs below read it
revoke all on public.friend_codes from public, anon, authenticated;

create table if not exists public.friendships (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  friend_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.friendships to authenticated;

-- Your own friend code (created on first use). 6 characters, no 0/O/1/I to avoid typos.
create or replace function public.my_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_code  text;
  v_abc   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select code into v_code from public.friend_codes where user_id = v_user;
  if v_code is not null then
    return v_code;
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  loop
    v_code := (select string_agg(substr(v_abc, 1 + floor(random() * length(v_abc))::int, 1), '')
               from generate_series(1, 6));
    begin
      insert into public.friend_codes (user_id, code) values (v_user, v_code);
      return v_code;
    exception when unique_violation then
      -- Same code taken (or a parallel call created ours): read ours, else try another.
      select code into v_code from public.friend_codes where user_id = v_user;
      if v_code is not null then
        return v_code;
      end if;
    end;
  end loop;
end;
$$;

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
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.friendships (user_id, friend_id) values (v_user, v_friend), (v_friend, v_user)
  on conflict do nothing;
  select display_name into v_name from public.profiles where id = v_friend;
  return json_build_object('friend_id', v_friend, 'display_name', v_name);
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
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
  delete from public.friendships
  where (user_id = v_user and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = v_user);
end;
$$;

revoke execute on function public.my_friend_code() from public, anon;
revoke execute on function public.add_friend(text) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.my_friend_code() to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard: top 50 of a scope, plus your own row when you're further down
--   p_scope = 'world'   everyone
--   p_scope = 'area'    people in p_area (default: your own area)
--   p_scope = 'friends' you and your friends (sign-in required)
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_scope text, p_area text default null)
returns table (
  rank          int,
  user_id       uuid,
  display_name  text,
  area          text,
  total_points  int,
  is_me         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_area  text;
begin
  if p_scope not in ('world', 'area', 'friends') then
    raise exception 'INVALID_SCOPE';
  end if;
  if p_scope = 'friends' and v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_scope = 'area' then
    v_area := coalesce(p_area, (select p.area from public.profiles p where p.id = v_user));
    if v_area is null then
      return;   -- no area chosen yet: empty list, the screen asks for one
    end if;
  end if;

  return query
  with base as (
    select p.id, p.display_name, p.area, p.total_points
    from public.profiles p
    where case p_scope
            when 'world' then true
            when 'area' then p.area = v_area
            else p.id = v_user
                 or p.id in (select f.friend_id from public.friendships f where f.user_id = v_user)
          end
  ),
  ranked as (
    select b.*, rank() over (order by b.total_points desc)::int as r,
           row_number() over (order by b.total_points desc, b.display_name, b.id) as n
    from base b
  )
  select r, id, ranked.display_name, ranked.area, ranked.total_points, (id = v_user)
  from ranked
  where n <= 50 or id = v_user
  order by n;
end;
$$;

revoke execute on function public.get_leaderboard(text, text) from public;
grant execute on function public.get_leaderboard(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
