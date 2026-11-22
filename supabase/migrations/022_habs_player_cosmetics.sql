-- 022_habs_player_cosmetics.sql — player-style season cosmetics (numbers, no names)
--
-- Run once, after 001–021. Adds four season-exclusive cosmetics on tiers 3, 8, 13 and 18
-- (those tiers keep their credits too).
--
-- Real players' names and likenesses need a licence (NHL / NHLPA). These items use jersey
-- numbers and roles only. Once licensed, rename an item in one line, e.g.:
--   update public.shop_items set name = '<Player> #14 jersey' where id = 'fr-jersey-14';

insert into public.shop_items (id, kind, name, price, sort, purchasable) values
  ('av-captain',     'avatar',      'Captain''s C',      0, 92, false),
  ('ne-sniper-13',   'name_effect', '#13 Sniper',        0, 92, false),
  ('fr-jersey-14',   'frame',       '#14 jersey',        0, 92, false),
  ('bn-home-jersey', 'banner',      'Red home jersey',   0, 92, false)
on conflict (id) do update set purchasable = false, name = excluded.name, kind = excluded.kind;

update public.season_rewards set item_id = 'av-captain'     where season_id = 's1-first-snow' and tier = 3;
update public.season_rewards set item_id = 'ne-sniper-13'   where season_id = 's1-first-snow' and tier = 8;
update public.season_rewards set item_id = 'fr-jersey-14'   where season_id = 's1-first-snow' and tier = 13;
update public.season_rewards set item_id = 'bn-home-jersey' where season_id = 's1-first-snow' and tier = 18;

notify pgrst, 'reload schema';
