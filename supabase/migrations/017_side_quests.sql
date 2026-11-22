-- 017_side_quests.sql — side quests validated by the event's creator
--
-- Run once, after 001–016.
--
-- Each activity can carry up to 5 side quests: picked from suggestions (per activity
-- type, plus general ones) or written by the creator. A quest is worth
-- 5 × the activity type's niche value. The creator (the event admin) ticks which
-- attendees completed which quest; points arrive when ticked and leave if unticked.
--   * quests can be changed until the activity starts
--   * validation is open from the start until 48 h after the end
--   * only registered attendees can be validated, never the creator themself
--
-- Front end:
--   supabase.from('quest_templates').select('*')
--   supabase.from('activity_quests').select('*').eq('activity_id', id)
--   supabase.from('quest_completions').select('quest_id, points')        -- own rows only
--   supabase.rpc('set_activity_quests', { p_activity_id, p_quests: [{ title, template_id }] })
--   supabase.rpc('get_quest_board', { p_activity_id })                   -- creator only
--   supabase.rpc('validate_quest', { p_quest_id, p_user_id, p_done })    -- creator only

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------
create table if not exists public.quest_templates (
  id       uuid primary key default gen_random_uuid(),
  type_id  uuid references public.activity_types (id) on delete cascade,  -- null: any activity
  title    text not null check (length(title) between 3 and 80)
);

alter table public.quest_templates enable row level security;
drop policy if exists "quest templates are public" on public.quest_templates;
create policy "quest templates are public" on public.quest_templates
  for select to anon, authenticated using (true);
grant select on public.quest_templates to anon, authenticated;

insert into public.quest_templates (id, type_id, title) values
  ('9e570000-0000-4000-8000-000000000001', null, 'Learn everyone''s first name'),
  ('9e570000-0000-4000-8000-000000000002', null, 'Take a group photo'),
  ('9e570000-0000-4000-8000-000000000003', null, 'Bring someone who has never come before'),
  ('9e570000-0000-4000-8000-000000000004', null, 'Find something here none of you had noticed'),
  ('9e570000-0000-4000-8000-000000000101', '7e000000-0000-4000-8000-000000000002', 'Make 3 baskets in a row'),
  ('9e570000-0000-4000-8000-000000000102', '7e000000-0000-4000-8000-000000000002', 'Play a full game of H-O-R-S-E'),
  ('9e570000-0000-4000-8000-000000000103', '7e000000-0000-4000-8000-000000000004', 'Try a café none of you know'),
  ('9e570000-0000-4000-8000-000000000104', '7e000000-0000-4000-8000-000000000005', 'Run 3 km without stopping'),
  ('9e570000-0000-4000-8000-000000000105', '7e000000-0000-4000-8000-000000000003', 'Share a homemade dish'),
  ('9e570000-0000-4000-8000-000000000106', '7e000000-0000-4000-8000-000000000001', 'Walk 5,000 steps together'),
  ('9e570000-0000-4000-8000-000000000107', '7e000000-0000-4000-8000-000000000008', 'Find a mural and learn who painted it'),
  ('9e570000-0000-4000-8000-000000000108', '7e000000-0000-4000-8000-000000000006', 'Finish a 45-minute focus session'),
  ('9e570000-0000-4000-8000-000000000109', '7e000000-0000-4000-8000-000000000007', 'Photograph the moment the sun touches the horizon'),
  ('9e570000-0000-4000-8000-000000000110', '7e000000-0000-4000-8000-000000000010', 'Spot 5 different bird species'),
  ('9e570000-0000-4000-8000-000000000111', '7e000000-0000-4000-8000-000000000009', 'Win a game against someone new'),
  ('9e570000-0000-4000-8000-000000000112', '7e000000-0000-4000-8000-000000000012', 'Find a cache and log it'),
  ('9e570000-0000-4000-8000-000000000113', '7e000000-0000-4000-8000-000000000013', 'Fold a crane and leave it for someone to find'),
  ('9e570000-0000-4000-8000-000000000114', '7e000000-0000-4000-8000-000000000011', 'Take one photo everyone agrees is the best'),
  ('9e570000-0000-4000-8000-000000000115', '7e000000-0000-4000-8000-000000000016', 'Record 3 sounds you would never notice'),
  ('9e570000-0000-4000-8000-000000000116', '7e000000-0000-4000-8000-000000000015', 'Find 3 different kinds of moss or lichen'),
  ('9e570000-0000-4000-8000-000000000117', '7e000000-0000-4000-8000-000000000014', 'Sketch the same building from two angles')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Quests attached to an activity
-- ---------------------------------------------------------------------------
create table if not exists public.activity_quests (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  title        text not null check (length(title) between 3 and 80),
  template_id  uuid references public.quest_templates (id) on delete set null,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists activity_quests_activity_idx on public.activity_quests (activity_id);

alter table public.activity_quests enable row level security;
drop policy if exists "activity quests are public" on public.activity_quests;
create policy "activity quests are public" on public.activity_quests
  for select to anon, authenticated using (true);
grant select on public.activity_quests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Completions: ticked by the creator
-- ---------------------------------------------------------------------------
create table if not exists public.quest_completions (
  quest_id      uuid not null references public.activity_quests (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  points        int  not null check (points > 0),
  validated_at  timestamptz not null default now(),
  primary key (quest_id, user_id)
);

alter table public.quest_completions enable row level security;
drop policy if exists "see own quest completions" on public.quest_completions;
create policy "see own quest completions" on public.quest_completions
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.quest_completions to authenticated;

-- ---------------------------------------------------------------------------
-- set_activity_quests: replace an activity's quests (creator, before the start)
--   p_quests = [{ "title": "...", "template_id": "<uuid or null>" }, ...]
-- ---------------------------------------------------------------------------
create or replace function public.set_activity_quests(p_activity_id uuid, p_quests jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_act    public.activities%rowtype;
  v_item   jsonb;
  v_title  text;
  v_tpl    uuid;
  v_pos    int := 0;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_act from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;
  if v_act.created_by is distinct from v_user then
    raise exception 'NOT_CREATOR';
  end if;
  if now() >= v_act.starts_at then
    raise exception 'QUESTS_LOCKED';
  end if;
  if jsonb_typeof(coalesce(p_quests, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_quests, '[]'::jsonb)) > 5 then
    raise exception 'TOO_MANY_QUESTS';
  end if;

  delete from public.activity_quests where activity_id = p_activity_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_quests, '[]'::jsonb)) loop
    v_title := trim(coalesce(v_item ->> 'title', ''));
    if length(v_title) not between 3 and 80 then
      raise exception 'INVALID_QUEST';
    end if;
    v_tpl := nullif(v_item ->> 'template_id', '')::uuid;
    if v_tpl is not null and not exists (select 1 from public.quest_templates where id = v_tpl) then
      v_tpl := null;
    end if;
    insert into public.activity_quests (activity_id, title, template_id, position)
    values (p_activity_id, v_title, v_tpl, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_pos;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_quest_board: attendees and who completed what (creator only)
-- ---------------------------------------------------------------------------
create or replace function public.get_quest_board(p_activity_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  status        text,
  completed     uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.activities a
                 where a.id = p_activity_id and a.created_by = v_user) then
    raise exception 'NOT_CREATOR';
  end if;

  return query
  select pa.user_id, pr.display_name, pa.status,
         coalesce(array_agg(qc.quest_id) filter (where qc.quest_id is not null), '{}')
  from public.participants pa
  join public.profiles pr on pr.id = pa.user_id
  left join public.activity_quests q on q.activity_id = pa.activity_id
  left join public.quest_completions qc on qc.quest_id = q.id and qc.user_id = pa.user_id
  where pa.activity_id = p_activity_id
    and pa.status in ('joined', 'confirmed')
    and pa.user_id <> v_user
  group by pa.user_id, pr.display_name, pa.status, pa.joined_at
  order by pa.joined_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- validate_quest: tick (p_done = true) or untick an attendee's quest (creator only)
-- ---------------------------------------------------------------------------
create or replace function public.validate_quest(p_quest_id uuid, p_user_id uuid, p_done boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_quest   public.activity_quests%rowtype;
  v_act     public.activities%rowtype;
  v_points  int;
  v_had     int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_quest from public.activity_quests where id = p_quest_id;
  if not found then
    raise exception 'QUEST_NOT_FOUND';
  end if;
  select * into v_act from public.activities where id = v_quest.activity_id for update;
  if v_act.created_by is distinct from v_user then
    raise exception 'NOT_CREATOR';
  end if;
  if p_user_id = v_user then
    raise exception 'CANNOT_VALIDATE_SELF';
  end if;
  if now() < v_act.starts_at then
    raise exception 'QUESTS_NOT_STARTED';
  end if;
  if now() > v_act.starts_at + make_interval(mins => v_act.duration_min) + interval '48 hours' then
    raise exception 'QUESTS_CLOSED';
  end if;
  if not exists (select 1 from public.participants
                 where activity_id = v_act.id and user_id = p_user_id
                   and status in ('joined', 'confirmed')) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if p_done then
    select 5 * niche_value into v_points from public.activity_types where id = v_act.type_id;
    insert into public.quest_completions (quest_id, user_id, points)
    values (p_quest_id, p_user_id, v_points)
    on conflict (quest_id, user_id) do nothing;
    if found then
      update public.profiles set total_points = total_points + v_points where id = p_user_id;
    end if;
  else
    delete from public.quest_completions
    where quest_id = p_quest_id and user_id = p_user_id
    returning points into v_had;
    if v_had is not null then
      update public.profiles set total_points = greatest(total_points - v_had, 0)
      where id = p_user_id;
    end if;
  end if;

  return json_build_object('quest_id', p_quest_id, 'user_id', p_user_id, 'done', p_done);
end;
$$;

revoke execute on function public.set_activity_quests(uuid, jsonb) from public, anon;
revoke execute on function public.get_quest_board(uuid) from public, anon;
revoke execute on function public.validate_quest(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_activity_quests(uuid, jsonb) to authenticated;
grant execute on function public.get_quest_board(uuid) to authenticated;
grant execute on function public.validate_quest(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
