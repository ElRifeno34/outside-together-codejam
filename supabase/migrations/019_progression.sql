-- 019_progression.sql — credits, cosmetic shop, trophies and public profiles
--
-- Run once, after 001–018.
--
-- Credits: 1 credit per 5 points earned (activities, places, side quests), plus bonus
-- credits from trophies. Credits are spent in the shop on avatar frames, profile pictures,
-- banners and name effects. Points stay the ranking score; spending never lowers them.
--   balance = floor(credit_points / 5) + bonus_credits - spent_credits
--   credit_points follows every change of total_points (a side quest unticked takes it back).
--
-- Grades (Bronze I … Platinum) are computed from total_points in the app.
-- Trophies are checked by refresh_my_trophies() from real data, never trusted from the app.
-- Profiles are public (003), so equipped items, trophies and the showcase are visible to all.

-- ---------------------------------------------------------------------------
-- Credits on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists credit_points     int not null default 0,
  add column if not exists bonus_credits     int not null default 0,
  add column if not exists spent_credits     int not null default 0,
  add column if not exists avatar_item       text,
  add column if not exists frame_item        text,
  add column if not exists banner_item       text,
  add column if not exists name_effect_item  text,
  add column if not exists showcase          text[] not null default '{}';

-- Points earned before this migration count for credits too (once).
update public.profiles set credit_points = total_points where credit_points = 0 and total_points > 0;

create or replace function public.track_credit_points()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.total_points is distinct from old.total_points then
    new.credit_points := greatest(0, old.credit_points + (new.total_points - old.total_points));
  end if;
  return new;
end;
$$;

drop trigger if exists track_credit_points on public.profiles;
create trigger track_credit_points
  before update of total_points on public.profiles
  for each row execute function public.track_credit_points();

create or replace function public.credits_balance(p public.profiles)
returns int
language sql
stable
set search_path = public
as $$
  select greatest(0, floor(p.credit_points / 5.0)::int + p.bonus_credits - p.spent_credits);
$$;

-- ---------------------------------------------------------------------------
-- Shop
-- ---------------------------------------------------------------------------
create table if not exists public.shop_items (
  id     text primary key,
  kind   text not null check (kind in ('avatar', 'frame', 'banner', 'name_effect')),
  name   text not null,
  price  int  not null check (price >= 0),
  sort   int  not null default 0
);
alter table public.shop_items enable row level security;
drop policy if exists "shop items are public" on public.shop_items;
create policy "shop items are public" on public.shop_items for select to anon, authenticated using (true);
grant select on public.shop_items to anon, authenticated;

insert into public.shop_items (id, kind, name, price, sort) values
  ('av-squirrel', 'avatar', 'Squirrel',       30, 1),
  ('av-fox',      'avatar', 'Fox',            40, 2),
  ('av-owl',      'avatar', 'Owl',            40, 3),
  ('av-raccoon',  'avatar', 'Raccoon',        60, 4),
  ('av-beaver',   'avatar', 'Beaver',         60, 5),
  ('av-heron',    'avatar', 'Heron',          90, 6),
  ('av-bear',     'avatar', 'Bear',           90, 7),
  ('av-moose',    'avatar', 'Moose',         120, 8),
  ('fr-leaf',     'frame',  'Leafy',          50, 1),
  ('fr-sunset',   'frame',  'Sunset',         80, 2),
  ('fr-maple',    'frame',  'Maple',         120, 3),
  ('fr-neon',     'frame',  'Neon',          150, 4),
  ('fr-gold',     'frame',  'Gold',          200, 5),
  ('fr-aurora',   'frame',  'Aurora',        300, 6),
  ('bn-mountain', 'banner', 'Mont-Royal',     60, 1),
  ('bn-river',    'banner', 'St. Lawrence',   60, 2),
  ('bn-autumn',   'banner', 'Autumn',         80, 3),
  ('bn-sunset',   'banner', 'Old Port sunset',90, 4),
  ('bn-night',    'banner', 'City night',    120, 5),
  ('bn-aurora',   'banner', 'Aurora',        180, 6),
  ('ne-forest',   'name_effect', 'Forest',    50, 1),
  ('ne-ocean',    'name_effect', 'Ocean',     80, 2),
  ('ne-sunset',   'name_effect', 'Sunset',    80, 3),
  ('ne-glow',     'name_effect', 'Glow',     120, 4),
  ('ne-gold',     'name_effect', 'Gold',     150, 5),
  ('ne-rainbow',  'name_effect', 'Rainbow',  250, 6)
on conflict (id) do update set kind = excluded.kind, name = excluded.name,
                               price = excluded.price, sort = excluded.sort;

create table if not exists public.user_items (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      text not null references public.shop_items (id) on delete cascade,
  acquired_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_items enable row level security;
drop policy if exists "see own items" on public.user_items;
create policy "see own items" on public.user_items for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.user_items to authenticated;

create or replace function public.buy_item(p_item_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_item  public.shop_items%rowtype;
  v_me    public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_item from public.shop_items where id = p_item_id;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  select * into v_me from public.profiles where id = v_user for update;
  if exists (select 1 from public.user_items where user_id = v_user and item_id = p_item_id) then
    raise exception 'ALREADY_OWNED';
  end if;
  if public.credits_balance(v_me) < v_item.price then
    raise exception 'NOT_ENOUGH_CREDITS';
  end if;
  update public.profiles set spent_credits = spent_credits + v_item.price where id = v_user;
  insert into public.user_items (user_id, item_id) values (v_user, p_item_id);
  select * into v_me from public.profiles where id = v_user;
  return json_build_object('item_id', p_item_id, 'credits', public.credits_balance(v_me));
end;
$$;

-- Equip an owned item (or unequip with p_item_id = null).
create or replace function public.equip_item(p_kind text, p_item_id text)
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
  if p_kind not in ('avatar', 'frame', 'banner', 'name_effect') then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if p_item_id is not null and not exists (
       select 1 from public.user_items ui join public.shop_items si on si.id = ui.item_id
       where ui.user_id = v_user and ui.item_id = p_item_id and si.kind = p_kind) then
    raise exception 'NOT_OWNED';
  end if;
  update public.profiles set
    avatar_item      = case when p_kind = 'avatar'      then p_item_id else avatar_item end,
    frame_item       = case when p_kind = 'frame'       then p_item_id else frame_item end,
    banner_item      = case when p_kind = 'banner'      then p_item_id else banner_item end,
    name_effect_item = case when p_kind = 'name_effect' then p_item_id else name_effect_item end
  where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trophies
-- ---------------------------------------------------------------------------
create table if not exists public.trophies (
  id           text primary key,
  tier         text not null check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  name         text not null,
  description  text not null,
  credits      int  not null default 0,
  sort         int  not null default 0
);
alter table public.trophies enable row level security;
drop policy if exists "trophies are public" on public.trophies;
create policy "trophies are public" on public.trophies for select to anon, authenticated using (true);
grant select on public.trophies to anon, authenticated;

insert into public.trophies (id, tier, name, description, credits, sort) values
  ('first-steps',    'bronze',   'First steps',        'Check in at your first activity.',                              10,  1),
  ('regular',        'silver',   'Regular',            'Check in at 10 activities.',                                    25,  2),
  ('veteran',        'gold',     'Veteran',            'Check in at 50 activities.',                                    50,  3),
  ('niche-streak',   'gold',     'Off the beaten path','Check in at 5 activities of niche 4 or more in a row.',         50,  4),
  ('hooper',         'bronze',   'Hooper',             'Check in at 5 basketball activities.',                          10,  5),
  ('baller',         'silver',   'Baller',             'Check in at 15 basketball activities.',                         25,  6),
  ('grandmaster',    'silver',   'Park grandmaster',   'Check in at 5 chess activities.',                               25,  7),
  ('birder',         'silver',   'Birder',             'Check in at 5 birdwatching activities.',                        25,  8),
  ('shutterbug',     'silver',   'Shutterbug',         'Check in at 5 photo walks.',                                    25,  9),
  ('explorer',       'bronze',   'Explorer',           'Visit 3 places.',                                               10, 10),
  ('cartographer',   'silver',   'Cartographer',       'Visit 10 places.',                                              25, 11),
  ('whole-city',     'gold',     'The whole city',     'Visit every place on the list.',                                50, 12),
  ('niche-hunter',   'silver',   'Niche hunter',       'Visit 3 places of niche 5 or more.',                            25, 13),
  ('quester',        'bronze',   'Quester',            'Complete your first side quest.',                               10, 14),
  ('quest-master',   'silver',   'Quest master',       'Complete 10 side quests.',                                      25, 15),
  ('social',         'bronze',   'Social butterfly',   'Have 3 friends.',                                               10, 16),
  ('host',           'silver',   'Host',               'Create an activity where 2 or more people check in.',           25, 17),
  ('legend',         'platinum', 'Montréal legend',    'Reach the Platinum grade (1,600 points).',                     100, 18)
on conflict (id) do update set tier = excluded.tier, name = excluded.name,
  description = excluded.description, credits = excluded.credits, sort = excluded.sort;

create table if not exists public.user_trophies (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  trophy_id  text not null references public.trophies (id) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, trophy_id)
);
alter table public.user_trophies enable row level security;
drop policy if exists "earned trophies are public" on public.user_trophies;
create policy "earned trophies are public" on public.user_trophies for select to anon, authenticated using (true);
grant select on public.user_trophies to anon, authenticated;

-- Checks every trophy against the signed-in person's real data, awards new ones
-- (with their bonus credits) and returns the ids just earned.
create or replace function public.refresh_my_trophies()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_checkins    int;
  v_basket      int;
  v_chess       int;
  v_birds       int;
  v_photo       int;
  v_streak      int;
  v_visits      int;
  v_niche_vis   int;
  v_all_spots   int;
  v_quests      int;
  v_friends     int;
  v_hosted      int;
  v_points      int;
  v_earned      text[] := '{}';
  v_id          text;
  v_ok          boolean;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  select count(*),
         count(*) filter (where t.name = 'Basketball'),
         count(*) filter (where t.name = 'Chess'),
         count(*) filter (where t.name = 'Birdwatching'),
         count(*) filter (where t.name = 'Photo walk')
    into v_checkins, v_basket, v_chess, v_birds, v_photo
  from public.participants p
  join public.activities a on a.id = p.activity_id
  join public.activity_types t on t.id = a.type_id
  where p.user_id = v_user and p.status = 'confirmed';

  -- Longest run of consecutive check-ins (by start time) at niche 4 or more.
  with c as (
    select (t.niche_value >= 4) as hi, row_number() over (order by a.starts_at) as rn
    from public.participants p
    join public.activities a on a.id = p.activity_id
    join public.activity_types t on t.id = a.type_id
    where p.user_id = v_user and p.status = 'confirmed'
  ), g as (
    select hi, rn - row_number() over (partition by hi order by rn) as grp from c
  )
  select coalesce(max(n), 0) into v_streak
  from (select count(*) as n from g where hi group by grp) runs;

  select count(*), count(*) filter (where s.niche_value >= 5)
    into v_visits, v_niche_vis
  from public.spot_visits v join public.spots s on s.id = v.spot_id
  where v.user_id = v_user;
  select count(*) into v_all_spots from public.spots where is_active;

  select count(*) into v_quests from public.quest_completions where user_id = v_user;
  select count(*) into v_friends from public.friendships where user_id = v_user;
  select count(*) into v_hosted from public.activities where created_by = v_user and status = 'done';
  select total_points into v_points from public.profiles where id = v_user;

  for v_id in select id from public.trophies order by sort loop
    v_ok := case v_id
      when 'first-steps'  then v_checkins >= 1
      when 'regular'      then v_checkins >= 10
      when 'veteran'      then v_checkins >= 50
      when 'niche-streak' then v_streak >= 5
      when 'hooper'       then v_basket >= 5
      when 'baller'       then v_basket >= 15
      when 'grandmaster'  then v_chess >= 5
      when 'birder'       then v_birds >= 5
      when 'shutterbug'   then v_photo >= 5
      when 'explorer'     then v_visits >= 3
      when 'cartographer' then v_visits >= 10
      when 'whole-city'   then v_all_spots > 0 and v_visits >= v_all_spots
      when 'niche-hunter' then v_niche_vis >= 3
      when 'quester'      then v_quests >= 1
      when 'quest-master' then v_quests >= 10
      when 'social'       then v_friends >= 3
      when 'host'         then v_hosted >= 1
      when 'legend'       then coalesce(v_points, 0) >= 1600
      else false
    end;
    if v_ok then
      insert into public.user_trophies (user_id, trophy_id) values (v_user, v_id)
      on conflict do nothing;
      if found then
        v_earned := v_earned || v_id;
        update public.profiles
        set bonus_credits = bonus_credits + (select credits from public.trophies where id = v_id)
        where id = v_user;
      end if;
    end if;
  end loop;

  return v_earned;
end;
$$;

-- Up to 3 earned trophies to show off on the profile.
create or replace function public.set_showcase(p_trophies text[])
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
  if coalesce(array_length(p_trophies, 1), 0) > 3 then
    raise exception 'SHOWCASE_FULL';
  end if;
  if exists (select 1 from unnest(coalesce(p_trophies, '{}')) t(id)
             where not exists (select 1 from public.user_trophies
                               where user_id = v_user and trophy_id = t.id)) then
    raise exception 'TROPHY_NOT_EARNED';
  end if;
  update public.profiles set showcase = coalesce(p_trophies, '{}') where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- My progress and public profiles
-- ---------------------------------------------------------------------------
create or replace function public.my_progress()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_me   public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_me from public.profiles where id = v_user;
  if not found then
    return json_build_object('credits', 0, 'items', '[]'::json);
  end if;
  return json_build_object(
    'credits', public.credits_balance(v_me),
    'items', coalesce((select json_agg(item_id) from public.user_items where user_id = v_user), '[]'::json)
  );
end;
$$;

create or replace function public.get_public_profile(p_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p public.profiles%rowtype;
begin
  select * into v_p from public.profiles where id = p_user_id;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  return json_build_object(
    'id', v_p.id,
    'display_name', v_p.display_name,
    'area', v_p.area,
    'total_points', v_p.total_points,
    'avatar_item', v_p.avatar_item,
    'frame_item', v_p.frame_item,
    'banner_item', v_p.banner_item,
    'name_effect_item', v_p.name_effect_item,
    'showcase', v_p.showcase,
    'trophies', coalesce((select json_agg(trophy_id order by earned_at)
                          from public.user_trophies where user_id = p_user_id), '[]'::json),
    'checkins', (select count(*) from public.participants
                 where user_id = p_user_id and status = 'confirmed'),
    'places', (select count(*) from public.spot_visits where user_id = p_user_id),
    'is_me', p_user_id = auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard (013) with avatar, frame and name effect for each row
-- ---------------------------------------------------------------------------
drop function if exists public.get_leaderboard(text, text);

create or replace function public.get_leaderboard(p_scope text, p_area text default null)
returns table (
  rank              int,
  user_id           uuid,
  display_name      text,
  area              text,
  total_points      int,
  is_me             boolean,
  avatar_item       text,
  frame_item        text,
  name_effect_item  text
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
      return;
    end if;
  end if;

  return query
  with base as (
    select p.id, p.display_name, p.area, p.total_points,
           p.avatar_item, p.frame_item, p.name_effect_item
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
  select ranked.r, ranked.id, ranked.display_name, ranked.area, ranked.total_points,
         (ranked.id = v_user), ranked.avatar_item, ranked.frame_item, ranked.name_effect_item
  from ranked
  where ranked.n <= 50 or ranked.id = v_user
  order by ranked.n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.buy_item(text) from public, anon;
revoke execute on function public.equip_item(text, text) from public, anon;
revoke execute on function public.refresh_my_trophies() from public, anon;
revoke execute on function public.set_showcase(text[]) from public, anon;
revoke execute on function public.my_progress() from public, anon;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text, text) to authenticated;
grant execute on function public.refresh_my_trophies() to authenticated;
grant execute on function public.set_showcase(text[]) to authenticated;
grant execute on function public.my_progress() to authenticated;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
revoke execute on function public.get_leaderboard(text, text) from public;
grant execute on function public.get_leaderboard(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
