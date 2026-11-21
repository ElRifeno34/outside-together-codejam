-- 001_schema.sql — Outside Together core tables (Role B)
-- Run in order: 001 → 006. Safe to paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user (created automatically, see 002)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'New member',
  total_points  int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Places: verified public locations (seeded by Role C)
-- ---------------------------------------------------------------------------
create table public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  lat        double precision,
  lng        double precision,
  is_public  boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Activity types: niche_value is fixed per type, never typed by users
-- ---------------------------------------------------------------------------
create table public.activity_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  niche_value  int  not null check (niche_value between 1 and 5),
  keywords     text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Activities
--   status: open → done (2+ confirmed) | cancelled
--   "full" is not a status: compare participant_count to capacity (see activity_board)
-- ---------------------------------------------------------------------------
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  type_id       uuid not null references public.activity_types (id),
  place_id      uuid not null references public.places (id),
  starts_at     timestamptz not null,
  duration_min  int not null default 60 check (duration_min > 0),
  capacity      int not null default 6 check (capacity >= 2),
  min_people    int not null default 2 check (min_people >= 1),
  status        text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_by    uuid references public.profiles (id) on delete set null,  -- null for seeded activities
  created_at    timestamptz not null default now(),
  check (min_people <= capacity)
);

create index activities_starts_at_idx on public.activities (starts_at);
create index activities_type_idx      on public.activities (type_id);

-- ---------------------------------------------------------------------------
-- Participants: one row per (activity, user); leaving keeps the row as 'left'
-- ---------------------------------------------------------------------------
create table public.participants (
  activity_id   uuid not null references public.activities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'joined' check (status in ('joined', 'confirmed', 'left')),
  joined_at     timestamptz not null default now(),
  confirmed_at  timestamptz,
  primary key (activity_id, user_id)
);

create index participants_user_idx on public.participants (user_id);

-- ---------------------------------------------------------------------------
-- Points: at most one entry per user per activity (anti-farming)
-- ---------------------------------------------------------------------------
create table public.points (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  activity_id  uuid not null references public.activities (id) on delete cascade,
  amount       int  not null check (amount > 0),
  created_at   timestamptz not null default now(),
  unique (user_id, activity_id)
);

create index points_user_idx on public.points (user_id);

-- ---------------------------------------------------------------------------
-- Points rule, in one place: 10 + 5 × niche_value
-- ---------------------------------------------------------------------------
create or replace function public.points_for(p_niche_value int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 10 + 5 * p_niche_value;
$$;
