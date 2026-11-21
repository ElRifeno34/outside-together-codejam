-- role_b_smoke.sql — end-to-end check of join / leave / confirm / points / create
--
-- Paste into the Supabase SQL editor AFTER running migrations 001–007 and press Run.
-- Everything runs inside a transaction that is ROLLED BACK at the end, so no test
-- data is left behind. Success = notice "ROLE B SMOKE TEST PASSED". Any failure
-- raises an error naming the check that broke.

begin;

-- Helpers ------------------------------------------------------------------
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end,
    true);
$$;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_pattern then
      raise exception 'expected error like "%" but got "%"  (sql: %)', p_pattern, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'expected error like "%" but call succeeded  (sql: %)', p_pattern, p_sql;
end;
$$;

create function pg_temp.check(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'CHECK FAILED: %', p_label; end if;
end;
$$;

-- Throwaway fixtures (rolled back) --------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-a1@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-a2@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-a3@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-a4@example.test');

insert into public.activity_types (id, name, niche_value) values
  ('00000000-0000-0000-0000-0000000000e1', 'zz-test-chess', 3);   -- 10 + 5*3 = 25 pts

insert into public.places (id, name, is_public) values
  ('00000000-0000-0000-0000-0000000000f1', 'zz-test public park', true),
  ('00000000-0000-0000-0000-0000000000f2', 'zz-test private flat', false);

insert into public.activities (id, type_id, place_id, starts_at, capacity) values
  ('00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
   now() + interval '1 hour', 2);

-- Tests ------------------------------------------------------------------------
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  u3 uuid := '00000000-0000-0000-0000-0000000000a3';
  u4 uuid := '00000000-0000-0000-0000-0000000000a4';
  act uuid := '00000000-0000-0000-0000-0000000000c1';
  r json;
  new_act uuid;
begin
  -- profiles created by trigger
  perform pg_temp.check((select count(*) from public.profiles where id in (u1,u2,u3,u4)) = 4,
                        'profile trigger created 4 profiles');
  perform pg_temp.check((select display_name from public.profiles where id = u1) = 'test-a1',
                        'display_name defaults to email prefix');

  -- logged out
  perform pg_temp.act_as(null);
  perform pg_temp.expect_error(format('select public.join_activity(%L)', act), 'NOT_AUTHENTICATED');

  -- join, double join, fill up
  perform pg_temp.act_as(u1);
  r := public.join_activity(act);
  perform pg_temp.check((r->>'participant_count')::int = 1, 'u1 join → count 1');
  perform pg_temp.expect_error(format('select public.join_activity(%L)', act), 'ALREADY_JOINED');

  perform pg_temp.act_as(u2);
  r := public.join_activity(act);
  perform pg_temp.check((r->>'spots_left')::int = 0, 'u2 join → 0 spots left');

  perform pg_temp.act_as(u3);
  perform pg_temp.expect_error(format('select public.join_activity(%L)', act), 'ACTIVITY_FULL');

  -- leave frees a spot, rejoin path
  perform pg_temp.act_as(u2);
  r := public.leave_activity(act);
  perform pg_temp.check((r->>'participant_count')::int = 1, 'u2 leave → count 1');
  perform pg_temp.expect_error(format('select public.leave_activity(%L)', act), 'NOT_A_PARTICIPANT');

  perform pg_temp.act_as(u3);
  r := public.join_activity(act);
  perform pg_temp.check((r->>'participant_count')::int = 2, 'u3 takes freed spot');

  perform pg_temp.act_as(u2);
  perform pg_temp.expect_error(format('select public.join_activity(%L)', act), 'ACTIVITY_FULL');

  -- board view
  perform pg_temp.act_as(u1);
  perform pg_temp.check((select my_status from public.activity_board where id = act) = 'joined',
                        'board my_status = joined for u1');
  perform pg_temp.check((select is_full from public.activity_board where id = act),
                        'board is_full = true');
  perform pg_temp.check((select points_value from public.activity_board where id = act) = 25,
                        'board points_value = 25');

  -- confirm too early
  perform pg_temp.expect_error(format('select public.confirm_attendance(%L)', act), 'ACTIVITY_NOT_STARTED');

  -- time passes: activity has started
  update public.activities set starts_at = now() - interval '2 hours' where id = act;

  perform pg_temp.act_as(u4);
  perform pg_temp.expect_error(format('select public.join_activity(%L)', act), 'ACTIVITY_STARTED');
  perform pg_temp.expect_error(format('select public.confirm_attendance(%L)', act), 'NOT_A_PARTICIPANT');

  -- first confirmation: no points yet
  perform pg_temp.act_as(u1);
  r := public.confirm_attendance(act);
  perform pg_temp.check((r->>'points_unlocked')::boolean = false, 'u1 alone → points locked');
  perform pg_temp.check((r->>'waiting_for')::int = 1, 'u1 alone → waiting for 1');
  r := public.confirm_attendance(act);  -- double click
  perform pg_temp.check((r->>'confirmed_count')::int = 1, 'double confirm does not double count');

  -- second confirmation: both get 25
  perform pg_temp.act_as(u3);
  r := public.confirm_attendance(act);
  perform pg_temp.check((r->>'points_earned')::int = 25, 'u3 earns 25');
  perform pg_temp.check((select total_points from public.profiles where id = u1) = 25, 'u1 total = 25');
  perform pg_temp.check((select total_points from public.profiles where id = u3) = 25, 'u3 total = 25');
  perform pg_temp.check((select status from public.activities where id = act) = 'done', 'activity done');

  -- replays do not farm points
  r := public.confirm_attendance(act);
  perform pg_temp.act_as(u1);
  r := public.confirm_attendance(act);
  perform pg_temp.check((select total_points from public.profiles where id = u1) = 25, 'replay: u1 still 25');
  perform pg_temp.check((select count(*) from public.points where activity_id = act) = 2, 'exactly 2 point rows');

  -- create_activity
  perform pg_temp.act_as(u4);
  perform pg_temp.expect_error(format(
    'select public.create_activity(%L, %L, %L)',
    '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f2', now() + interval '1 day'),
    'INVALID_PLACE');
  perform pg_temp.expect_error(format(
    'select public.create_activity(%L, %L, %L)',
    '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', now() - interval '1 day'),
    'INVALID_TIME');
  r := public.create_activity('00000000-0000-0000-0000-0000000000e1',
                              '00000000-0000-0000-0000-0000000000f1',
                              now() + interval '1 day');
  new_act := (r->>'activity_id')::uuid;
  perform pg_temp.check((select participant_count from public.activity_board where id = new_act) = 1,
                        'creator auto-joined');
  perform pg_temp.check((select created_by from public.activities where id = new_act) = u4,
                        'created_by = creator');
  -- remember new_act for the role checks below (transaction-local)
  perform set_config('smoke.new_act', new_act::text, true);
end;
$$;

-- Grants: exactly which functions the browser roles can call ------------------
do $$
begin
  perform pg_temp.check(
    (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
       from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and has_function_privilege('anon', p.oid, 'EXECUTE')) = array['points_for'],
    'anon can execute only points_for');
  perform pg_temp.check(
    (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
       from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      = array['confirm_attendance', 'create_activity', 'join_activity', 'leave_activity', 'points_for'],
    'authenticated can execute only the app RPCs + points_for');
  perform pg_temp.check(not has_column_privilege('anon', 'public.activities', 'created_by', 'SELECT')
                    and not has_column_privilege('authenticated', 'public.activities', 'created_by', 'SELECT'),
                        'no browser role has SELECT on activities.created_by');
  perform pg_temp.check(not exists (select 1 from information_schema.columns
                                     where table_schema = 'public' and table_name = 'activity_board'
                                       and column_name = 'created_by'),
                        'activity_board has no created_by column');
end;
$$;

-- RLS: what the browser roles can and cannot do ---------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;

do $$
begin
  perform pg_temp.check((select count(*) from public.participants) =
                        (select count(*) from public.participants where user_id = auth.uid()),
                        'authenticated sees only own participant rows');
  perform pg_temp.expect_error(
    $q$insert into public.points (user_id, activity_id, amount)
       values (auth.uid(), '00000000-0000-0000-0000-0000000000c1', 999)$q$,
    'permission denied%');
  perform pg_temp.expect_error(
    $q$update public.profiles set total_points = 99999 where id = auth.uid()$q$,
    'permission denied%');
  perform pg_temp.expect_error(
    $q$insert into public.participants (activity_id, user_id)
       values ('00000000-0000-0000-0000-0000000000c1', auth.uid())$q$,
    'permission denied%');
  update public.profiles set display_name = 'Renamed' where id = auth.uid();
  perform pg_temp.check((select display_name from public.profiles where id = auth.uid()) = 'Renamed',
                        'user can rename self');
  perform pg_temp.check((select count(*) from public.points) = 1,
                        'authenticated sees only own points row');

  -- creator privacy
  perform pg_temp.expect_error('select created_by from public.activities', 'permission denied%');
  perform pg_temp.check((select count(*) from public.activities
                          where id = current_setting('smoke.new_act')::uuid) = 1,
                        'authenticated reads the public activities columns');
  perform pg_temp.check((select is_mine from public.activity_board
                          where id = current_setting('smoke.new_act')::uuid) = false,
                        'is_mine = false for a non-creator (u1)');
  perform pg_temp.check((select is_mine from public.activity_board
                          where id = '00000000-0000-0000-0000-0000000000c1') is not true,
                        'is_mine not true on a seeded activity');

  -- the app RPCs work for a logged-in user; the trigger function does not
  perform public.join_activity(current_setting('smoke.new_act')::uuid);
  perform pg_temp.check((select participant_count from public.activity_board
                          where id = current_setting('smoke.new_act')::uuid) = 2,
                        'authenticated join → board count 2');
  perform pg_temp.expect_error('select public.handle_new_user()', 'permission denied%');
end;
$$;

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;

do $$
begin
  perform pg_temp.check((select is_mine from public.activity_board
                          where id = current_setting('smoke.new_act')::uuid) = true,
                        'is_mine = true for the creator (u4)');
  perform pg_temp.check((select count(*) from public.activity_board where is_mine) = 1,
                        'is_mine true on exactly the creator''s one activity');
end;
$$;

reset role;
select pg_temp.act_as(null);
set local role anon;

do $$
begin
  perform pg_temp.check((select participant_count from public.activity_board
                         where id = '00000000-0000-0000-0000-0000000000c1') = 2,
                        'anon reads board counts');
  perform pg_temp.check((select my_status from public.activity_board
                         where id = '00000000-0000-0000-0000-0000000000c1') is null,
                        'anon my_status is null');
  perform pg_temp.check((select count(*) from public.participants) = 0,
                        'anon cannot read participants');

  -- creator privacy + aggregate counts
  perform pg_temp.expect_error('select created_by from public.activities', 'permission denied%');
  perform pg_temp.check((select count(*) from public.activities
                          where id = current_setting('smoke.new_act')::uuid) = 1,
                        'anon reads the public activities columns');
  perform pg_temp.check((select count(*) from public.activity_board) >= 2,
                        'anon can select activity_board');
  perform pg_temp.check((select count(*) from public.activity_board where is_mine is not null) = 0,
                        'is_mine is null for anon');
  perform pg_temp.check((select participant_count from public.activity_board
                          where id = current_setting('smoke.new_act')::uuid) = 2,
                        'anon sees live count 2 on new activity');
  perform pg_temp.check((select spots_left from public.activity_board
                          where id = current_setting('smoke.new_act')::uuid) = 4,
                        'anon sees spots_left 4 (capacity 6)');

  -- privileged functions are closed to anon
  perform pg_temp.expect_error(format('select public.join_activity(%L)', current_setting('smoke.new_act')), 'permission denied%');
  perform pg_temp.expect_error(format('select public.leave_activity(%L)', current_setting('smoke.new_act')), 'permission denied%');
  perform pg_temp.expect_error(format('select public.confirm_attendance(%L)', current_setting('smoke.new_act')), 'permission denied%');
  perform pg_temp.expect_error(format('select public.create_activity(%L, %L, %L)',
    '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', now() + interval '2 days'),
    'permission denied%');
  perform pg_temp.expect_error('select public.handle_new_user()', 'permission denied%');

  raise notice 'ROLE B SMOKE TEST PASSED';
end;
$$;

reset role;
rollback;
