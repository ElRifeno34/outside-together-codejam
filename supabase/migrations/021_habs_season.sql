-- 021_habs_season.sql — Season 1 becomes a Montréal Canadiens (Habs) season
--
-- Run once, after 001–020. Renames Season 1 and swaps its four exclusive rewards
-- (tiers 5, 10, 15, 20) for Habs-themed cosmetics. Credits rewards are unchanged.
-- Anyone who already claimed a First snow item keeps it.
--
-- Note: "Canadiens", "Habs" and the team's marks are NHL trademarks; get the club's or
-- the league's permission before a public launch (renaming is one update below).

update public.seasons set name = 'Season 1 · Go Habs Go' where id = 's1-first-snow';

insert into public.shop_items (id, kind, name, price, sort, purchasable) values
  ('av-habs-puck',  'avatar',      'Game puck',          0, 91, false),
  ('ne-habs',       'name_effect', 'Bleu-blanc-rouge',   0, 91, false),
  ('bn-habs',       'banner',      'Bell Centre night',  0, 91, false),
  ('fr-habs',       'frame',       'Habs jersey',        0, 91, false)
on conflict (id) do update set purchasable = false, name = excluded.name, kind = excluded.kind;

update public.season_rewards set item_id = 'av-habs-puck' where season_id = 's1-first-snow' and tier = 5;
update public.season_rewards set item_id = 'ne-habs'      where season_id = 's1-first-snow' and tier = 10;
update public.season_rewards set item_id = 'bn-habs'      where season_id = 's1-first-snow' and tier = 15;
update public.season_rewards set item_id = 'fr-habs'      where season_id = 's1-first-snow' and tier = 20;

notify pgrst, 'reload schema';
