begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  total_points integer not null default 0 check (total_points >= 0)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_public boolean not null
);

create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  niche_value integer not null check (niche_value between 1 and 5),
  keywords text[] not null default '{}'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.activity_types(id),
  place_id uuid not null references public.places(id),
  starts_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min = 60),
  capacity integer not null check (capacity between 2 and 30),
  min_people integer not null default 2 check (min_people between 2 and capacity),
  status text not null default 'open' check (status in ('open', 'confirmed', 'done', 'cancelled')),
  created_by uuid not null references public.profiles(id)
);

create table public.participants (
  activity_id uuid not null references public.activities(id),
  user_id uuid not null references public.profiles(id),
  status text not null default 'joined' check (status in ('joined', 'confirmed', 'left')),
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table public.points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  activity_id uuid not null references public.activities(id),
  amount integer not null check (amount in (15, 20, 25, 30, 35)),
  created_at timestamptz not null default now(),
  unique (user_id, activity_id),
  foreign key (activity_id, user_id) references public.participants(activity_id, user_id)
);

create index activities_starts_at_idx on public.activities (starts_at);
create index participants_user_idx on public.participants (user_id, activity_id);

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.activity_types enable row level security;
alter table public.activities enable row level security;
alter table public.participants enable row level security;
alter table public.points enable row level security;

revoke all on public.profiles, public.places, public.activity_types, public.activities,
  public.participants, public.points from public, anon, authenticated;
grant select on public.places, public.activity_types to anon, authenticated;
grant select on public.profiles, public.activities, public.participants, public.points to authenticated;
grant insert (id, display_name), update (display_name) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_create_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_edit_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy places_public on public.places for select to anon, authenticated
  using (is_public);
create policy types_public on public.activity_types for select to anon, authenticated using (true);
create policy participants_read_own on public.participants for select to authenticated
  using (user_id = (select auth.uid()));
create policy activities_read_joined on public.activities for select to authenticated
  using (created_by = (select auth.uid()) or exists (
    select from public.participants p
    where p.activity_id = activities.id and p.user_id = (select auth.uid()) and p.status <> 'left'
  ));
create policy points_read_own on public.points for select to authenticated
  using (user_id = (select auth.uid()));

-- The view publishes aggregates and verified places without exposing participant identities.
create view public.activity_board as
select a.id, a.type_id, t.name as activity_name, t.niche_value, a.place_id, pl.name as place_name,
  pl.address, pl.lat, pl.lng, a.starts_at, a.duration_min, a.capacity, a.min_people, a.status,
  c.joined_count, a.capacity - c.joined_count as available_spots
from public.activities a
join public.activity_types t on t.id = a.type_id
join public.places pl on pl.id = a.place_id
cross join lateral (
  select count(*)::integer as joined_count
  from public.participants p where p.activity_id = a.id and p.status <> 'left'
) c
where pl.is_public and a.starts_at > statement_timestamp() and a.status in ('open', 'confirmed');

revoke all on public.activity_board from public, anon, authenticated;
grant select on public.activity_board to anon, authenticated;

-- The caller must lock the activity row before modifying registrations.
create function public.create_activity(
  p_type_id uuid, p_place_id uuid, p_starts_at timestamptz, p_capacity integer, p_min_people integer default 2
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_starts_at is null or p_starts_at <= clock_timestamp() then
    raise exception 'Choose a future start' using errcode = '23514';
  end if;
  if not exists (select 1 from public.places where id = p_place_id and is_public) then
    raise exception 'Choose a public place' using errcode = '23514';
  end if;
  insert into public.activities (type_id, place_id, starts_at, capacity, min_people, created_by)
  values (p_type_id, p_place_id, p_starts_at, p_capacity, p_min_people, v_user)
  returning id into v_id;
  insert into public.participants (activity_id, user_id) values (v_id, v_user);
  return v_id;
end;
$$;

create function public.join_activity(p_activity_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_activity public.activities%rowtype;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select a.* into v_activity from public.activities a
    join public.places pl on pl.id = a.place_id and pl.is_public
    where a.id = p_activity_id for update of a;
  if not found then raise exception 'Activity unavailable' using errcode = '22023'; end if;
  select count(*) into v_count from public.participants
    where activity_id = p_activity_id and status <> 'left';
  if exists (select from public.participants
    where activity_id = p_activity_id and user_id = v_user and status <> 'left') then
    return v_count;
  end if;
  if v_activity.starts_at <= clock_timestamp() or v_activity.status not in ('open', 'confirmed') then
    raise exception 'Registration is closed' using errcode = '23514';
  end if;
  if v_count >= v_activity.capacity then
    raise exception 'Activity is full' using errcode = '23514';
  end if;

  insert into public.participants (activity_id, user_id) values (p_activity_id, v_user)
  on conflict (activity_id, user_id) do update set status = 'joined', joined_at = clock_timestamp();
  if v_count + 1 >= v_activity.min_people and v_activity.status = 'open' then
    update public.activities set status = 'confirmed' where id = p_activity_id;
  end if;
  return v_count + 1;
end;
$$;

create function public.leave_activity(p_activity_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_activity public.activities%rowtype;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into v_activity from public.activities where id = p_activity_id for update;
  if not found or v_activity.starts_at <= clock_timestamp() or v_activity.status not in ('open', 'confirmed') then
    raise exception 'Registration is closed' using errcode = '23514';
  end if;
  if not exists (select from public.participants where activity_id = p_activity_id and user_id = v_user) then
    raise exception 'Only participants can leave' using errcode = '42501';
  end if;
  update public.participants set status = 'left'
    where activity_id = p_activity_id and user_id = v_user and status = 'joined';
  select count(*) into v_count from public.participants
    where activity_id = p_activity_id and status <> 'left';
  if v_count < v_activity.min_people and v_activity.status = 'confirmed' then
    update public.activities set status = 'open' where id = p_activity_id;
  end if;
  return v_count;
end;
$$;

create function public.confirm_attendance(p_activity_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_activity public.activities%rowtype;
  v_value integer;
  v_award record;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into v_activity from public.activities where id = p_activity_id for update;
  if not found or not exists (
    select from public.participants where activity_id = p_activity_id and user_id = v_user and status <> 'left'
  ) then raise exception 'Only participants can confirm' using errcode = '42501'; end if;

  if v_activity.status not in ('confirmed', 'done') or
    v_activity.starts_at + make_interval(mins => v_activity.duration_min) > clock_timestamp() then
    raise exception 'Activity is not eligible for attendance' using errcode = '23514';
  end if;
  update public.participants set status = 'confirmed'
    where activity_id = p_activity_id and user_id = v_user and status = 'joined';
  if (select count(*) from public.participants where activity_id = p_activity_id and status = 'confirmed') < 2 then
    return 0;
  end if;

  select 10 + 5 * niche_value into v_value from public.activity_types where id = v_activity.type_id;
  update public.activities set status = 'done' where id = p_activity_id and status <> 'done';
  -- Lock profiles in a consistent order when one confirmation earns several awards.
  for v_award in
    with inserted as (
      insert into public.points (user_id, activity_id, amount)
      select user_id, p_activity_id, v_value
      from public.participants where activity_id = p_activity_id and status = 'confirmed'
      on conflict (user_id, activity_id) do nothing
      returning user_id, amount
    )
    select * from inserted order by user_id
  loop
    update public.profiles set total_points = total_points + v_award.amount where id = v_award.user_id;
  end loop;
  return (select amount from public.points where activity_id = p_activity_id and user_id = v_user);
end;
$$;

revoke all on function public.create_activity(uuid, uuid, timestamptz, integer, integer),
  public.join_activity(uuid), public.leave_activity(uuid), public.confirm_attendance(uuid)
  from public, anon, authenticated;
grant execute on function public.create_activity(uuid, uuid, timestamptz, integer, integer),
  public.join_activity(uuid), public.leave_activity(uuid), public.confirm_attendance(uuid) to authenticated;

commit;
