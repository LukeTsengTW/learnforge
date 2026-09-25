-- Repeatable role-based checks. All fixtures and hint counters roll back.
begin;
select set_config('test.user_a', gen_random_uuid()::text, true), set_config('test.user_b', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
  (current_setting('test.user_a')::uuid, 'v03_rls_fixture_a@users.learnforge.invalid', '{"username":"v03_rls_fixture_a","password_hint":"fixture hint A"}'),
  (current_setting('test.user_b')::uuid, 'v03_rls_fixture_b@users.learnforge.invalid', '{"username":"v03_rls_fixture_b","password_hint":"fixture hint B"}');

set local role anon;
do $$ begin
  begin perform 1 from public.password_hints; raise exception 'FAIL anon hints'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.attempts; raise exception 'FAIL anon attempts'; exception when insufficient_privilege then null; end;
  begin perform public.get_or_create_quiz_draft(null, 'demo', 'fixture'); raise exception 'FAIL anon draft RPC'; exception when insufficient_privilege then null; end;
  begin perform public.request_password_hint('v03_rls_fixture_a', repeat('a',64)); raise exception 'FAIL anon hint RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare first_id uuid; second_id uuid; row_a public.attempts; begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL own profile'; end if;
  begin perform 1 from public.password_hints; raise exception 'FAIL auth hints'; exception when insufficient_privilege then null; end;
  begin perform public.request_password_hint('v03_rls_fixture_a', repeat('a',64)); raise exception 'FAIL auth hint RPC'; exception when insufficient_privilege then null; end;
  begin
    insert into public.attempts(user_id, quiz_id, quiz_revision, status, started_at, client_updated_at)
      values(current_setting('test.user_b')::uuid, 'demo', 'fixture', 'draft', now(), now());
    raise exception 'FAIL foreign insert';
  exception when insufficient_privilege then null; end;
  select id into first_id from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  select id into second_id from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'newer');
  if first_id is distinct from second_id then raise exception 'FAIL resume existing draft'; end if;
  begin
    insert into public.attempts(user_id, quiz_id, quiz_revision, status, started_at, client_updated_at)
      values(auth.uid(), 'demo', 'fixture', 'draft', now(), now());
    raise exception 'FAIL second draft allowed';
  exception when unique_violation then null; end;
  select * into row_a from public.attempts where id = first_id;
  perform public.save_quiz_attempt_v3(first_id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
    'quizRevision','fixture','status','in-progress','startedAt',row_a.started_at,'updatedAt',clock_timestamp(),
    'answers','{"q1":{"type":"single","optionId":"b"}}'::jsonb), row_a.updated_at);
  if (select count(*) from public.answers where attempt_id = first_id) <> 1 then raise exception 'FAIL own answer'; end if;
  perform set_config('test.first_attempt', first_id::text, true);
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare own_id uuid; begin
  if exists(select 1 from public.attempts) or exists(select 1 from public.answers) then raise exception 'FAIL foreign read'; end if;
  begin
    insert into public.answers(attempt_id,user_id,question_id,answer)
      values(current_setting('test.first_attempt')::uuid, auth.uid(), 'foreign', '{}');
    raise exception 'FAIL foreign parent';
  exception when insufficient_privilege then null; end;
  select id into own_id from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  if own_id = current_setting('test.first_attempt')::uuid then raise exception 'FAIL account draft isolation'; end if;
  begin
    perform public.save_quiz_attempt_v3(own_id, jsonb_build_object('ownerId',current_setting('test.user_a'),
      'quizId','demo','status','in-progress','answers','{}'::jsonb), now());
    raise exception 'FAIL switched account';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare a public.attempts; b public.attempts; draft_row public.attempts; begin
  select * into a from public.attempts where id = current_setting('test.first_attempt')::uuid;
  begin
    perform public.save_quiz_attempt_v3(a.id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
      'quizRevision','fixture','status','in-progress','startedAt',a.started_at,'updatedAt',clock_timestamp(),
      'answers','{}'::jsonb), a.updated_at - interval '1 second');
    raise exception 'FAIL stale CAS';
  exception when serialization_failure then null; end;
  perform public.save_quiz_attempt_v3(a.id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
    'quizRevision','fixture','status','submitted','startedAt',a.started_at,'updatedAt',clock_timestamp(),
    'submittedAt',clock_timestamp(),'answers','{"q1":{"type":"single","optionId":"b"}}'::jsonb,
    'result','{"score":2,"maxScore":10,"correctCount":1,"incorrectCount":0,"unansweredCount":4}'::jsonb), a.updated_at);
  begin
    update public.attempts set status='draft' where id=a.id;
    if found then raise exception 'FAIL unlock'; end if;
  exception when check_violation then null; end;
  begin update public.answers set answer='{}' where attempt_id=a.id; raise exception 'FAIL submitted answer update'; exception when check_violation then null; end;
  begin delete from public.answers where attempt_id=a.id; raise exception 'FAIL submitted answer delete'; exception when check_violation then null; end;
  delete from public.attempts where id=a.id;
  if found then raise exception 'FAIL submitted delete'; end if;
  select * into b from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  if b.id = a.id then raise exception 'FAIL practice again identity'; end if;
  perform public.save_quiz_attempt_v3(b.id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
    'quizRevision','fixture','status','submitted','startedAt',b.started_at,'updatedAt',clock_timestamp(),
    'submittedAt',clock_timestamp(),'answers','{}'::jsonb,
    'result','{"score":0,"maxScore":10,"correctCount":0,"incorrectCount":0,"unansweredCount":5}'::jsonb), b.updated_at);
  if (select count(*) from public.attempts where quiz_id='demo' and status='submitted') <> 2 then raise exception 'FAIL two submissions'; end if;
  select * into draft_row from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  if draft_row.id in (a.id,b.id) then raise exception 'FAIL third draft identity'; end if;
  delete from public.attempts where id=draft_row.id;
  if not found then raise exception 'FAIL own draft delete'; end if;
  if (select count(*) from public.attempts where quiz_id='demo' and status='submitted') <> 2 then raise exception 'FAIL history preservation'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.attempts where status='submitted') or exists(select 1 from public.answers) then
    raise exception 'FAIL foreign history'; end if;
end $$;
reset role;

set local role service_role;
do $$ declare result jsonb; begin
  for i in 1..3 loop
    result := public.request_password_hint('v03_rls_fixture_a', repeat('a',64));
    if result is distinct from '{"hint":"fixture hint A"}'::jsonb then raise exception 'FAIL hint projection'; end if;
  end loop;
  if public.request_password_hint('v03_rls_fixture_a', repeat('a',64)) is distinct from '{"limited":true}'::jsonb then
    raise exception 'FAIL durable limit'; end if;
end $$;
reset role;
rollback;
select 'PASS: v0.3 draft uniqueness, repeat submissions, immutable history, RLS, CAS, owner binding, answers and hints' as verification;
