-- Run against the seeded development database. Everything rolls back.
begin;

insert into auth.users (id, email) values
  ('d2000000-0000-4000-8000-000000000001', 'qa-host@example.test'),
  ('d2000000-0000-4000-8000-000000000002', 'qa-guest@example.test'),
  ('d2000000-0000-4000-8000-000000000003', 'qa-outsider@example.test');
insert into public.profiles (id, display_name)
values
  ('d2000000-0000-4000-8000-000000000001', 'QA host'),
  ('d2000000-0000-4000-8000-000000000002', 'QA guest'),
  ('d2000000-0000-4000-8000-000000000003', 'QA outsider');

create temporary table qa_activities (id uuid, niche_value integer);
grant insert, select on qa_activities to authenticated;

set local role anon;
do $$
begin
  if (select count(*) from public.activity_board) < 8 then
    raise exception 'Visitors should see the seed board';
  end if;
  if exists (select from public.places where not is_public) then
    raise exception 'Visitors should not see private places';
  end if;
  begin
    perform public.join_activity('b1000000-0000-4000-8000-000000000001');
    raise exception 'Visitors cannot register';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);
insert into qa_activities
select public.create_activity(id, 'e90b37b0-532d-4eb1-985a-486dcb977930', now()+interval '2 hours', 2),
  niche_value from public.activity_types where name in ('Basketball', 'Photo walk');
insert into qa_activities
select public.create_activity(id, 'e90b37b0-532d-4eb1-985a-486dcb977930', now()+interval '3 hours', 2),
  niche_value from public.activity_types where name = 'Urban sketching';

do $$
begin
  begin
    perform public.create_activity('a1000000-0000-4000-8000-000000000002',
      '4f1db342-dc7b-444b-a16d-668ed95245e5', now()+interval '1 hour', 2);
    raise exception 'A draft may use only public places';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000002', true);
do $$
declare
  v_activity record;
begin
  for v_activity in select id from qa_activities where niche_value in (1, 4) loop
    if public.join_activity(v_activity.id) <> 2 or public.join_activity(v_activity.id) <> 2 then
      raise exception 'Join must be idempotent';
    end if;
    if public.leave_activity(v_activity.id) <> 1 then
      raise exception 'Leaving should release a slot';
    end if;
    if (select status from public.activity_board where id = v_activity.id) <> 'open' then
      raise exception 'Falling below the minimum should reopen the activity';
    end if;
    if public.join_activity(v_activity.id) <> 2 then
      raise exception 'Rejoin should reclaim exactly one slot';
    end if;
    if (select joined_count from public.activity_board where id = v_activity.id) <> 2 then
      raise exception 'The public board should reflect the updated count';
    end if;
    begin
      perform public.confirm_attendance(v_activity.id);
      raise exception 'Early confirmation should fail';
    exception when check_violation then null;
    end;
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin
    perform public.join_activity((select id from qa_activities where niche_value = 1));
    raise exception 'A third guest cannot join a full activity';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
update public.activities set starts_at = now() - interval '2 hours' where id in (select id from qa_activities);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_activity record;
begin
  if exists (select from public.activity_board where id in (select id from qa_activities)) then
    raise exception 'Past activities must be absent from the board';
  end if;
  begin
    perform public.confirm_attendance((select id from qa_activities where niche_value = 5));
    raise exception 'A session below its minimum cannot earn attendance';
  exception when check_violation then null;
  end;
  for v_activity in select id from qa_activities where niche_value in (1, 4) loop
    if public.confirm_attendance(v_activity.id) <> 0 then
      raise exception 'One confirmation should award zero';
    end if;
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000002', true);
do $$
declare
  v_activity record;
  v_expected integer;
begin
  for v_activity in select * from qa_activities where niche_value in (1, 4) loop
    v_expected := 10 + 5 * v_activity.niche_value;
    if public.confirm_attendance(v_activity.id) <> v_expected or public.confirm_attendance(v_activity.id) <> v_expected then
      raise exception 'Confirmation should return the niche award once persisted';
    end if;
  end loop;
  if (select total_points from public.profiles where id = auth.uid()) <> 45
    or (select count(*) from public.points) <> 2 then
    raise exception 'The visible point total and private ledger should match';
  end if;
  begin
    update public.profiles set total_points = 99 where id = auth.uid();
    raise exception 'Direct edits to points must fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.points where activity_id in (select id from qa_activities)) <> 4 then
    raise exception 'Each of two participants should receive one award for each validated activity';
  end if;
end;
$$;
rollback;
