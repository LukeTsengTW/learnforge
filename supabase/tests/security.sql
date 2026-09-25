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

-- v0.5 private read projections remain unavailable to browser roles.
set local role anon;
do $$ begin
  begin perform * from public.get_ai_responses_for_attempt(gen_random_uuid(), gen_random_uuid());
    raise exception 'FAIL anon AI restore RPC'; exception when insufficient_privilege then null; end;
  begin perform public.get_ai_usage_summary(gen_random_uuid());
    raise exception 'FAIL anon AI summary RPC'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_ai_usage_page(gen_random_uuid());
    raise exception 'FAIL anon AI page RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin perform * from public.get_ai_responses_for_attempt(auth.uid(), gen_random_uuid());
    raise exception 'FAIL authenticated AI restore RPC'; exception when insufficient_privilege then null; end;
  begin perform public.get_ai_usage_summary(auth.uid());
    raise exception 'FAIL authenticated AI summary RPC'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_ai_usage_page(auth.uid());
    raise exception 'FAIL authenticated AI page RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare
  a uuid := current_setting('test.user_a')::uuid; b uuid := current_setting('test.user_b')::uuid;
  attempt_b uuid := gen_random_uuid(); t timestamptz := statement_timestamp();
  response jsonb := '{"title":"base","message":"test","keyPoints":[],"nextStep":null}'::jsonb;
  summary jsonb; first_page uuid[]; next_page uuid[]; last_id uuid; last_at timestamptz;
begin
  summary := public.get_ai_usage_summary(b);
  if (summary->'last5Hours'->>'requestCount')::integer <> 0
    or (summary->'last5Hours'->>'inputTokens')::integer <> 0 then raise exception 'FAIL empty usage summary'; end if;

  -- Same timestamp and creation time: UUID descending breaks the final tie.
  insert into public.ai_requests(id,user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until,completed_at,response,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens)
  values
    ('00000000-0000-4000-8000-000000000001',b,gen_random_uuid(),attempt_b,'q1','hint',1,'gpt-6-luna','low',
      'completed',t-interval '3 minutes',t+interval '15 minutes',t-interval '2 minutes',
      jsonb_set(response,'{title}','"old"'::jsonb),null,null,null,null),
    ('00000000-0000-4000-8000-000000000002',b,gen_random_uuid(),attempt_b,'q1','hint',1,'gpt-6-luna','low',
      'completed',t-interval '1 minute',t+interval '15 minutes',t,
      jsonb_set(response,'{title}','"lower-id"'::jsonb),10,2,5,1),
    ('00000000-0000-4000-8000-000000000003',b,gen_random_uuid(),attempt_b,'q1','hint',1,'gpt-6-luna','low',
      'completed',t-interval '1 minute',t+interval '15 minutes',t,
      jsonb_set(response,'{title}','"latest-id"'::jsonb),null,null,null,null),
    (gen_random_uuid(),b,gen_random_uuid(),attempt_b,'q1','explain_mistake',1,'gpt-6-luna','low',
      'completed',t-interval '2 minutes',t+interval '15 minutes',t,
      jsonb_set(response,'{title}','"mistake"'::jsonb),null,null,null,null),
    (gen_random_uuid(),b,gen_random_uuid(),attempt_b,'q2','explain_solution',2,'gpt-6-luna','low',
      'completed',t-interval '2 minutes',t+interval '15 minutes',t,
      jsonb_set(response,'{title}','"solution"'::jsonb),null,null,null,null);
  insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until,refunded_at)
  values (b,gen_random_uuid(),attempt_b,'q3','hint',1,'gpt-6-luna','low',
    'refunded',t-interval '2 minutes',t+interval '15 minutes',t);
  insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until)
  values
    (b,gen_random_uuid(),attempt_b,'q4','hint',1,'gpt-6-luna','low','expired',t-interval '2 minutes',t-interval '1 minute'),
    (b,gen_random_uuid(),attempt_b,'q5','hint',1,'gpt-6-luna','low','reserved',t-interval '2 minutes',t+interval '15 minutes');
  insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until,completed_at,response)
  values (a,gen_random_uuid(),attempt_b,'q1','hint',1,'gpt-6-luna','low',
    'completed',t-interval '1 minute',t+interval '15 minutes',t,
    jsonb_set(response,'{title}','"other-user"'::jsonb));

  if (select r.response->>'title' from public.get_ai_responses_for_attempt(b,attempt_b) r
      where r.question_id='q1' and r.feature='hint') <> 'latest-id' then raise exception 'FAIL latest completed order'; end if;
  if (select count(*) from public.get_ai_responses_for_attempt(b,attempt_b) where not pending) <> 3 then
    raise exception 'FAIL completed feature/question projection'; end if;
  if (select count(*) from public.get_ai_responses_for_attempt(b,attempt_b) where pending) <> 1 then
    raise exception 'FAIL pending projection'; end if;
  if exists(select 1 from public.get_ai_responses_for_attempt(b,attempt_b) where question_id in ('q3','q4')) then
    raise exception 'FAIL refunded or expired restored'; end if;
  if (select r.response->>'title' from public.get_ai_responses_for_attempt(a,attempt_b) r
      where r.question_id='q1' and r.feature='hint') <> 'other-user' then raise exception 'FAIL user response isolation'; end if;

  summary := public.get_ai_usage_summary(b);
  if (summary->'last5Hours'->>'requestCount')::integer <> 8
    or (summary->'last5Hours'->>'completedCount')::integer <> 5
    or (summary->'last5Hours'->>'refundedCount')::integer <> 1
    or (summary->'last5Hours'->>'expiredCount')::integer <> 1
    or (summary->'last5Hours'->>'hintCount')::integer <> 3
    or (summary->'last5Hours'->>'inputTokens')::integer <> 10
    or (summary->'last5Hours'->>'cachedInputTokens')::integer <> 2
    or (summary->'last5Hours'->>'outputTokens')::integer <> 5
    or (summary->'last5Hours'->>'reasoningTokens')::integer <> 1
    or (summary->'last5Hours'->>'usageReportedCount')::integer <> 1 then
    raise exception 'FAIL five-hour counts or token sums'; end if;
  if (public.get_ai_usage_summary(a)->'last5Hours'->>'requestCount')::integer
    <= (summary->'last5Hours'->>'requestCount')::integer then
    raise exception 'FAIL user summary isolation fixture'; end if;

  insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until,completed_at,response)
  values
    (b,gen_random_uuid(),attempt_b,'old-6h','hint',1,'gpt-6-luna','low',
      'completed',t-interval '6 hours',t-interval '5 hours',t-interval '6 hours',response),
    (b,gen_random_uuid(),attempt_b,'old-25h','hint',1,'gpt-6-luna','low',
      'completed',t-interval '25 hours',t-interval '24 hours',t-interval '25 hours',response);
  summary := public.get_ai_usage_summary(b);
  if (summary->'last5Hours'->>'requestCount')::integer <> 8
    or (summary->'last24Hours'->>'requestCount')::integer <> 9
    or (summary->'allTime'->>'requestCount')::integer <> 10 then
    raise exception 'FAIL 5h/24h/all-time boundaries'; end if;

  insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,
    status,created_at,reserved_until,refunded_at)
  select b,gen_random_uuid(),attempt_b,'page-'||i,'hint',1,'gpt-6-luna','low',
    'refunded',t+interval '1 minute',t+interval '16 minutes',t
    from generate_series(1,21) i;
  select array_agg(p.id order by p.created_at desc,p.id desc) into first_page
    from public.get_ai_usage_page(b,null,null,20) p;
  select p.created_at,p.id into last_at,last_id from public.get_ai_usage_page(b,null,null,20) p
    order by p.created_at,p.id limit 1;
  select array_agg(p.id order by p.created_at desc,p.id desc) into next_page
    from public.get_ai_usage_page(b,last_at,last_id,20) p;
  if array_length(first_page,1) <> 20 or array_length(next_page,1) <> 11 then
    raise exception 'FAIL stable 20-row cursor pages'; end if;
  if (select count(distinct id) from unnest(first_page || next_page) as x(id)) <> 31 then
    raise exception 'FAIL duplicate or missing cursor rows'; end if;
  if (select count(*) from public.get_ai_usage_page(a,null,null,21) where question_id like 'page-%') <> 0 then
    raise exception 'FAIL usage page ownership isolation'; end if;
end $$;
reset role;

-- v0.6: only the server can create a medium-effort, exactly two-credit grading row.
set local role service_role;
do $$ declare
  a uuid := current_setting('test.user_a')::uuid; b uuid := current_setting('test.user_b')::uuid;
  attempt_id uuid := gen_random_uuid(); v_request_id uuid := gen_random_uuid(); v_other_id uuid := gen_random_uuid();
  result jsonb; quota jsonb; response jsonb := '{"kind":"calculation_grading","outcome":"refusal","message":"AI 無法提供此題的參考評分。"}'::jsonb;
begin
  -- All previous fixtures remain in the transaction for audit, but are outside this quota window.
  update public.ai_requests set created_at = now() - interval '6 hours' where user_id = a;
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 20 or (quota->'featureCosts'->>'calculation_grading')::integer <> 2
    or (quota->'featureCosts'->>'hint')::integer <> 1
    or (quota->'featureCosts'->>'explain_solution')::integer <> 2 then
    raise exception 'FAIL v0.6 quota feature costs'; end if;

  begin
    insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
      values(a,gen_random_uuid(),attempt_id,'q6','calculation_grading',1,'gpt-6-luna','medium','reserved',now()+interval '15 minutes');
    raise exception 'FAIL wrong grading cost accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
      values(a,gen_random_uuid(),attempt_id,'q6','calculation_grading',2,'gpt-6-luna','low','reserved',now()+interval '15 minutes');
    raise exception 'FAIL wrong grading effort accepted';
  exception when check_violation then null; end;
  begin
    perform public.reserve_ai_request(a,gen_random_uuid(),attempt_id,'q6','calculation_grading','gpt-6-luna','low');
    raise exception 'FAIL wrong RPC effort accepted';
  exception when invalid_parameter_value then null; end;

  for i in 1..18 loop
    result := public.reserve_ai_request(a,gen_random_uuid(),attempt_id,'q1','hint','gpt-6-luna','low');
    if result->>'state' <> 'created' then raise exception 'FAIL v0.6 hint cost'; end if;
  end loop;
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 2 then raise exception 'FAIL two-credit boundary'; end if;
  result := public.reserve_ai_request(a,v_request_id,attempt_id,'q6','calculation_grading','gpt-6-luna','medium');
  if result->>'state' <> 'created' or (result->>'credits')::integer <> 2
    or (result->>'remaining')::integer <> 0 then raise exception 'FAIL grading reservation'; end if;
  if not public.complete_ai_request(a,v_request_id,response,'resp_fixture',10,2,20,3) then
    raise exception 'FAIL grading completion'; end if;
  result := public.reserve_ai_request(a,v_request_id,attempt_id,'q6','calculation_grading','gpt-6-luna','medium');
  if result->>'state' <> 'completed' or result->'response' is distinct from response
    or (select count(*) from public.ai_requests r where r.user_id=a and r.request_id=v_request_id) <> 1 then
    raise exception 'FAIL grading replay'; end if;
  if (public.find_ai_request(b,v_request_id,attempt_id,'q6','calculation_grading','gpt-6-luna','medium')->>'state') <> 'missing'
    or exists(select 1 from public.get_ai_responses_for_attempt(b,attempt_id) where feature='calculation_grading') then
    raise exception 'FAIL grading user isolation'; end if;
  if (public.get_ai_usage_summary(a)->'last5Hours'->>'calculationGradingCount')::integer <> 1 then
    raise exception 'FAIL grading usage count'; end if;
  if (select count(*) from public.get_ai_responses_for_attempt(a,attempt_id)
    where feature='calculation_grading' and not pending) <> 1 then raise exception 'FAIL grading restore'; end if;

  -- Moving one prior hint outside the rolling window leaves one credit: deny.
  update public.ai_requests set created_at = now() - interval '6 hours'
    where id = (select id from public.ai_requests where user_id=a and feature='hint'
      and created_at > now()-interval '5 hours' order by created_at,id limit 1);
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 1 then raise exception 'FAIL one-credit boundary'; end if;
  result := public.reserve_ai_request(a,v_other_id,attempt_id,'q6','calculation_grading','gpt-6-luna','medium');
  if result->>'state' <> 'denied' then raise exception 'FAIL grading at one credit'; end if;

  -- Refund returns two credits, and a fresh request ID can reserve again.
  update public.ai_requests set created_at = now() - interval '6 hours' where user_id=a and feature='hint';
  v_other_id := gen_random_uuid();
  result := public.reserve_ai_request(a,v_other_id,attempt_id,'q6','calculation_grading','gpt-6-luna','medium');
  if result->>'state' <> 'created' then raise exception 'FAIL grading regeneration'; end if;
  if not public.refund_ai_request(a,v_other_id,'fixture_failure') then raise exception 'FAIL grading refund'; end if;
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 18 then raise exception 'FAIL grading refund restores two'; end if;
end $$;
reset role;

rollback;
select 'PASS: practice security, private AI quota, v0.5 restore and v0.6 grading' as verification;
