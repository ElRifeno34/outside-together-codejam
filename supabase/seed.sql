-- seed.sql — development catalogue and upcoming activities for the Role B schema (001–007)
--
-- Paste into the Supabase SQL editor and press Run. It also runs on `supabase db reset`.
--
-- What it writes (nothing else):
--   * 16 activity types         fixed ids 7e000000-0000-4000-8000-0000000000NN  (NN = 01–16)
--   * 10 public Montréal places fixed ids 91ace000-0000-4000-8000-0000000000NN  (NN = 01–10)
--   * 14 one-hour activities    fixed ids ac700000-0000-4000-8000-0000000000NN  (NN = 01–14)
--     scheduled over the next 3 days in Montréal time, created_by = null, no participants
--     (real accounts join through the app)
-- It never touches auth.users, profiles, participants or points, and changes no schema.
--
-- Places are well-known public parks, squares and promenades. Addresses and coordinates are
-- approximate public landmark locations (no residences, no private venues).
--
-- Safe to re-run:
--   * every row has a fixed id: a row whose id already exists is skipped;
--   * types and places are also skipped when a row with the same name exists;
--   * an activity is also skipped when one with the same type, place and start time exists;
--   * an activity slot that is already in the past is skipped.
-- A second run therefore inserts nothing. Because the activity ids are fixed, re-running on a
-- later day does NOT add fresh activities: to refresh the board, run the rollback below and
-- then this seed again. Rollback SQL is at the bottom of this file.

begin;

-- 1. Activity types (keywords match the frontend's pictogram/photo mapping)
insert into public.activity_types (id, name, niche_value, keywords) values
  ('7e000000-0000-4000-8000-000000000001', 'Walk',                   1, '{"walk","balade","marche"}'),
  ('7e000000-0000-4000-8000-000000000002', 'Basketball',             1, '{"basketball","basket"}'),
  ('7e000000-0000-4000-8000-000000000003', 'Picnic',                 1, '{"picnic","pique-nique"}'),
  ('7e000000-0000-4000-8000-000000000004', 'Coffee & a stroll',      1, '{"coffee","café","cafe"}'),
  ('7e000000-0000-4000-8000-000000000005', 'Easy jog',               1, '{"jog","course","courir"}'),
  ('7e000000-0000-4000-8000-000000000006', 'Study outside',          2, '{"study","étude","réviser"}'),
  ('7e000000-0000-4000-8000-000000000007', 'Watch the sunset',       2, '{"sunset","coucher de soleil"}'),
  ('7e000000-0000-4000-8000-000000000008', 'Neighbourhood wander',   2, '{"neighbourhood","quartier","ruelle"}'),
  ('7e000000-0000-4000-8000-000000000009', 'Chess',                  3, '{"chess","échecs"}'),
  ('7e000000-0000-4000-8000-000000000010', 'Birdwatching',           3, '{"birdwatch","oiseaux","ornithologie"}'),
  ('7e000000-0000-4000-8000-000000000011', 'Photo walk',             4, '{"photography","photo"}'),
  ('7e000000-0000-4000-8000-000000000012', 'Geocaching',             4, '{"geocach","géocach","treasure","trésor"}'),
  ('7e000000-0000-4000-8000-000000000013', 'Park origami',           4, '{"origami","paper folding","pliage"}'),
  ('7e000000-0000-4000-8000-000000000014', 'Urban sketching',        5, '{"sketch","dessin"}'),
  ('7e000000-0000-4000-8000-000000000015', 'Moss & lichen spotting', 5, '{"moss","lichen","mousse"}'),
  ('7e000000-0000-4000-8000-000000000016', 'City sound safari',      5, '{"sound","sonore","écoute","ecoute"}')
on conflict do nothing;

-- 2. Public places
insert into public.places (id, name, address, lat, lng, is_public)
select v.id::uuid, v.name, v.address, v.lat, v.lng, true
from (values
  ('91ace000-0000-4000-8000-000000000001', 'Parc La Fontaine',                     '3819 Av. Calixa-Lavallée, Montréal',     45.5260, -73.5690),
  ('91ace000-0000-4000-8000-000000000002', 'Parc Jeanne-Mance courts',             'Av. du Parc & Rue Duluth, Montréal',     45.5155, -73.5835),
  ('91ace000-0000-4000-8000-000000000003', 'Place Émilie-Gamelin',                 '1500 Rue Berri, Montréal',               45.5150, -73.5590),
  ('91ace000-0000-4000-8000-000000000004', 'Parc du Mont-Royal',                   '1260 Chem. Remembrance, Montréal',       45.5040, -73.5870),
  ('91ace000-0000-4000-8000-000000000005', 'Old Port of Montréal',                 '333 Rue de la Commune Ouest, Montréal',  45.5050, -73.5500),
  ('91ace000-0000-4000-8000-000000000006', 'Lachine Canal · Atwater footbridge',   'Passerelle du marché Atwater, Montréal', 45.4790, -73.5760),
  ('91ace000-0000-4000-8000-000000000007', 'Parc Jarry',                           '205 Rue Gary-Carter, Montréal',          45.5350, -73.6280),
  ('91ace000-0000-4000-8000-000000000008', 'Square Saint-Louis',                   'Rue Saint-Denis & Av. Laval, Montréal',  45.5170, -73.5700),
  ('91ace000-0000-4000-8000-000000000009', 'Parc de l’Honorable-George-O’Reilly',  'Bd LaSalle, Verdun, Montréal',           45.4510, -73.5690),
  ('91ace000-0000-4000-8000-000000000010', 'Promenade Fleuve-Montagne',            'Place d’Armes, Montréal',                45.5050, -73.5570)
) as v(id, name, address, lat, lng)
where not exists (select 1 from public.places p where p.name = v.name)
on conflict (id) do nothing;

-- 3. Upcoming activities, scheduled in Montréal local time relative to the day the seed runs
insert into public.activities (id, type_id, place_id, starts_at, duration_min, capacity, min_people, created_by)
select v.id::uuid, t.id, p.id, s.starts_at, 60, v.capacity, v.min_people, null
from (values
  -- fixed id,                              day, local time, activity type,  place,                                 capacity, minimum
  ('ac700000-0000-4000-8000-000000000001', 0, '20:00', 'City sound safari',      'Old Port of Montréal',                  6, 2),
  ('ac700000-0000-4000-8000-000000000002', 1, '09:30', 'Birdwatching',           'Parc du Mont-Royal',                    6, 2),
  ('ac700000-0000-4000-8000-000000000003', 1, '11:00', 'Coffee & a stroll',      'Square Saint-Louis',                    6, 2),
  ('ac700000-0000-4000-8000-000000000004', 1, '14:00', 'Basketball',             'Parc Jeanne-Mance courts',             10, 4),
  ('ac700000-0000-4000-8000-000000000005', 1, '15:45', 'Watch the sunset',       'Parc de l’Honorable-George-O’Reilly',   8, 2),
  ('ac700000-0000-4000-8000-000000000006', 2, '07:30', 'Easy jog',               'Lachine Canal · Atwater footbridge',    8, 2),
  ('ac700000-0000-4000-8000-000000000007', 2, '12:15', 'Walk',                   'Parc La Fontaine',                      6, 2),
  ('ac700000-0000-4000-8000-000000000008', 2, '12:30', 'Chess',                  'Place Émilie-Gamelin',                  4, 2),
  ('ac700000-0000-4000-8000-000000000009', 2, '17:30', 'Neighbourhood wander',   'Promenade Fleuve-Montagne',             6, 2),
  ('ac700000-0000-4000-8000-000000000010', 3, '10:00', 'Photo walk',             'Old Port of Montréal',                  6, 2),
  ('ac700000-0000-4000-8000-000000000011', 3, '13:00', 'Study outside',          'Parc Jarry',                            6, 2),
  ('ac700000-0000-4000-8000-000000000012', 3, '14:00', 'Moss & lichen spotting', 'Parc du Mont-Royal',                    6, 2),
  ('ac700000-0000-4000-8000-000000000013', 3, '15:00', 'Urban sketching',        'Square Saint-Louis',                    5, 2),
  ('ac700000-0000-4000-8000-000000000014', 3, '16:00', 'Geocaching',             'Parc La Fontaine',                      6, 2)
) as v(id, day_offset, local_time, type_name, place_name, capacity, min_people)
cross join lateral (
  select (date_trunc('day', now() at time zone 'America/Toronto')
          + make_interval(days => v.day_offset)
          + v.local_time::interval) at time zone 'America/Toronto' as starts_at
) s
join public.activity_types t on t.name = v.type_name
join public.places p on p.name = v.place_name and p.is_public
where s.starts_at > now()
  and not exists (
    select 1 from public.activities a
    where a.type_id = t.id and a.place_id = p.id and a.starts_at = s.starts_at
  )
on conflict (id) do nothing;

commit;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually, only if you want to undo this seed). Kept commented out.
--
-- Deletes ONLY rows whose ids are in this seed's fixed id lists:
--   * the 14 seeded activities (their own participants/points rows go with them through the
--     schema's ON DELETE CASCADE; no other activity's rows are touched);
--   * the seeded types and places, and only those no remaining activity references
--     (so a real activity created at a seeded place keeps that place and its type).
-- It never deletes or updates auth.users, profiles, user-created activities or schema objects.
-- Note: profiles.total_points is left as is. If test accounts earned points on a seeded
-- activity, those points rows disappear with it but the profile totals are not reduced.
--
-- begin;
-- delete from public.activities a
--   where a.id in (
--     'ac700000-0000-4000-8000-000000000001', 'ac700000-0000-4000-8000-000000000002',
--     'ac700000-0000-4000-8000-000000000003', 'ac700000-0000-4000-8000-000000000004',
--     'ac700000-0000-4000-8000-000000000005', 'ac700000-0000-4000-8000-000000000006',
--     'ac700000-0000-4000-8000-000000000007', 'ac700000-0000-4000-8000-000000000008',
--     'ac700000-0000-4000-8000-000000000009', 'ac700000-0000-4000-8000-000000000010',
--     'ac700000-0000-4000-8000-000000000011', 'ac700000-0000-4000-8000-000000000012',
--     'ac700000-0000-4000-8000-000000000013', 'ac700000-0000-4000-8000-000000000014');
-- delete from public.activity_types t
--   where t.id in (
--     '7e000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000002',
--     '7e000000-0000-4000-8000-000000000003', '7e000000-0000-4000-8000-000000000004',
--     '7e000000-0000-4000-8000-000000000005', '7e000000-0000-4000-8000-000000000006',
--     '7e000000-0000-4000-8000-000000000007', '7e000000-0000-4000-8000-000000000008',
--     '7e000000-0000-4000-8000-000000000009', '7e000000-0000-4000-8000-000000000010',
--     '7e000000-0000-4000-8000-000000000011', '7e000000-0000-4000-8000-000000000012',
--     '7e000000-0000-4000-8000-000000000013', '7e000000-0000-4000-8000-000000000014',
--     '7e000000-0000-4000-8000-000000000015', '7e000000-0000-4000-8000-000000000016')
--     and not exists (select 1 from public.activities a where a.type_id = t.id);
-- delete from public.places pl
--   where pl.id in (
--     '91ace000-0000-4000-8000-000000000001', '91ace000-0000-4000-8000-000000000002',
--     '91ace000-0000-4000-8000-000000000003', '91ace000-0000-4000-8000-000000000004',
--     '91ace000-0000-4000-8000-000000000005', '91ace000-0000-4000-8000-000000000006',
--     '91ace000-0000-4000-8000-000000000007', '91ace000-0000-4000-8000-000000000008',
--     '91ace000-0000-4000-8000-000000000009', '91ace000-0000-4000-8000-000000000010')
--     and not exists (select 1 from public.activities a where a.place_id = pl.id);
-- commit;
