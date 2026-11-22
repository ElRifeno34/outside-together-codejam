-- 020_season_ranks_links_chat.sql — season pass, rank on profiles, social links, chat
--
-- Run once, after 001–019.
--
-- Season pass (free track): points earned during a season (activities, places, side
-- quests) unlock 20 tiers, 25 points apart. Each tier has a reward to claim: credits or a
-- season-exclusive cosmetic that the shop doesn't sell.
-- Profiles: world rank and area rank, plus optional social links (https only).
-- Chat: 1:1 messages between friends, and a group chat per activity for its
-- participants (and creator). Messages go through send_message; reads use RLS, so
-- Supabase Realtime only delivers messages each person may see.

-- ---------------------------------------------------------------------------
-- Season pass
-- ---------------------------------------------------------------------------
alter table public.shop_items add column if not exists purchasable boolean not null default true;

insert into public.shop_items (id, kind, name, price, sort, purchasable) values
  ('av-hare',      'avatar',      'Snowshoe hare', 0, 90, false),
  ('ne-frost',     'name_effect', 'Frost',         0, 90, false),
  ('bn-firstsnow', 'banner',      'First snow',    0, 90, false),
  ('fr-snowflake', 'frame',       'Snowflake',     0, 90, false)
on conflict (id) do update set purchasable = false, name = excluded.name, kind = excluded.kind;

-- The shop can't sell season rewards.
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
  if not v_item.purchasable then
    raise exception 'SEASON_ONLY';
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

create table if not exists public.seasons (
  id             text primary key,
  name           text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  points_per_tier int not null default 25 check (points_per_tier > 0),
  check (ends_at > starts_at)
);
alter table public.seasons enable row level security;
drop policy if exists "seasons are public" on public.seasons;
create policy "seasons are public" on public.seasons for select to anon, authenticated using (true);
grant select on public.seasons to anon, authenticated;

insert into public.seasons (id, name, starts_at, ends_at, points_per_tier) values
  ('s1-first-snow', 'Season 1 · First snow', '2026-11-01 00:00-05', '2027-02-01 00:00-05', 25)
on conflict (id) do nothing;

create table if not exists public.season_rewards (
  season_id  text not null references public.seasons (id) on delete cascade,
  tier       int  not null check (tier between 1 and 20),
  credits    int  not null default 0 check (credits >= 0),
  item_id    text references public.shop_items (id),
  primary key (season_id, tier),
  check (credits > 0 or item_id is not null)
);
alter table public.season_rewards enable row level security;
drop policy if exists "season rewards are public" on public.season_rewards;
create policy "season rewards are public" on public.season_rewards for select to anon, authenticated using (true);
grant select on public.season_rewards to anon, authenticated;

insert into public.season_rewards (season_id, tier, credits, item_id) values
  ('s1-first-snow',  1, 10, null),
  ('s1-first-snow',  2, 10, null),
  ('s1-first-snow',  3, 15, null),
  ('s1-first-snow',  4, 15, null),
  ('s1-first-snow',  5,  0, 'av-hare'),
  ('s1-first-snow',  6, 20, null),
  ('s1-first-snow',  7, 20, null),
  ('s1-first-snow',  8, 25, null),
  ('s1-first-snow',  9, 25, null),
  ('s1-first-snow', 10,  0, 'ne-frost'),
  ('s1-first-snow', 11, 30, null),
  ('s1-first-snow', 12, 30, null),
  ('s1-first-snow', 13, 35, null),
  ('s1-first-snow', 14, 35, null),
  ('s1-first-snow', 15,  0, 'bn-firstsnow'),
  ('s1-first-snow', 16, 40, null),
  ('s1-first-snow', 17, 40, null),
  ('s1-first-snow', 18, 45, null),
  ('s1-first-snow', 19, 50, null),
  ('s1-first-snow', 20, 50, 'fr-snowflake')
on conflict (season_id, tier) do nothing;

create table if not exists public.season_claims (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  season_id   text not null references public.seasons (id) on delete cascade,
  tier        int  not null,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, season_id, tier)
);
alter table public.season_claims enable row level security;
drop policy if exists "see own season claims" on public.season_claims;
create policy "see own season claims" on public.season_claims for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.season_claims to authenticated;

-- Points earned by one person between two instants (all sources).
create or replace function public.points_between(p_user uuid, p_from timestamptz, p_to timestamptz)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((select sum(amount) from public.points
              where user_id = p_user and created_at >= p_from and created_at < p_to), 0)
  + coalesce((select sum(points) from public.spot_visits
              where user_id = p_user and visited_at >= p_from and visited_at < p_to), 0)
  + coalesce((select sum(points) from public.quest_completions
              where user_id = p_user and validated_at >= p_from and validated_at < p_to), 0)
  )::int;
$$;
revoke execute on function public.points_between(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- The current season with my season points, tier and claimed tiers.
create or replace function public.my_season()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_season  public.seasons%rowtype;
  v_points  int := 0;
begin
  select * into v_season from public.seasons
  where now() >= starts_at and now() < ends_at
  order by starts_at desc limit 1;
  if not found then
    return null;
  end if;
  if v_user is not null then
    v_points := public.points_between(v_user, v_season.starts_at, v_season.ends_at);
  end if;
  return json_build_object(
    'id', v_season.id,
    'name', v_season.name,
    'starts_at', v_season.starts_at,
    'ends_at', v_season.ends_at,
    'points_per_tier', v_season.points_per_tier,
    'points', v_points,
    'tier', least(20, v_points / v_season.points_per_tier),
    'claimed', coalesce((select json_agg(tier order by tier) from public.season_claims
                         where user_id = v_user and season_id = v_season.id), '[]'::json),
    'rewards', (select json_agg(json_build_object('tier', r.tier, 'credits', r.credits,
                                                  'item_id', r.item_id, 'item_kind', si.kind,
                                                  'item_name', si.name) order by r.tier)
                from public.season_rewards r left join public.shop_items si on si.id = r.item_id
                where r.season_id = v_season.id)
  );
end;
$$;

create or replace function public.claim_season_reward(p_tier int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_season  public.seasons%rowtype;
  v_reward  public.season_rewards%rowtype;
  v_points  int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_season from public.seasons
  where now() >= starts_at and now() < ends_at
  order by starts_at desc limit 1;
  if not found then
    raise exception 'NO_SEASON';
  end if;
  select * into v_reward from public.season_rewards where season_id = v_season.id and tier = p_tier;
  if not found then
    raise exception 'TIER_NOT_FOUND';
  end if;
  v_points := public.points_between(v_user, v_season.starts_at, v_season.ends_at);
  if v_points < p_tier * v_season.points_per_tier then
    raise exception 'TIER_LOCKED';
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.season_claims (user_id, season_id, tier) values (v_user, v_season.id, p_tier)
  on conflict do nothing;
  if not found then
    raise exception 'ALREADY_CLAIMED';
  end if;
  if v_reward.credits > 0 then
    update public.profiles set bonus_credits = bonus_credits + v_reward.credits where id = v_user;
  end if;
  if v_reward.item_id is not null then
    insert into public.user_items (user_id, item_id) values (v_user, v_reward.item_id)
    on conflict do nothing;
  end if;
  return json_build_object('tier', p_tier, 'credits', v_reward.credits, 'item_id', v_reward.item_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Social links
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists links jsonb not null default '{}';

-- p_links = { "linkedin": "https://www.linkedin.com/in/…", "instagram": "…", … }
-- Only https URLs on each network's own site (website: any https URL). Empty = removed.
create or replace function public.set_social_links(p_links jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_clean  jsonb := '{}';
  v_key    text;
  v_url    text;
  v_hosts  jsonb := '{"linkedin":["linkedin.com"],"instagram":["instagram.com"],
                      "tiktok":["tiktok.com"],"x":["x.com","twitter.com"],
                      "github":["github.com"],"youtube":["youtube.com","youtu.be"],
                      "website":[]}';
  v_host   text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  for v_key, v_url in select key, trim(value) from jsonb_each_text(coalesce(p_links, '{}')) loop
    if not v_hosts ? v_key then
      raise exception 'INVALID_LINK';
    end if;
    continue when v_url = '';
    if length(v_url) > 200 or v_url !~* '^https://[^\s/]+(/[^\s]*)?$' then
      raise exception 'INVALID_LINK';
    end if;
    v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
    if jsonb_array_length(v_hosts -> v_key) > 0 and not exists (
         select 1 from jsonb_array_elements_text(v_hosts -> v_key) h(name)
         where v_host = h.name or v_host like '%.' || h.name) then
      raise exception 'INVALID_LINK';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_url);
  end loop;
  update public.profiles set links = v_clean where id = v_user;
  return v_clean;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public profile (019) with ranks and links
-- ---------------------------------------------------------------------------
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
    'links', v_p.links,
    'trophies', coalesce((select json_agg(trophy_id order by earned_at)
                          from public.user_trophies where user_id = p_user_id), '[]'::json),
    'checkins', (select count(*) from public.participants
                 where user_id = p_user_id and status = 'confirmed'),
    'places', (select count(*) from public.spot_visits where user_id = p_user_id),
    'world_rank', 1 + (select count(*) from public.profiles where total_points > v_p.total_points),
    'world_total', (select count(*) from public.profiles),
    'area_rank', case when v_p.area is null then null else
                   1 + (select count(*) from public.profiles
                        where area = v_p.area and total_points > v_p.total_points) end,
    'area_total', case when v_p.area is null then null else
                    (select count(*) from public.profiles where area = v_p.area) end,
    'is_me', p_user_id = auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade,     -- 1:1
  activity_id  uuid references public.activities (id) on delete cascade,   -- group
  body         text not null check (length(body) between 1 and 1000),
  created_at   timestamptz not null default now(),
  check ((recipient_id is null) <> (activity_id is null))
);
create index if not exists messages_dm_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at)
  where recipient_id is not null;
create index if not exists messages_activity_idx on public.messages (activity_id, created_at)
  where activity_id is not null;

-- Who may read an activity's group chat: its creator and people registered in it.
create or replace function public.in_activity_chat(p_activity_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.activities where id = p_activity_id and created_by = p_user)
      or exists (select 1 from public.participants
                 where activity_id = p_activity_id and user_id = p_user
                   and status in ('joined', 'confirmed'));
$$;

alter table public.messages enable row level security;
drop policy if exists "read my messages" on public.messages;
create policy "read my messages" on public.messages for select to authenticated using (
  (recipient_id is not null and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())))
  or (activity_id is not null and public.in_activity_chat(activity_id, (select auth.uid())))
);
grant select on public.messages to authenticated;

create or replace function public.send_message(p_body text, p_to uuid default null, p_activity_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_body  text := trim(coalesce(p_body, ''));
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(v_body) not between 1 and 1000 then
    raise exception 'INVALID_MESSAGE';
  end if;
  if (p_to is null) = (p_activity_id is null) then
    raise exception 'INVALID_MESSAGE';
  end if;
  if p_to is not null and not exists (select 1 from public.friendships
                                      where user_id = v_user and friend_id = p_to) then
    raise exception 'NOT_FRIENDS';
  end if;
  if p_activity_id is not null and not public.in_activity_chat(p_activity_id, v_user) then
    raise exception 'NOT_IN_ACTIVITY';
  end if;
  -- Gentle flood guard: at most 20 messages a minute.
  if (select count(*) from public.messages
      where sender_id = v_user and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'SLOW_DOWN';
  end if;
  insert into public.messages (sender_id, recipient_id, activity_id, body)
  values (v_user, p_to, p_activity_id, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Read markers for unread counts in 1:1 chats.
create table if not exists public.chat_reads (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  other_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (user_id, other_id)
);
alter table public.chat_reads enable row level security;
drop policy if exists "see own read markers" on public.chat_reads;
create policy "see own read markers" on public.chat_reads for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.chat_reads to authenticated;

create or replace function public.mark_chat_read(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into public.chat_reads (user_id, other_id, last_read_at) values (auth.uid(), p_other, now())
  on conflict (user_id, other_id) do update set last_read_at = now();
end;
$$;

-- My friends with their last message and how many are unread.
create or replace function public.my_conversations()
returns table (
  friend_id         uuid,
  display_name      text,
  avatar_item       text,
  frame_item        text,
  name_effect_item  text,
  last_body         text,
  last_at           timestamptz,
  last_from_me      boolean,
  unread            int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  return query
  select f.friend_id, p.display_name, p.avatar_item, p.frame_item, p.name_effect_item,
         lm.body, lm.created_at, lm.sender_id = v_user,
         (select count(*)::int from public.messages m
          where m.sender_id = f.friend_id and m.recipient_id = v_user
            and m.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                         where r.user_id = v_user and r.other_id = f.friend_id),
                                        '-infinity'))
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.messages m
    where (m.sender_id = v_user and m.recipient_id = f.friend_id)
       or (m.sender_id = f.friend_id and m.recipient_id = v_user)
    order by m.created_at desc limit 1
  ) lm on true
  where f.user_id = v_user
  order by lm.created_at desc nulls last, p.display_name;
end;
$$;

-- Live delivery through Supabase Realtime (RLS above decides who receives what).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object or undefined_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.in_activity_chat(uuid, uuid) from public, anon;
grant execute on function public.in_activity_chat(uuid, uuid) to authenticated;
revoke execute on function public.claim_season_reward(int) from public, anon;
revoke execute on function public.set_social_links(jsonb) from public, anon;
revoke execute on function public.send_message(text, uuid, uuid) from public, anon;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.claim_season_reward(int) to authenticated;
grant execute on function public.set_social_links(jsonb) to authenticated;
grant execute on function public.send_message(text, uuid, uuid) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
revoke execute on function public.my_season() from public;
grant execute on function public.my_season() to anon, authenticated;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
