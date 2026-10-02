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
  begin perform 1 from private.fill_judge_cache; raise exception 'FAIL anon fill judge cache'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.fill_judge_calls; raise exception 'FAIL anon fill judge calls'; exception when insufficient_privilege then null; end;
  begin perform public.get_or_create_quiz_draft(null, 'demo', 'fixture'); raise exception 'FAIL anon draft RPC'; exception when insufficient_privilege then null; end;
  begin perform public.request_password_hint('v03_rls_fixture_a', repeat('a',64)); raise exception 'FAIL anon hint RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare first_id uuid; second_id uuid; row_a public.attempts; begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL own profile'; end if;
  begin perform 1 from public.password_hints; raise exception 'FAIL auth hints'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.fill_judge_cache; raise exception 'FAIL auth fill judge cache'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.fill_judge_calls; raise exception 'FAIL auth fill judge calls'; exception when insufficient_privilege then null; end;
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
    'answers','{"q1":{"type":"single","optionId":"b"},"qfill":{"type":"fill","text":"A"}}'::jsonb), row_a.updated_at);
  if (select count(*) from public.answers where attempt_id = first_id) <> 2 then raise exception 'FAIL own answer'; end if;
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
do $$ declare a public.attempts; begin
  select * into a from public.attempts where id = current_setting('test.first_attempt')::uuid;
  begin
    perform public.save_quiz_attempt_v3(a.id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
      'quizRevision','fixture','status','in-progress','startedAt',a.started_at,'updatedAt',clock_timestamp(),
      'answers','{}'::jsonb), a.updated_at - interval '1 second');
    raise exception 'FAIL stale CAS';
  exception when serialization_failure then null; end;
  begin
    perform public.save_quiz_attempt_v3(a.id, jsonb_build_object('ownerId',auth.uid(),'quizId','demo',
      'quizRevision','fixture','status','submitted','startedAt',a.started_at,'updatedAt',clock_timestamp(),
      'answers','{}'::jsonb,'result','{"score":999}'::jsonb), a.updated_at);
    raise exception 'FAIL old submit RPC bypass';
  exception when insufficient_privilege then null; end;
  begin
    update public.attempts set status='submitted',submitted_at=clock_timestamp(),
      deterministic_score=999,deterministic_max_score=999,correct_count=1,incorrect_count=0,unanswered_count=0
      where id=a.id;
    raise exception 'FAIL direct attempt submit bypass';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.fill_judgments(user_id,attempt_id,quiz_id,quiz_revision,question_id,
      answer_hash,judge_version,source,status)
      values(auth.uid(),a.id,'demo','fixture','qfill',repeat('a',64),'semantic-fill-v2','rule','correct');
    raise exception 'FAIL browser judgment insert';
  exception when insufficient_privilege then null; end;
  begin update public.fill_judgments set status='correct'; raise exception 'FAIL browser judgment update'; exception when insufficient_privilege then null; end;
  begin delete from public.fill_judgments; raise exception 'FAIL browser judgment delete'; exception when insufficient_privilege then null; end;
  begin perform public.finalize_semantic_fill_submission(auth.uid(),a.id,a.updated_at,gen_random_uuid(),'{}'::jsonb,'[]'::jsonb);
    raise exception 'FAIL browser finalize RPC'; exception when insufficient_privilege then null; end;
  begin perform public.claim_fill_judgment(auth.uid(),a.id,a.updated_at,'qfill',repeat('a',64),gen_random_uuid());
    raise exception 'FAIL browser judge claim RPC'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.fill_judgments) then raise exception 'FAIL draft judgment visibility'; end if;
end $$;
reset role;

-- Trusted finalization is atomic; security fixtures never call OpenAI.
set local role service_role;
do $$ declare a public.attempts; saved public.attempts; request_id uuid:=gen_random_uuid(); hash_a text; begin
  select * into a from public.attempts where id=current_setting('test.first_attempt')::uuid;
  hash_a:=encode(sha256(convert_to('A','UTF8')),'hex');
  begin perform public.finalize_semantic_fill_submission(current_setting('test.user_b')::uuid,a.id,
    a.updated_at,request_id,'{}'::jsonb,'[]'::jsonb); raise exception 'FAIL cross-user finalize';
  exception when serialization_failure then null; end;
  select * into saved from public.finalize_semantic_fill_submission(current_setting('test.user_a')::uuid,a.id,
    a.updated_at,request_id,'{"score":2,"maxScore":10,"correctCount":1,"incorrectCount":0,"unansweredCount":0}'::jsonb,
    jsonb_build_array(jsonb_build_object('questionId','qfill','answerHash',hash_a,'source','rule',
      'status','correct','confidence',null,'reason',null)));
  if saved.status <> 'submitted' or saved.grading_version <> 'semantic-fill-v2'
    or (select count(*) from public.fill_judgments where attempt_id=a.id) <> 1 then
    raise exception 'FAIL trusted finalization'; end if;
  select * into saved from public.finalize_semantic_fill_submission(current_setting('test.user_a')::uuid,a.id,
    a.updated_at,request_id,'{}'::jsonb,'[]'::jsonb);
  if saved.id <> a.id then raise exception 'FAIL idempotent finalization'; end if;
end $$;
reset role;

-- A missing second stored fill judgment rejects the whole finalization statement.
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; draft_row public.attempts;
begin
  insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
    values(owner_id,'v11-incomplete-fixture','1','draft',clock_timestamp(),clock_timestamp()) returning * into draft_row;
  insert into public.answers(attempt_id,user_id,question_id,answer) values
    (draft_row.id,owner_id,'fill-one',jsonb_build_object('type','fill','text','CPU')),
    (draft_row.id,owner_id,'fill-two',jsonb_build_object('type','fill','text','RAM'));
  perform set_config('test.incomplete_attempt',draft_row.id::text,true);
end $$;
set local role service_role;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; draft_row public.attempts;
  cpu_hash text:=encode(sha256(convert_to('CPU','UTF8')),'hex');
begin
  select * into draft_row from public.attempts where id=current_setting('test.incomplete_attempt')::uuid;
  begin
    perform public.finalize_semantic_fill_submission(owner_id,draft_row.id,draft_row.updated_at,
      gen_random_uuid(),jsonb_build_object('score',2,'maxScore',4,'correctCount',1,
        'incorrectCount',0,'unansweredCount',0),
      jsonb_build_array(jsonb_build_object('questionId','fill-one','answerHash',cpu_hash,
        'source','rule','status','correct','confidence',null,'reason',null)));
    raise exception 'FAIL incomplete fill judgment set accepted';
  exception when check_violation then
    if sqlerrm <> 'Incomplete fill judgment set' then raise; end if;
  end;
  select * into draft_row from public.attempts where id=draft_row.id;
  if draft_row.status <> 'draft' or draft_row.grading_version <> 'deterministic-v1'
    or draft_row.submission_request_id is not null
    or (select count(*) from public.answers where attempt_id=draft_row.id and answer->>'type'='fill') <> 2
    or exists(select 1 from public.fill_judgments where attempt_id=draft_row.id) then
    raise exception 'FAIL incomplete fill finalization was not atomic';
  end if;
end $$;
reset role;

-- v1.1 fake-provider transaction checks: no OpenAI call and no user-credit debit.
do $$ declare a uuid:=current_setting('test.user_a')::uuid; draft_row public.attempts;
begin
  insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
    values(a,'v11-ai-fixture','1','draft',clock_timestamp(),clock_timestamp()) returning * into draft_row;
  insert into public.answers(attempt_id,user_id,question_id,answer)
    values(draft_row.id,a,'fill-one','{"type":"fill","text":"CPU"}'::jsonb);
  perform set_config('test.ai_attempt',draft_row.id::text,true);
  perform set_config('test.ai_request_id',gen_random_uuid()::text,true);
end $$;
set local role service_role;
do $$ declare a uuid:=current_setting('test.user_a')::uuid; draft_row public.attempts;
  old_version timestamptz; cpu_hash text; first_claim jsonb;
  before_credits integer; request_id uuid:=current_setting('test.ai_request_id')::uuid;
begin
  before_credits:=(public.get_ai_quota_status(a)->>'remaining')::integer;
  perform set_config('test.ai_before_credits',before_credits::text,true);
  select * into draft_row from public.attempts where id=current_setting('test.ai_attempt')::uuid;
  old_version:=draft_row.updated_at;
  perform set_config('test.ai_old_version',old_version::text,true);
  cpu_hash:=encode(sha256(convert_to('CPU','UTF8')),'hex');
  if public.claim_fill_judgment(a,draft_row.id,old_version,'arbitrary-id',cpu_hash,request_id)->>'state' <> 'conflict'
    then raise exception 'FAIL arbitrary question claim'; end if;
  first_claim:=public.claim_fill_judgment(a,draft_row.id,old_version,'fill-one',cpu_hash,request_id);
  if first_claim->>'state' <> 'claimed' then raise exception 'FAIL first AI claim'; end if;
  if public.claim_fill_judgment(a,draft_row.id,old_version,'fill-one',cpu_hash,request_id)->>'state' <> 'in_progress'
    then raise exception 'FAIL concurrent AI reservation'; end if;
  if not public.complete_fill_judgment((first_claim->>'claimToken')::uuid,'correct','high','同一概念。',
    'fake-provider-id',10,0,12,2) then raise exception 'FAIL fake AI completion'; end if;
  if public.claim_fill_judgment(a,draft_row.id,old_version,'fill-one',cpu_hash,request_id)->>'state' <> 'cached'
    then raise exception 'FAIL exact answer AI reuse'; end if;
end $$;
reset role;
do $$ declare draft_id uuid:=current_setting('test.ai_attempt')::uuid;
  old_version timestamptz:=current_setting('test.ai_old_version')::timestamptz;
begin
  update public.answers set answer='{"type":"fill","text":"GPU"}'::jsonb
    where attempt_id=draft_id and question_id='fill-one';
  if (select updated_at from public.attempts where id=draft_id) <= old_version
    then raise exception 'FAIL direct answer write did not advance CAS'; end if;
end $$;
set local role service_role;
do $$ declare a uuid:=current_setting('test.user_a')::uuid; draft_row public.attempts;
  old_version timestamptz:=current_setting('test.ai_old_version')::timestamptz;
  cpu_hash text:=encode(sha256(convert_to('CPU','UTF8')),'hex');
  gpu_hash text:=encode(sha256(convert_to('GPU','UTF8')),'hex');
  second_claim jsonb; after_credits integer;
  request_id uuid:=current_setting('test.ai_request_id')::uuid;
begin
  select * into draft_row from public.attempts where id=current_setting('test.ai_attempt')::uuid;
  if public.claim_fill_judgment(a,draft_row.id,old_version,'fill-one',cpu_hash,request_id)->>'state' <> 'conflict'
    then raise exception 'FAIL stale AI claim'; end if;
  begin
    perform public.finalize_semantic_fill_submission(a,draft_row.id,old_version,request_id,
      '{"score":2,"maxScore":2,"correctCount":1,"incorrectCount":0,"unansweredCount":0}'::jsonb,
      jsonb_build_array(jsonb_build_object('questionId','fill-one','answerHash',cpu_hash,
        'source','ai','status','correct','confidence','high','reason','同一概念。')));
    raise exception 'FAIL stale AI finalize';
  exception when serialization_failure then null; end;
  select * into draft_row from public.attempts where id=draft_row.id;
  if draft_row.status <> 'draft' or exists(select 1 from public.fill_judgments where attempt_id=draft_row.id)
    then raise exception 'FAIL stale verdict changed official state'; end if;
  second_claim:=public.claim_fill_judgment(a,draft_row.id,draft_row.updated_at,'fill-one',gpu_hash,request_id);
  if second_claim->>'state' <> 'claimed' then raise exception 'FAIL changed answer reused old verdict'; end if;
  if not public.complete_fill_judgment((second_claim->>'claimToken')::uuid,'incorrect','high','概念不同。',
    'fake-provider-id-2',11,0,9,2) then raise exception 'FAIL changed answer completion'; end if;
  perform public.finalize_semantic_fill_submission(a,draft_row.id,draft_row.updated_at,request_id,
    '{"score":0,"maxScore":2,"correctCount":0,"incorrectCount":1,"unansweredCount":0}'::jsonb,
    jsonb_build_array(jsonb_build_object('questionId','fill-one','answerHash',gpu_hash,
      'source','ai','status','incorrect','confidence','high','reason','概念不同。')));
  if (select answer_hash from public.fill_judgments where attempt_id=draft_row.id) <> gpu_hash
    then raise exception 'FAIL official judgment answer binding'; end if;
  after_credits:=(public.get_ai_quota_status(a)->>'remaining')::integer;
  if after_credits <> current_setting('test.ai_before_credits')::integer
    then raise exception 'FAIL formal grading consumed user credits'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare a public.attempts; b public.attempts; draft_row public.attempts; begin
  select * into a from public.attempts where id=current_setting('test.first_attempt')::uuid;
  if (select count(*) from public.fill_judgments where attempt_id=a.id) <> 1 then raise exception 'FAIL own final judgment read'; end if;
  begin update public.fill_judgments set status='incorrect' where attempt_id=a.id; raise exception 'FAIL final judgment update'; exception when insufficient_privilege then null; end;
  begin delete from public.fill_judgments where attempt_id=a.id; raise exception 'FAIL final judgment delete'; exception when insufficient_privilege then null; end;
  begin update public.answers set answer='{}' where attempt_id=a.id; raise exception 'FAIL submitted answer update'; exception when check_violation then null; end;
  begin delete from public.answers where attempt_id=a.id; raise exception 'FAIL submitted answer delete'; exception when check_violation then null; end;
  delete from public.attempts where id=a.id;
  if found then raise exception 'FAIL submitted delete'; end if;
  select * into b from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  if b.id = a.id then raise exception 'FAIL practice again identity'; end if;
  perform set_config('test.second_attempt',b.id::text,true);
end $$;
reset role;

set local role service_role;
do $$ declare b public.attempts; begin
  select * into b from public.attempts where id=current_setting('test.second_attempt')::uuid;
  perform public.finalize_semantic_fill_submission(current_setting('test.user_a')::uuid,b.id,b.updated_at,
    gen_random_uuid(),'{"score":0,"maxScore":10,"correctCount":0,"incorrectCount":0,"unansweredCount":5}'::jsonb,'[]'::jsonb);
  if (select count(*) from public.attempts where quiz_id='demo' and status='submitted' and user_id=current_setting('test.user_a')::uuid) <> 2 then raise exception 'FAIL two submissions'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare draft_row public.attempts; begin
  select * into draft_row from public.get_or_create_quiz_draft(auth.uid(), 'demo', 'fixture');
  if draft_row.id in (current_setting('test.first_attempt')::uuid,current_setting('test.second_attempt')::uuid) then raise exception 'FAIL third draft identity'; end if;
  delete from public.attempts where id=draft_row.id;
  if not found then raise exception 'FAIL own draft delete'; end if;
  if (select count(*) from public.attempts where quiz_id='demo' and status='submitted' and user_id=current_setting('test.user_a')::uuid) <> 2 then raise exception 'FAIL history preservation'; end if;
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

-- v0.7: four-credit drawing requests use the same private ledger and rollback fixture.
set local role service_role;
do $$ declare
  a uuid := current_setting('test.user_a')::uuid; b uuid := current_setting('test.user_b')::uuid;
  attempt_id uuid := gen_random_uuid(); first_id uuid := gen_random_uuid(); retry_id uuid := gen_random_uuid();
  result jsonb; quota jsonb; summary jsonb;
  response jsonb := '{"kind":"drawing_analysis","outcome":"refusal","message":"AI 無法可靠分析此圖。"}'::jsonb;
begin
  update public.ai_requests set created_at = now() - interval '6 hours' where user_id = a;
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 20 or (quota->'featureCosts'->>'drawing_analysis')::integer <> 4
    or (quota->'featureCosts'->>'hint')::integer <> 1
    or (quota->'featureCosts'->>'calculation_grading')::integer <> 2 then
    raise exception 'FAIL v0.7 quota feature costs'; end if;

  begin
    insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
      values(a,gen_random_uuid(),attempt_id,'q7','drawing_analysis',2,'gpt-6-luna','medium','reserved',now()+interval '15 minutes');
    raise exception 'FAIL wrong drawing cost accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ai_requests(user_id,request_id,attempt_id,question_id,feature,credits,model,reasoning_effort,status,reserved_until)
      values(a,gen_random_uuid(),attempt_id,'q7','drawing_analysis',4,'gpt-6-luna','low','reserved',now()+interval '15 minutes');
    raise exception 'FAIL wrong drawing effort accepted';
  exception when check_violation then null; end;
  begin
    perform public.reserve_ai_request(a,gen_random_uuid(),attempt_id,'q7','drawing_analysis','gpt-6-luna','low');
    raise exception 'FAIL wrong drawing RPC effort accepted';
  exception when invalid_parameter_value then null; end;

  for i in 1..16 loop
    result := public.reserve_ai_request(a,gen_random_uuid(),attempt_id,'q1','hint','gpt-6-luna','low');
    if result->>'state' <> 'created' then raise exception 'FAIL existing hint cost regression'; end if;
  end loop;
  quota := public.get_ai_quota_status(a);
  if (quota->>'remaining')::integer <> 4 then raise exception 'FAIL four-credit boundary'; end if;
  result := public.reserve_ai_request(a,first_id,attempt_id,'q7','drawing_analysis','gpt-6-luna','medium');
  if result->>'state' <> 'created' or (result->>'credits')::integer <> 4
    or (result->>'remaining')::integer <> 0 then raise exception 'FAIL drawing reservation'; end if;
  if not public.complete_ai_request(a,first_id,response,'resp_fixture',100,5,20,3) then
    raise exception 'FAIL drawing completion'; end if;
  result := public.reserve_ai_request(a,first_id,attempt_id,'q7','drawing_analysis','gpt-6-luna','medium');
  if result->>'state' <> 'completed' or result->'response' is distinct from response then
    raise exception 'FAIL drawing idempotent replay'; end if;
  if (public.find_ai_request(b,first_id,attempt_id,'q7','drawing_analysis','gpt-6-luna','medium')->>'state') <> 'missing'
    or exists(select 1 from public.get_ai_responses_for_attempt(b,attempt_id) where feature='drawing_analysis') then
    raise exception 'FAIL drawing user isolation'; end if;
  summary := public.get_ai_usage_summary(a);
  if (summary->'last5Hours'->>'drawingAnalysisCount')::integer <> 1
    or (summary->'last5Hours'->>'inputTokens')::integer <> 100 then
    raise exception 'FAIL drawing usage summary'; end if;
  if (select count(*) from public.get_ai_responses_for_attempt(a,attempt_id)
    where feature='drawing_analysis' and not pending) <> 1 then raise exception 'FAIL drawing restore'; end if;

  update public.ai_requests set created_at = now() - interval '6 hours'
    where id in (select id from public.ai_requests where user_id=a and feature='hint'
      and created_at > now()-interval '5 hours' order by id limit 3);
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 3 then raise exception 'FAIL three-credit boundary'; end if;
  result := public.reserve_ai_request(a,retry_id,attempt_id,'q7','drawing_analysis','gpt-6-luna','medium');
  if result->>'state' <> 'denied' then raise exception 'FAIL drawing at three credits'; end if;
  update public.ai_requests set created_at = now() - interval '6 hours'
    where id = (select id from public.ai_requests where user_id=a and feature='hint'
      and created_at > now()-interval '5 hours' order by id limit 1);
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 4 then raise exception 'FAIL renewed four credits'; end if;
  result := public.reserve_ai_request(a,retry_id,attempt_id,'q7','drawing_analysis','gpt-6-luna','medium');
  if result->>'state' <> 'created' then raise exception 'FAIL drawing regeneration'; end if;
  if not public.refund_ai_request(a,retry_id,'fixture_failure') then raise exception 'FAIL drawing refund'; end if;
  if (public.get_ai_quota_status(a)->>'remaining')::integer <> 4 then raise exception 'FAIL drawing refund restores four'; end if;
end $$;
reset role;

-- v1.0 recovery: no raw secret fixtures; only non-secret synthetic digests.
select set_config('test.session_a', gen_random_uuid()::text, true);
insert into auth.sessions(id,user_id) values(current_setting('test.session_a')::uuid,current_setting('test.user_a')::uuid);
set local role anon;
do $$ begin
  begin perform 1 from private.account_recovery_codes; raise exception 'FAIL anon recovery table'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.recovery_rate_limits; raise exception 'FAIL anon recovery limits'; exception when insufficient_privilege then null; end;
  begin perform public.claim_account_recovery('v03_rls_fixture_a',repeat('a',64),repeat('b',64)); raise exception 'FAIL anon recovery RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform 1 from private.account_recovery_codes; raise exception 'FAIL auth recovery table'; exception when insufficient_privilege then null; end;
  begin perform public.manage_account_recovery(current_setting('test.user_b')::uuid,current_setting('test.session_a')::uuid,repeat('c',64)); raise exception 'FAIL auth rotation RPC'; exception when insufficient_privilege then null; end;
  begin perform public.release_account_recovery(current_setting('test.user_a')::uuid,gen_random_uuid()); raise exception 'FAIL auth release RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare a uuid:=current_setting('test.user_a')::uuid; b uuid:=current_setting('test.user_b')::uuid;
  sid uuid:=current_setting('test.session_a')::uuid; result jsonb;
begin
  result:=public.manage_account_recovery(b,sid,repeat('a',64));
  if (result->>'validSession')::boolean then raise exception 'FAIL cross-user session binding'; end if;
  result:=public.manage_account_recovery(a,sid,repeat('a',64));
  if not (result->>'active')::boolean or result ? 'code' or result ? 'code_hash' then raise exception 'FAIL recovery status projection'; end if;
  perform public.manage_account_recovery(a,sid,repeat('c',64));
  if not (public.claim_account_recovery('v03_rls_fixture_a',repeat('a',64),repeat('b',64))->>'invalid')::boolean then raise exception 'FAIL old code after rotation'; end if;
  result:=public.claim_account_recovery('v03_rls_fixture_a',repeat('c',64),repeat('b',64));
  if result->>'userId' <> a::text then raise exception 'FAIL valid claim'; end if;
  perform set_config('test.claim_a',result->>'claimId',true);
  if not (public.claim_account_recovery('v03_rls_fixture_a',repeat('c',64),repeat('b',64))->>'invalid')::boolean then raise exception 'FAIL concurrent claim'; end if;
end $$;
reset role;
-- Match GoTrue Admin's separate SQL statements in ONE transaction. Flush at the
-- fixture checkpoint because the overall test transaction intentionally rolls back.
set constraints auth.learnforge_consume_recovery deferred;
update auth.users set encrypted_password='fixture-hash-v10' where id=current_setting('test.user_a')::uuid;
update auth.users set raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',current_setting('test.claim_a')) where id=current_setting('test.user_a')::uuid;
set constraints auth.learnforge_consume_recovery immediate;
do $$ begin
  if exists(select 1 from auth.sessions where user_id=current_setting('test.user_a')::uuid) then raise exception 'FAIL revoked recovery sessions'; end if;
  if (select state from private.account_recovery_codes where user_id=current_setting('test.user_a')::uuid) <> 'used' then raise exception 'FAIL atomic consume'; end if;
  if (select raw_app_meta_data ? 'learnforge_recovery_claim' from auth.users where id=current_setting('test.user_a')::uuid) then raise exception 'FAIL transient marker persisted'; end if;
  begin
    update auth.users set encrypted_password='fixture-replay',raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',current_setting('test.claim_a')) where id=current_setting('test.user_a')::uuid;
    raise exception 'FAIL late admin replay';
  exception when check_violation then null; end;
end $$;
set local role service_role;
do $$ begin
  if not (public.claim_account_recovery('v03_rls_fixture_a',repeat('c',64),repeat('b',64))->>'invalid')::boolean then raise exception 'FAIL used code replay'; end if;
  if public.release_account_recovery(current_setting('test.user_a')::uuid,current_setting('test.claim_a')::uuid) <> 'used' then raise exception 'FAIL ambiguous committed update'; end if;
end $$;
reset role;
-- Test cancellation and TTL with rollback-only state, independent of production counters.
insert into auth.sessions(id,user_id) values(current_setting('test.session_a')::uuid,current_setting('test.user_a')::uuid);
update private.account_recovery_codes set state='claiming',used_at=null,claim_id=gen_random_uuid(),claim_expires_at=clock_timestamp()-interval '1 second' where user_id=current_setting('test.user_a')::uuid;
do $$ declare a uuid:=current_setting('test.user_a')::uuid; cid uuid; original text; begin
  select claim_id into cid from private.account_recovery_codes where user_id=a;
  select encrypted_password into original from auth.users where id=a;
  begin
    update auth.users set encrypted_password='fixture-expired',raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',cid) where id=a;
    raise exception 'FAIL expired claim accepted';
  exception when check_violation then null; end;
  perform public.release_account_recovery(a,cid);
  begin
    update auth.users set encrypted_password='fixture-cancelled',raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',cid) where id=a;
    raise exception 'FAIL cancelled claim accepted';
  exception when check_violation then null; end;
  if (select encrypted_password from auth.users where id=a) <> original then raise exception 'FAIL rejected recovery changed password'; end if;
  if (select state from private.account_recovery_codes where user_id=a) <> 'active' then raise exception 'FAIL safe rollback lost code'; end if;
  -- Metadata alone cannot consume a code without changing the password.
  update private.account_recovery_codes set state='claiming',claim_id=cid,claim_expires_at=clock_timestamp()+interval '5 minutes' where user_id=a;
  begin
    update auth.users set raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',cid) where id=a;
    raise exception 'FAIL metadata-only recovery accepted';
  exception when check_violation then null; end;
  -- A failed deferred fence rolls back BOTH separate Auth statements.
  update private.account_recovery_codes set claim_expires_at=clock_timestamp()-interval '1 second' where user_id=a;
  begin
    set constraints auth.learnforge_consume_recovery deferred;
    update auth.users set encrypted_password='fixture-split-expired' where id=a;
    update auth.users set raw_app_meta_data=jsonb_build_object('learnforge_recovery_claim',cid) where id=a;
    set constraints auth.learnforge_consume_recovery immediate;
    raise exception 'FAIL expired split Auth transaction accepted';
  exception when check_violation then null; end;
  set constraints auth.learnforge_consume_recovery immediate;
  if (select encrypted_password from auth.users where id=a) <> original then raise exception 'FAIL split Auth failure changed password'; end if;
end $$;
set local role service_role;
do $$ declare i integer; result jsonb; begin
  for i in 1..6 loop result:=public.claim_account_recovery('nonexistent_v10',repeat('a',64),repeat('d',64)); end loop;
  if not (result->>'limited')::boolean then raise exception 'FAIL durable username rate limit'; end if;
  for i in 1..21 loop result:=public.claim_account_recovery('unknown_v10_'||i,repeat('a',64),repeat('e',64)); end loop;
  if not (result->>'limited')::boolean then raise exception 'FAIL durable IP rate limit'; end if;
end $$;
reset role;
update private.recovery_rate_limits set requests=200 where bucket='global';
set local role service_role;
do $$ begin
  if not (public.claim_account_recovery('global_v10_fixture',repeat('a',64),repeat('f',64))->>'limited')::boolean then raise exception 'FAIL durable global rate limit'; end if;
end $$;
reset role;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then raise exception 'FAIL event trigger browser grant'; end if;
    create table public.lfv10_security_rls_fixture(id integer);
    if not (select relrowsecurity from pg_class where oid='public.lfv10_security_rls_fixture'::regclass) then raise exception 'FAIL RLS automation'; end if;
  end if;
end $$;

-- v1.2 rubric grading: system cache is private and finalization is server-only and atomic.
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not has_table_privilege('authenticated','public.attempts','UPDATE')
    or not has_table_privilege('authenticated','public.answers','INSERT') then
    raise exception 'FAIL browser attempt/answer privileges changed'; end if;
  begin perform 1 from private.rubric_judge_cache; raise exception 'FAIL auth rubric cache'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.rubric_judge_calls; raise exception 'FAIL auth rubric calls'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.rubric_judgments) then raise exception 'FAIL auth draft rubric read'; end if;
  begin perform public.finalize_ai_grading_submission(null::uuid,null::uuid,null::timestamptz,null::uuid,null::text,null::text,
    '{}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb); raise exception 'FAIL authenticated finalize';
    exception when insufficient_privilege then null; end;
  begin
    insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at,grading_version,
      submission_request_id,submitted_at,deterministic_score,deterministic_max_score,correct_count,partial_count,
      incorrect_count,unanswered_count)
    values(auth.uid(),'v12-forged-insert','1','draft',clock_timestamp(),clock_timestamp(),'ai-grading-v3',
      gen_random_uuid(),clock_timestamp(),1,1,1,0,0,0);
    raise exception 'FAIL authenticated forged attempt insert';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role postgres;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; a public.attempts;
begin
  insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
    values(owner_id,'v12-rubric-fixture','fixture-v1','draft',clock_timestamp(),clock_timestamp()) returning * into a;
  insert into public.answers(attempt_id,user_id,question_id,answer) values
    (a.id,owner_id,'v12_single','{"type":"single","optionId":"b"}'::jsonb),
    (a.id,owner_id,'v12_multiple','{"type":"multiple","optionIds":["a","b"]}'::jsonb),
    (a.id,owner_id,'v12_tf','{"type":"true-false","value":false}'::jsonb),
    (a.id,owner_id,'v12_fill','{"type":"fill","text":"CPU"}'::jsonb),
    (a.id,owner_id,'v12_calc','{"type":"calculation","text":"x=2"}'::jsonb),
    (a.id,owner_id,'v12_draw','{"type":"drawing","strokes":[{"tool":"pen","color":"#202b38","width":4,"points":[{"x":20,"y":150},{"x":350,"y":150}]}]}'::jsonb),
    (a.id,owner_id,'v12_blank_calc','{"type":"calculation","text":"   "}'::jsonb),
    (a.id,owner_id,'v12_blank_draw','{"type":"drawing","strokes":[{"tool":"pen","color":"#202b38","width":4,"points":[{"x":20,"y":150},{"x":350,"y":150}]},{"tool":"eraser","color":"#202b38","width":12,"points":[{"x":20,"y":150},{"x":350,"y":150}]}]}'::jsonb);
  select * into a from public.attempts where id=a.id;
  perform set_config('test.v12_attempt',a.id::text,true);
  perform set_config('test.v12_updated_at',a.updated_at::text,true);
  perform set_config('test.v12_request_id',gen_random_uuid()::text,true);
end $$;
reset role;
set local role service_role;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; a uuid:=current_setting('test.v12_attempt')::uuid;
begin
  if not has_table_privilege('service_role','public.attempts','SELECT')
    or not has_table_privilege('service_role','public.attempts','UPDATE')
    or has_table_privilege('service_role','public.attempts','INSERT')
    or not has_table_privilege('service_role','public.answers','SELECT')
    or has_table_privilege('service_role','public.answers','INSERT')
    or has_table_privilege('service_role','public.answers','UPDATE')
    or not has_table_privilege('service_role','public.answers','DELETE')
    or not has_column_privilege('service_role','public.answers','attempt_id','INSERT')
    or not has_column_privilege('service_role','public.answers','user_id','INSERT')
    or not has_column_privilege('service_role','public.answers','question_id','INSERT')
    or not has_column_privilege('service_role','public.answers','answer','INSERT')
    or has_column_privilege('service_role','public.answers','id','INSERT')
    or not has_table_privilege('service_role','public.fill_judgments','INSERT')
    or not has_table_privilege('service_role','public.rubric_judgments','INSERT') then
    raise exception 'FAIL service_role least privilege'; end if;
  begin
    insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
      values(owner_id,'service-role-forged','1','draft',clock_timestamp(),clock_timestamp());
    raise exception 'FAIL service_role inserted attempt'; exception when insufficient_privilege then null; end;
  begin
    insert into public.answers(id,attempt_id,user_id,question_id,answer)
      values(gen_random_uuid(),a,owner_id,'service-role-forged','{}'::jsonb);
    raise exception 'FAIL service_role inserted answer'; exception when insufficient_privilege then null; end;
  begin update public.answers set answer=answer where attempt_id=a; raise exception 'FAIL service_role updated answers';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; other_id uuid:=current_setting('test.user_b')::uuid;
  a public.attempts; claim jsonb; retry_claim jsonb; draw_claim jsonb; response jsonb;
  blank_calc_claim jsonb; blank_draw_claim jsonb; missing_draw_claim jsonb;
begin
  select * into a from public.attempts where id=current_setting('test.v12_attempt')::uuid;
  if public.claim_rubric_judgment(other_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false)->>'state' <> 'conflict' then
    raise exception 'FAIL rubric claim wrong owner'; end if;
  if public.claim_rubric_judgment(owner_id,a.id,a.updated_at-interval '1 second',current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false)->>'state' <> 'conflict' then
    raise exception 'FAIL stale rubric claim'; end if;
  if public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','drawing',2,false)->>'state' <> 'conflict' then
    raise exception 'FAIL question type identity'; end if;
  claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false);
  if claim->>'state' <> 'claimed' then raise exception 'FAIL initial rubric claim'; end if;
  if public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false)->>'state' <> 'in_progress' then
    raise exception 'FAIL duplicate active rubric reservation'; end if;
  perform public.fail_rubric_judgment((claim->>'claimToken')::uuid,'synthetic_retry');
  retry_claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false);
  if retry_claim->>'state' <> 'claimed' or retry_claim->>'claimToken' = claim->>'claimToken' then
    raise exception 'FAIL failed claim retry'; end if;
  response:=jsonb_build_object('questionId','v12_calc','questionType','calculation','answerHash',retry_claim->>'answerHash',
    'score',3,'maxScore',2,'criteria','[]'::jsonb,'confidence','medium','summary','Synthetic');
  if public.complete_rubric_judgment((retry_claim->>'claimToken')::uuid,response,'synthetic-invalid',1,0,1,0) then
    raise exception 'FAIL malformed score accepted'; end if;
  response:=jsonb_build_object('questionId','v12_calc','questionType','calculation','answerHash',retry_claim->>'answerHash',
    'score',1,'maxScore',2,'criteria',jsonb_build_array(
      jsonb_build_object('criterionId','r1','maxScore',1,'awardedScore',1,'status','full'),
      jsonb_build_object('criterionId','r2','maxScore',1,'awardedScore',0,'status','none')),
    'confidence','medium','summary','Synthetic calculation feedback');
  if not public.complete_rubric_judgment((retry_claim->>'claimToken')::uuid,response,'synthetic-calc-id',10,0,20,5) then
    raise exception 'FAIL valid calculation completion'; end if;
  if public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_calc','calculation',2,false)->>'state' <> 'cached' then
    raise exception 'FAIL completed rubric judgment cache'; end if;
  draw_claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_draw','drawing',2,false);
  if draw_claim->>'state' <> 'claimed' or draw_claim->>'answerHash' = retry_claim->>'answerHash' then
    raise exception 'FAIL drawing cache identity isolation'; end if;
  response:=jsonb_build_object('questionId','v12_draw','questionType','drawing','answerHash',draw_claim->>'answerHash',
    'score',1,'maxScore',2,'criteria',jsonb_build_array(
      jsonb_build_object('criterionId','r1','maxScore',1,'awardedScore',0.5,'status','partial'),
      jsonb_build_object('criterionId','r2','maxScore',1,'awardedScore',0.5,'status','partial')),
    'confidence','low','summary','Synthetic drawing feedback','observations',jsonb_build_array('Visible outline'),
    'missingOrUnclear',jsonb_build_array('One label unclear'));
  if not public.complete_rubric_judgment((draw_claim->>'claimToken')::uuid,response,'synthetic-draw-id',12,0,24,6) then
    raise exception 'FAIL valid drawing completion'; end if;
  blank_calc_claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_blank_calc','calculation',1,true);
  blank_draw_claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_blank_draw','drawing',1,true);
  if blank_calc_claim->>'state' <> 'unanswered' or blank_draw_claim->>'state' <> 'unanswered'
    or blank_calc_claim ? 'claimToken' or blank_draw_claim ? 'claimToken' then
    raise exception 'FAIL blank/system rubric claim'; end if;
  missing_draw_claim:=public.claim_rubric_judgment(owner_id,a.id,a.updated_at,current_setting('test.v12_request_id')::uuid,
    a.quiz_id,a.quiz_revision,'v12_blank_draw','drawing',1,false);
  if missing_draw_claim->>'state' <> 'claimed' or missing_draw_claim->>'answerHash' is null then
    raise exception 'FAIL missing drawing must reserve raster work under the system bound'; end if;
  perform public.fail_rubric_judgment((missing_draw_claim->>'claimToken')::uuid,'raster_blank');
  if not exists(select 1 from private.rubric_judge_calls where claim_token=(missing_draw_claim->>'claimToken')::uuid
    and status='failed' and error_code='raster_blank') then
    raise exception 'FAIL blank drawing raster claim was not released into the system ledger'; end if;
  perform set_config('test.v12_calc_judgment',jsonb_build_object('questionId','v12_calc','questionType','calculation',
    'answerHash',retry_claim->>'answerHash','source','ai','status','partial','score',1,'maxScore',2,'criteria',jsonb_build_array(
      jsonb_build_object('criterionId','r1','maxScore',1,'awardedScore',1,'status','full'),
      jsonb_build_object('criterionId','r2','maxScore',1,'awardedScore',0,'status','none')),
    'confidence','medium','summary','Synthetic calculation feedback','model','gpt-6-luna','reasoningEffort','medium')::text,true);
  perform set_config('test.v12_draw_judgment',(response||jsonb_build_object('source','ai','status','partial',
    'model','gpt-6-luna','reasoningEffort','medium'))::text,true);
  perform set_config('test.v12_blank_calc_judgment',jsonb_build_object('questionId','v12_blank_calc',
    'questionType','calculation','answerHash',blank_calc_claim->>'answerHash','source','system','status','unanswered',
    'score',0,'maxScore',1,'criteria','[]'::jsonb)::text,true);
  perform set_config('test.v12_blank_draw_judgment',jsonb_build_object('questionId','v12_blank_draw',
    'questionType','drawing','answerHash',blank_draw_claim->>'answerHash','source','system','status','unanswered',
    'score',0,'maxScore',1,'criteria','[]'::jsonb)::text,true);
  perform set_config('test.v12_fill_hash',encode(sha256(convert_to('CPU','UTF8')),'hex'),true);
  perform set_config('test.v12_quota_before',(public.get_ai_quota_status(owner_id)->>'remaining'),true);
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare a uuid:=current_setting('test.v12_attempt')::uuid; owner_id uuid:=current_setting('test.user_a')::uuid;
begin
  begin update public.attempts set grading_version='ai-grading-v3' where id=a; raise exception 'FAIL browser grading_version'; exception when insufficient_privilege then null; end;
  begin update public.attempts set submission_request_id=gen_random_uuid() where id=a; raise exception 'FAIL browser request id'; exception when insufficient_privilege then null; end;
  begin update public.attempts set submitted_at=clock_timestamp() where id=a; raise exception 'FAIL browser submitted_at'; exception when insufficient_privilege then null; end;
  begin update public.attempts set deterministic_score=99 where id=a; raise exception 'FAIL browser score aggregate'; exception when insufficient_privilege then null; end;
  begin update public.attempts set deterministic_max_score=99 where id=a; raise exception 'FAIL browser max aggregate'; exception when insufficient_privilege then null; end;
  begin update public.attempts set correct_count=99 where id=a; raise exception 'FAIL browser correct count'; exception when insufficient_privilege then null; end;
  begin update public.attempts set partial_count=99 where id=a; raise exception 'FAIL browser partial count'; exception when insufficient_privilege then null; end;
  begin update public.attempts set incorrect_count=99 where id=a; raise exception 'FAIL browser incorrect count'; exception when insufficient_privilege then null; end;
  begin update public.attempts set unanswered_count=99 where id=a; raise exception 'FAIL browser unanswered count'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; other_id uuid:=current_setting('test.user_b')::uuid;
  a public.attempts; request_id uuid:=current_setting('test.v12_request_id')::uuid;
  fill_judgments jsonb; rubric_judgments jsonb; questions jsonb; result jsonb; saved public.attempts;
  bad_judgments jsonb; bad_result jsonb;
begin
  select * into a from public.attempts where id=current_setting('test.v12_attempt')::uuid;
  fill_judgments:=jsonb_build_array(jsonb_build_object('questionId','v12_fill','answerHash',current_setting('test.v12_fill_hash'),
    'source','rule','status','correct','confidence',null,'reason',null));
  rubric_judgments:=jsonb_build_array(current_setting('test.v12_calc_judgment')::jsonb,current_setting('test.v12_draw_judgment')::jsonb);
  rubric_judgments:=rubric_judgments||jsonb_build_array(current_setting('test.v12_blank_calc_judgment')::jsonb,
    current_setting('test.v12_blank_draw_judgment')::jsonb);
  questions:=jsonb_build_array(
    jsonb_build_object('questionId','v12_single','type','single','points',1,'correctOptionId','b'),
    jsonb_build_object('questionId','v12_multiple','type','multiple','points',1,'correctOptionIds',jsonb_build_array('a','b')),
    jsonb_build_object('questionId','v12_tf','type','true-false','points',1,'correctAnswer',false),
    jsonb_build_object('questionId','v12_fill','type','fill','points',1,'correctAnswer','CPU','match','exact'),
    jsonb_build_object('questionId','v12_calc','type','calculation','points',2,'referenceAnswer','x=2','solution','Solve x=2',
      'rubric',jsonb_build_array(jsonb_build_object('criterionId','r1','maxScore',1),jsonb_build_object('criterionId','r2','maxScore',1))),
    jsonb_build_object('questionId','v12_draw','type','drawing','points',2,'referenceAnswer','a diagram','solution','Draw the diagram',
      'drawing',jsonb_build_object('width',400,'height',300),
      'rubric',jsonb_build_array(jsonb_build_object('criterionId','r1','maxScore',1),jsonb_build_object('criterionId','r2','maxScore',1))),
    jsonb_build_object('questionId','v12_blank_calc','type','calculation','points',1,'referenceAnswer','x=1','solution','Solve x=1',
      'rubric',jsonb_build_array(jsonb_build_object('criterionId','r1','maxScore',1))),
    jsonb_build_object('questionId','v12_blank_draw','type','drawing','points',1,'referenceAnswer','a diagram','solution','Draw it',
      'drawing',jsonb_build_object('width',400,'height',300),
      'rubric',jsonb_build_array(jsonb_build_object('criterionId','r1','maxScore',1))));
  result:=jsonb_build_object('score',6,'maxScore',10,'correctCount',4,'partialCount',2,'incorrectCount',0,'unansweredCount',2,'manualCount',0,
    'questions',jsonb_build_array(
      jsonb_build_object('questionId','v12_single','type','single','status','correct','score',1,'maxScore',1),
      jsonb_build_object('questionId','v12_multiple','type','multiple','status','correct','score',1,'maxScore',1),
      jsonb_build_object('questionId','v12_tf','type','true-false','status','correct','score',1,'maxScore',1),
      jsonb_build_object('questionId','v12_fill','type','fill','status','correct','score',1,'maxScore',1),
      jsonb_build_object('questionId','v12_calc','type','calculation','status','partial','score',1,'maxScore',2),
      jsonb_build_object('questionId','v12_draw','type','drawing','status','partial','score',1,'maxScore',2),
      jsonb_build_object('questionId','v12_blank_calc','type','calculation','status','unanswered','score',0,'maxScore',1),
      jsonb_build_object('questionId','v12_blank_draw','type','drawing','status','unanswered','score',0,'maxScore',1)));
  begin perform public.finalize_ai_grading_submission(other_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,rubric_judgments,questions);
    raise exception 'FAIL wrong owner finalization'; exception when serialization_failure then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at-interval '1 second',request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,rubric_judgments,questions);
    raise exception 'FAIL stale CAS finalization'; exception when serialization_failure then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,'wrong-revision',result,fill_judgments,rubric_judgments,questions);
    raise exception 'FAIL wrong canonical revision'; exception when serialization_failure then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,'[]'::jsonb,rubric_judgments,questions);
    raise exception 'FAIL missing fill judgment'; exception when check_violation then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,
    jsonb_build_array(fill_judgments->0,fill_judgments->0),rubric_judgments,questions);
    raise exception 'FAIL duplicate fill judgment'; exception when check_violation then null; end;
  bad_judgments:=jsonb_build_array(jsonb_set(rubric_judgments->0,'{answerHash}',to_jsonb(repeat('f',64))),rubric_judgments->1);
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,bad_judgments,questions);
    raise exception 'FAIL wrong answer hash finalization'; exception when check_violation then null; end;
  bad_judgments:=jsonb_set(rubric_judgments,'{0,score}','2'::jsonb);
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,bad_judgments,questions);
    raise exception 'FAIL rubric score tampering'; exception when check_violation then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,
    jsonb_build_array(rubric_judgments->0,rubric_judgments->0,rubric_judgments->1),questions);
    raise exception 'FAIL duplicate rubric judgment'; exception when check_violation then null; end;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,
    jsonb_build_array(rubric_judgments->0),questions);
    raise exception 'FAIL missing rubric judgment'; exception when check_violation then null; end;
  bad_result:=jsonb_set(result,'{score}','7'::jsonb);
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,bad_result,fill_judgments,rubric_judgments,questions);
    raise exception 'FAIL aggregate score tampering'; exception when check_violation then null; end;
  perform set_config('test.v12_quota_before',current_setting('test.v12_quota_before'),true);
  select * into saved from public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,rubric_judgments,questions);
  if saved.status <> 'submitted' or saved.grading_version <> 'ai-grading-v3' or saved.partial_count <> 2
    or saved.deterministic_score <> 6 or saved.deterministic_max_score <> 10
    or (select count(*) from public.rubric_judgments where attempt_id=a.id) <> 4
    or (select count(*) from public.rubric_judgments where attempt_id=a.id and source='system' and status='unanswered') <> 2
    or (select count(*) from public.fill_judgments where attempt_id=a.id and judge_version='ai-grading-v3') <> 1 then
    raise exception 'FAIL atomic v3 finalization'; end if;
  select * into saved from public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,request_id,a.quiz_id,a.quiz_revision,result,fill_judgments,rubric_judgments,questions);
  if saved.id <> a.id then raise exception 'FAIL same request idempotency'; end if;
  begin perform public.finalize_ai_grading_submission(owner_id,a.id,a.updated_at,gen_random_uuid(),a.quiz_id,a.quiz_revision,result,fill_judgments,rubric_judgments,questions);
    raise exception 'FAIL changed request id replay'; exception when serialization_failure then null; end;
  if (public.get_ai_quota_status(owner_id)->>'remaining')::integer <> current_setting('test.v12_quota_before')::integer then
    raise exception 'FAIL system grading debited personal quota'; end if;
  if (select partial_count from public.attempts where grading_version in ('deterministic-v1','semantic-fill-v2') and partial_count <> 0 limit 1) is not null then
    raise exception 'FAIL historical partial count backfill'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare a uuid:=current_setting('test.v12_attempt')::uuid; begin
  if (select count(*) from public.rubric_judgments where attempt_id=a) <> 4 then raise exception 'FAIL own submitted rubric read'; end if;
  begin insert into public.rubric_judgments(user_id,attempt_id,quiz_id,quiz_revision,question_id,question_type,answer_hash,
    judge_version,source,status,score,max_score,criteria,confidence,summary,model,reasoning_effort)
    values(auth.uid(),a,'v12-rubric-fixture','fixture-v1','forged','calculation',repeat('a',64),'ai-grading-v3','ai','incorrect',0,1,'[]','low','forged','gpt-6-luna','medium');
    raise exception 'FAIL authenticated rubric insert'; exception when insufficient_privilege then null; end;
  begin update public.rubric_judgments set score=0 where attempt_id=a; raise exception 'FAIL authenticated rubric update'; exception when insufficient_privilege then null; end;
  begin delete from public.rubric_judgments where attempt_id=a; raise exception 'FAIL authenticated rubric delete'; exception when insufficient_privilege then null; end;
  begin update public.attempts set partial_count=0 where id=a; raise exception 'FAIL submitted attempt mutation'; exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.rubric_judgments where attempt_id=current_setting('test.v12_attempt')::uuid)
    then raise exception 'FAIL foreign rubric judgment read'; end if;
end $$;
reset role;

-- M3: server-only schema-2 persistence, CAS, legacy-writer, and least-privilege checks.
set local role postgres;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; a public.attempts; legacy public.attempts;
begin
  if exists(select 1 from public.attempts where answer_schema_version <> 1) then
    raise exception 'FAIL pre-M3 attempts were not schema 1'; end if;
  insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
    values(owner_id,'m3-v4-fixture','fixture-v1','draft',clock_timestamp(),clock_timestamp()) returning * into a;
  if a.answer_schema_version <> 1 then raise exception 'FAIL draft default schema version'; end if;
  insert into public.answers(attempt_id,user_id,question_id,answer)
    values(a.id,owner_id,'calc','{"type":"calculation","text":"old answer"}'::jsonb);
  perform set_config('test.m3_v4_attempt',a.id::text,true);
  perform set_config('test.m3_v4_updated_at',a.updated_at::text,true);
  insert into public.attempts(user_id,quiz_id,quiz_revision,status,started_at,client_updated_at)
    values(owner_id,'m3-v3-fixture','fixture-v1','draft',clock_timestamp(),clock_timestamp()) returning * into legacy;
  insert into public.answers(attempt_id,user_id,question_id,answer)
    values(legacy.id,owner_id,'calc','{"type":"calculation","text":"legacy answer"}'::jsonb);
  perform set_config('test.m3_v3_attempt',legacy.id::text,true);
  perform set_config('test.m3_v3_updated_at',legacy.updated_at::text,true);
end $$;

do $$ declare rpc regprocedure:=to_regprocedure('public.save_quiz_attempt_v4(uuid,uuid,timestamptz,timestamptz,jsonb)');
begin
  if rpc is null or not has_function_privilege('service_role',rpc,'EXECUTE')
    or has_function_privilege('anon',rpc,'EXECUTE')
    or has_function_privilege('authenticated',rpc,'EXECUTE') then
    raise exception 'FAIL v4 RPC execute grants'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin perform public.save_quiz_attempt_v4(null::uuid,null::uuid,null::timestamptz,null::timestamptz,'{}'::jsonb);
    raise exception 'FAIL anon v4 RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform public.save_quiz_attempt_v4(null::uuid,null::uuid,null::timestamptz,null::timestamptz,'{}'::jsonb);
    raise exception 'FAIL authenticated v4 RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare owner_id uuid:=current_setting('test.user_a')::uuid; other_id uuid:=current_setting('test.user_b')::uuid;
  a uuid:=current_setting('test.m3_v4_attempt')::uuid; row_before public.attempts; row_after public.attempts;
  answer_before jsonb; too_many jsonb; submitted public.attempts; saved public.attempts; client_time timestamptz:=clock_timestamp();
begin
  select * into row_before from public.attempts where id=a;
  select answer into answer_before from public.answers where attempt_id=a and question_id='calc';
  -- Invalid owner, stale CAS, submitted status, malformed object, excessive entry count,
  -- unsafe question ID, non-object answer, and non-finite timestamp must all roll back.
  begin perform public.save_quiz_attempt_v4(other_id,a,row_before.updated_at,client_time,'{}'::jsonb);
    raise exception 'FAIL cross-user v4 save'; exception when serialization_failure then null; end;
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at-interval '1 second',client_time,'{}'::jsonb);
    raise exception 'FAIL stale v4 CAS'; exception when serialization_failure then null; end;
  select * into submitted from public.attempts where id=current_setting('test.v12_attempt')::uuid;
  begin perform public.save_quiz_attempt_v4(owner_id,submitted.id,submitted.updated_at,client_time,'{}'::jsonb);
    raise exception 'FAIL submitted v4 save'; exception when serialization_failure then null; end;
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,client_time,'[]'::jsonb);
    raise exception 'FAIL non-object v4 answers'; exception when invalid_parameter_value then null; end;
  select jsonb_object_agg('q'||i,'{}'::jsonb) into too_many from generate_series(1,101) as seq(i);
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,client_time,too_many);
    raise exception 'FAIL oversized v4 answer count'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,client_time,'{"bad/question":{}}'::jsonb);
    raise exception 'FAIL unsafe v4 question ID'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,client_time,'{"calc":"not-an-object"}'::jsonb);
    raise exception 'FAIL scalar v4 answer'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,'infinity'::timestamptz,'{}'::jsonb);
    raise exception 'FAIL non-finite v4 client time'; exception when invalid_parameter_value then null; end;
  select * into row_after from public.attempts where id=a;
  if row_after.answer_schema_version <> 1 or row_after.updated_at is distinct from row_before.updated_at
    or row_after.client_updated_at is distinct from row_before.client_updated_at
    or (select answer from public.answers where attempt_id=a and question_id='calc') is distinct from answer_before then
    raise exception 'FAIL atomic v4 validation failure'; end if;

  select * into saved from public.save_quiz_attempt_v4(owner_id,a,row_before.updated_at,client_time,
    '{"calc":{"type":"calculation","mode":"text","text":"new answer","strokes":[]}}'::jsonb);
  if saved.answer_schema_version <> 2 or saved.status <> 'draft' or saved.updated_at = row_before.updated_at
    or saved.client_updated_at is distinct from client_time or saved.grading_version <> 'deterministic-v1'
    or saved.submission_request_id is not null or saved.submitted_at is not null
    or saved.deterministic_score is not null or saved.deterministic_max_score is not null then
    raise exception 'FAIL valid atomic v4 promotion'; end if;
  if (select count(*) from public.answers where attempt_id=a) <> 1
    or (select answer from public.answers where attempt_id=a and question_id='calc')
      is distinct from '{"type":"calculation","mode":"text","text":"new answer","strokes":[]}'::jsonb then
    raise exception 'FAIL v4 answer replacement'; end if;
  perform set_config('test.m3_v4_saved_updated_at',saved.updated_at::text,true);
  perform set_config('test.m3_v4_client_updated_at',client_time::text,true);
end $$;
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare owner_id uuid:=auth.uid(); v4_id uuid:=current_setting('test.m3_v4_attempt')::uuid;
  v3_id uuid:=current_setting('test.m3_v3_attempt')::uuid; a public.attempts; saved public.attempts;
  answer_before jsonb; updated_before timestamptz;
begin
  select * into a from public.attempts where id=v4_id;
  select answer into answer_before from public.answers where attempt_id=v4_id and question_id='calc';
  updated_before:=a.updated_at;
  begin update public.attempts set answer_schema_version=1 where id=v4_id;
    raise exception 'FAIL schema-2 downgrade'; exception when check_violation then null; end;
  begin update public.attempts set answer_schema_version=2 where id=v3_id;
    raise exception 'FAIL authenticated schema promotion'; exception when insufficient_privilege then null; end;
  begin perform public.save_quiz_attempt_v3(v4_id,jsonb_build_object('ownerId',owner_id,'quizId',a.quiz_id,
    'quizRevision',a.quiz_revision,'status','in-progress','startedAt',a.started_at,'updatedAt',clock_timestamp(),
    'answers','{"calc":{"type":"calculation","text":"stale legacy overwrite"}}'::jsonb),a.updated_at);
    raise exception 'FAIL v3 overwrote schema 2'; exception when serialization_failure then null; end;
  begin insert into public.answers(attempt_id,user_id,question_id,answer)
    values(v4_id,owner_id,'direct-insert','{"type":"calculation","mode":"text","text":"forged","strokes":[]}'::jsonb);
    raise exception 'FAIL schema-2 direct answer insert'; exception when insufficient_privilege then null; end;
  begin update public.answers set answer='{"type":"calculation","mode":"text","text":"forged","strokes":[]}'::jsonb
    where attempt_id=v4_id and question_id='calc';
    raise exception 'FAIL schema-2 direct answer update'; exception when insufficient_privilege then null; end;
  begin delete from public.answers where attempt_id=v4_id;
    raise exception 'FAIL schema-2 direct answer delete'; exception when insufficient_privilege then null; end;
  select * into a from public.attempts where id=v4_id;
  if a.answer_schema_version <> 2 or a.updated_at is distinct from updated_before
    or (select count(*) from public.answers where attempt_id=v4_id) <> 1
    or (select answer from public.answers where attempt_id=v4_id and question_id='calc') is distinct from answer_before then
    raise exception 'FAIL old writer/direct mutation changed schema 2'; end if;

  select * into a from public.attempts where id=v3_id;
  select answer into answer_before from public.answers where attempt_id=v3_id and question_id='calc';
  updated_before:=a.updated_at;
  begin perform public.save_quiz_attempt_v3(v3_id,jsonb_build_object('ownerId',owner_id,'quizId',a.quiz_id,
    'quizRevision',a.quiz_revision,'status','in-progress','startedAt',a.started_at,'updatedAt',clock_timestamp(),
    'answers','{"calc":{"type":"calculation","mode":"text","text":"forged","strokes":[]}}'::jsonb),a.updated_at);
    raise exception 'FAIL v3 accepted future calculation shape'; exception when insufficient_privilege then null; end;
  begin insert into public.answers(attempt_id,user_id,question_id,answer)
    values(v3_id,owner_id,'calc-direct','{"type":"calculation","mode":"text","text":"forged","strokes":[]}'::jsonb);
    raise exception 'FAIL schema-1 direct future calculation insert'; exception when insufficient_privilege then null; end;
  begin update public.answers set answer='{"type":"calculation","text":"forged","mode":"text","strokes":[]}'::jsonb
    where attempt_id=v3_id and question_id='calc';
    raise exception 'FAIL schema-1 direct future calculation update'; exception when insufficient_privilege then null; end;
  if (select updated_at from public.attempts where id=v3_id) is distinct from updated_before
    or (select answer from public.answers where attempt_id=v3_id and question_id='calc') is distinct from answer_before then
    raise exception 'FAIL rejected v3 future shape changed schema 1'; end if;
  select * into saved from public.save_quiz_attempt_v3(v3_id,jsonb_build_object('ownerId',owner_id,'quizId',a.quiz_id,
    'quizRevision',a.quiz_revision,'status','in-progress','startedAt',a.started_at,'updatedAt',clock_timestamp(),
    'answers','{"calc":{"type":"calculation","text":"legacy refresh"}}'::jsonb),a.updated_at);
  if saved.answer_schema_version <> 1
    or (select answer from public.answers where attempt_id=v3_id and question_id='calc')
      is distinct from '{"type":"calculation","text":"legacy refresh"}'::jsonb then
    raise exception 'FAIL schema-1 v3 compatibility'; end if;
end $$;
reset role;
rollback;
select 'PASS: practice, v1/v2/v3 grading, atomic rubric finalization, AI usage isolation, recovery, rate limits, session binding and RLS automation' as verification;
