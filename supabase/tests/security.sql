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
-- v0.4 AI ledger is never directly exposed to browser roles, nor are its RPCs.
set local role anon;
do $$ begin
  begin perform 1 from public.ai_requests; raise exception 'FAIL anon AI read'; exception when insufficient_privilege then null; end;
  begin insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
    values(current_setting('test.user_a')::uuid,gen_random_uuid(),gen_random_uuid(),'q1','hint',1,'gpt-6-luna','low','reserved',now()+interval '15 minutes');
    raise exception 'FAIL anon AI insert'; exception when insufficient_privilege then null; end;
  begin update public.ai_requests set credits = 1; raise exception 'FAIL anon AI update'; exception when insufficient_privilege then null; end;
  begin delete from public.ai_requests; raise exception 'FAIL anon AI delete'; exception when insufficient_privilege then null; end;
  begin perform public.get_ai_quota_status(current_setting('test.user_a')::uuid); raise exception 'FAIL anon AI status RPC'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_ai_request(current_setting('test.user_a')::uuid, gen_random_uuid(), gen_random_uuid(), 'q1', 'hint', 'gpt-6-luna', 'low');
    raise exception 'FAIL anon AI reservation RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin perform 1 from public.ai_requests; raise exception 'FAIL authenticated AI read'; exception when insufficient_privilege then null; end;
  begin insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
    values(auth.uid(),gen_random_uuid(),gen_random_uuid(),'q1','hint',1,'gpt-6-luna','low','reserved',now()+interval '15 minutes');
    raise exception 'FAIL authenticated AI insert'; exception when insufficient_privilege then null; end;
  begin update public.ai_requests set credits = 1; raise exception 'FAIL authenticated AI update'; exception when insufficient_privilege then null; end;
  begin delete from public.ai_requests; raise exception 'FAIL authenticated AI delete'; exception when insufficient_privilege then null; end;
  begin perform public.get_ai_quota_status(auth.uid()); raise exception 'FAIL authenticated AI status RPC'; exception when insufficient_privilege then null; end;
  begin perform public.find_ai_request(auth.uid(), gen_random_uuid(), gen_random_uuid(), 'q1', 'hint', 'gpt-6-luna', 'low');
    raise exception 'FAIL authenticated AI lookup RPC'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_ai_request(auth.uid(), gen_random_uuid(), gen_random_uuid(), 'q1', 'hint', 'gpt-6-luna', 'low');
    raise exception 'FAIL authenticated AI reservation RPC'; exception when insufficient_privilege then null; end;
  begin perform public.complete_ai_request(auth.uid(), gen_random_uuid(), '{}'::jsonb, null,0,0,0,0);
    raise exception 'FAIL authenticated AI completion RPC'; exception when insufficient_privilege then null; end;
  begin perform public.refund_ai_request(auth.uid(), gen_random_uuid(), 'test');
    raise exception 'FAIL authenticated AI refund RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare
  a uuid := current_setting('test.user_a')::uuid; b uuid := current_setting('test.user_b')::uuid;
  attempt_id uuid := gen_random_uuid(); one_id uuid := gen_random_uuid(); two_id uuid := gen_random_uuid();
  req_id uuid; result jsonb; quota jsonb; response jsonb := '{"title":"test","message":"test","keyPoints":[],"nextStep":null}'::jsonb;
  first_credit timestamptz;
begin
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 20 then raise exception 'FAIL fresh quota'; end if;
  result := public.reserve_ai_request(a, one_id, attempt_id, 'q1', 'hint', 'gpt-6-luna', 'low');
  if result->>'state' <> 'created' or (result->>'remaining')::integer <> 19 then raise exception 'FAIL hint cost'; end if;
  result := public.reserve_ai_request(a, one_id, attempt_id, 'q1', 'hint', 'gpt-6-luna', 'low');
  if result->>'state' <> 'reserved' or (select count(*) from public.ai_requests where user_id=a) <> 1 then
    raise exception 'FAIL idempotent active reservation'; end if;
  result := public.reserve_ai_request(a, one_id, attempt_id, 'q2', 'hint', 'gpt-6-luna', 'low');
  if result->>'state' <> 'mismatch' then raise exception 'FAIL request identity binding'; end if;
  result := public.reserve_ai_request(a, two_id, attempt_id, 'q2', 'explain_solution', 'gpt-6-luna', 'low');
  if result->>'state' <> 'created' or (result->>'remaining')::integer <> 17 then raise exception 'FAIL solution cost'; end if;
  if not public.refund_ai_request(a, one_id, 'fixture_failure') then raise exception 'FAIL refund'; end if;
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 18 then raise exception 'FAIL refunded credit returned'; end if;
  if not public.complete_ai_request(a, two_id, response, 'resp_fixture', 10, 2, 20, 3) then raise exception 'FAIL complete'; end if;
  result := public.reserve_ai_request(a, two_id, attempt_id, 'q2', 'explain_solution', 'gpt-6-luna', 'low');
  if result->>'state' <> 'completed' or result->'response' is distinct from response then raise exception 'FAIL completed retry'; end if;
  if public.refund_ai_request(a, two_id, 'late_refund') then raise exception 'FAIL completed cannot refund'; end if;
  if (public.get_ai_quota_status(b)->>'remaining')::integer <> 20 then raise exception 'FAIL user isolation'; end if;
  update public.ai_requests set created_at = now() - interval '5 hours 1 second' where user_id=a and request_id=two_id;
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 20 then raise exception 'FAIL rolling five hours'; end if;
  req_id := gen_random_uuid();
  perform public.reserve_ai_request(a, req_id, attempt_id, 'q3', 'hint', 'gpt-6-luna', 'low');
  update public.ai_requests set reserved_until = now() - interval '1 second' where user_id=a and request_id=req_id;
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 20 then raise exception 'FAIL expired reservation excluded'; end if;
  if (select status from public.ai_requests where user_id=a and request_id=req_id) <> 'expired' then raise exception 'FAIL lazy expiry'; end if;
  -- Sequential boundary checks plus the lock assertion below document the concurrent algorithm.
  for i in 1..19 loop
    req_id := gen_random_uuid();
    result := public.reserve_ai_request(a, req_id, attempt_id, 'q1', 'hint', 'gpt-6-luna', 'low');
    if result->>'state' <> 'created' then raise exception 'FAIL reserve fixture %', i; end if;
    if not public.complete_ai_request(a, req_id, response, null, 1, 0, 1, 0) then raise exception 'FAIL complete fixture %', i; end if;
  end loop;
  first_credit := (select min(created_at + interval '5 hours') from public.ai_requests
    where user_id=a and status='completed' and created_at > now()-interval '5 hours');
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 1 or (quota->>'nextCreditAt')::timestamptz is distinct from first_credit then
    raise exception 'FAIL 19 credits or nextCreditAt'; end if;
  result := public.reserve_ai_request(a, gen_random_uuid(), attempt_id, 'q2', 'explain_solution', 'gpt-6-luna', 'low');
  if result->>'state' <> 'denied' then raise exception 'FAIL 19+2 must deny'; end if;
  req_id := gen_random_uuid();
  result := public.reserve_ai_request(a, req_id, attempt_id, 'q1', 'hint', 'gpt-6-luna', 'low');
  if result->>'state' <> 'created' or (result->>'remaining')::integer <> 0 then raise exception 'FAIL 19+1'; end if;
  result := public.reserve_ai_request(a, gen_random_uuid(), attempt_id, 'q1', 'hint', 'gpt-6-luna', 'low');
  if result->>'state' <> 'denied' then raise exception 'FAIL 20 used'; end if;
  if position('pg_advisory_xact_lock' in pg_get_functiondef('public.reserve_ai_request(uuid,uuid,uuid,text,text,text,text)'::regprocedure)) = 0 then
    raise exception 'FAIL transaction serialization is missing'; end if;
end $$;
reset role;

rollback;
select 'PASS: v0.3 practice security and v0.4 private atomic AI quota' as verification;
