-- 014_trottier_niche_6.sql — allow niche level 6 for places, add McGill's Trottier Building
--
-- Run once, after 001–013. Places to visit may now go up to niche 6 (worth 10 + 5 × 6 = 40
-- points). Activity types keep their 1–5 scale.

alter table public.spots drop constraint if exists spots_niche_value_check;
alter table public.spots add constraint spots_niche_value_check check (niche_value between 1 and 6);

-- Coordinates from OpenStreetMap (Trottier Building, 3630 rue University).
insert into public.spots (id, name, description, area, lat, lng, niche_value, photo) values
  ('5b070000-0000-4000-8000-000000000022', 'Trottier Building · McGill',
   'McGill''s computer science and engineering building on University Street.',
   'Ville-Marie', 45.50738, -73.57903, 6, 'study')
on conflict (id) do nothing;
