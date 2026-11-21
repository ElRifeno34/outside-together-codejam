-- Synthetic Montréal fixtures for the local demo. Replace them with verified venues before a live demo.
insert into auth.users (id, email)
values ('d1000000-0000-4000-8000-000000000001', 'demo-owner@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('d1000000-0000-4000-8000-000000000001', 'Demo organizer')
on conflict (id) do nothing;

insert into public.places (id, name, address, lat, lng, is_public) values
  ('e90b37b0-532d-4eb1-985a-486dcb977930', 'Demo campus court', 'Montréal · QA fixture', 45.5000, -73.5700, true),
  ('71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 'Demo public square', 'Montréal · QA fixture', 45.5010, -73.5710, true),
  ('4f1db342-dc7b-444b-a16d-668ed95245e5', 'Private QA venue', 'Montréal · QA fixture', 45.5020, -73.5720, false)
on conflict (id) do nothing;

insert into public.activity_types (id, name, niche_value, keywords) values
  ('a1000000-0000-4000-8000-000000000001', 'Walk', 1, '{"walk","balade","marche"}'),
  ('a1000000-0000-4000-8000-000000000002', 'Basketball', 1, '{"basketball","basket"}'),
  ('a1000000-0000-4000-8000-000000000003', 'Study outside', 2, '{"study","étude","réviser"}'),
  ('a1000000-0000-4000-8000-000000000004', 'Chess', 3, '{"chess","échecs"}'),
  ('a1000000-0000-4000-8000-000000000005', 'Photo walk', 4, '{"photography","photo"}'),
  ('a1000000-0000-4000-8000-000000000006', 'Urban sketching', 5, '{"sketch","dessin"}')
on conflict (id) do nothing;

with fixtures (seq, type_number, place_id, slot_hours, capacity) as (
  values
    (1, 2, 'e90b37b0-532d-4eb1-985a-486dcb977930'::uuid, 2, 6),
    (2, 1, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 3, 6),
    (3, 3, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 4, 4),
    (4, 4, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 5, 4),
    (5, 5, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 6, 6),
    (6, 6, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 7, 4),
    (7, 2, 'e90b37b0-532d-4eb1-985a-486dcb977930', 24, 8),
    (8, 3, '71b3c1b1-a0c8-4643-9f41-139f1a7e2f5e', 26, 5)
), seeded as (
  insert into public.activities (id, type_id, place_id, starts_at, capacity, created_by)
  select ('b1000000-0000-4000-8000-' || lpad(seq::text,12,'0'))::uuid,
    ('a1000000-0000-4000-8000-' || lpad(type_number::text,12,'0'))::uuid,
    place_id, date_trunc('hour', now()) + make_interval(hours => slot_hours),
    capacity, 'd1000000-0000-4000-8000-000000000001'
  from fixtures
  on conflict (id) do nothing
  returning id, created_by
)
insert into public.participants (activity_id, user_id)
select id, created_by from seeded;
