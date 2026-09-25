-- Repeatable integration checks. All fixtures and rate counters roll back; no existing users are deleted.
begin;
select set_config('test.user_a', gen_random_uuid()::text, true), set_config('test.user_b', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
  (current_setting('test.user_a')::uuid, 'v02_rls_fixture_a@users.learnforge.invalid', '{"username":"v02_rls_fixture_a","password_hint":"fixture hint A"}'),
  (current_setting('test.user_b')::uuid, 'v02_rls_fixture_b@users.learnforge.invalid', '{"username":"v02_rls_fixture_b","password_hint":"fixture hint B"}');
set local role anon;
do $$ begin
  begin perform 1 from public.password_hints; raise exception 'FAIL anon hints'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.attempts; raise exception 'FAIL anon attempts'; exception when insufficient_privilege then null; end;
  begin perform public.request_password_hint('v02_rls_fixture_a', repeat('a',64)); raise exception 'FAIL anon RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL own profile'; end if;
  begin perform 1 from public.password_hints; raise exception 'FAIL auth hints'; exception when insufficient_privilege then null; end;
  begin perform public.request_password_hint('v02_rls_fixture_a', repeat('a',64)); raise exception 'FAIL auth hint RPC'; exception when insufficient_privilege then null; end;
  begin
    insert into public.attempts(user_id, quiz_id, quiz_revision, status, started_at, client_updated_at)
      values(current_setting('test.user_b')::uuid, 'demo', 'fixture', 'draft', now(), now());
    raise exception 'FAIL foreign insert';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('test.attempt', (select id::text from public.save_quiz_attempt('demo', jsonb_build_object(
  'ownerId', current_setting('test.user_a'), 'quizId','demo','quizRevision','fixture','status','in-progress',
  'startedAt', now(), 'updatedAt', now(), 'answers', '{"q1":{"type":"single","optionId":"b"}}'::jsonb))), true);
do $$ begin
  if (select count(*) from public.answers) <> 1 then raise exception 'FAIL own answer'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.attempts) or exists(select 1 from public.answers) then raise exception 'FAIL foreign read'; end if;
  begin
    insert into public.answers(attempt_id,user_id,question_id,answer) values(current_setting('test.attempt')::uuid, auth.uid(), 'foreign', '{}');
    raise exception 'FAIL foreign parent';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_quiz_attempt('demo', jsonb_build_object('ownerId',current_setting('test.user_a')));
    raise exception 'FAIL switched account';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare a public.attempts; begin
  select * into a from public.attempts;
  begin
    perform public.save_quiz_attempt('demo', jsonb_build_object('ownerId',auth.uid(),'quizId','demo','status','in-progress','answers','{}'::jsonb), a.id, a.updated_at - interval '1 second');
    raise exception 'FAIL stale version';
  exception when serialization_failure then null; end;
  perform public.save_quiz_attempt('demo', jsonb_build_object('ownerId',auth.uid(),'quizId','demo','quizRevision','fixture','status','submitted',
    'startedAt',a.started_at,'updatedAt',now(),'submittedAt',now(),'answers','{"q1":{"type":"single","optionId":"b"}}'::jsonb,
    'result','{"score":2,"maxScore":10,"correctCount":1,"incorrectCount":0,"unansweredCount":4}'::jsonb),a.id,a.updated_at);
  begin update public.attempts set status='draft'; raise exception 'FAIL unlock'; exception when check_violation then null; end;
  begin update public.answers set answer='{}'; raise exception 'FAIL submitted answer update'; exception when check_violation then null; end;
  begin delete from public.answers; raise exception 'FAIL submitted answer delete'; exception when check_violation then null; end;
  -- Explicit restart deletes the parent and its answers as one transaction.
  delete from public.attempts where id=a.id;
  if exists(select 1 from public.answers) then raise exception 'FAIL restart cascade'; end if;
end $$;
reset role;
set local role service_role;
do $$ declare result jsonb; begin
  for i in 1..3 loop
    result := public.request_password_hint('v02_rls_fixture_a', repeat('a',64));
    if result is distinct from '{"hint":"fixture hint A"}'::jsonb then raise exception 'FAIL hint projection'; end if;
  end loop;
  if public.request_password_hint('v02_rls_fixture_a', repeat('a',64)) is distinct from '{"limited":true}'::jsonb then raise exception 'FAIL durable limit'; end if;
end $$;
reset role;
rollback;
select 'PASS: anonymous grants, profile isolation, answer parent ownership, account binding, CAS, submission lock, restart cascade, hint projection and durable quota' as verification;
