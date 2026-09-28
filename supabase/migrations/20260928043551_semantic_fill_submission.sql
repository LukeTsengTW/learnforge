-- v1.1 formal fill grading. Historical submissions keep deterministic-v1.
alter table public.attempts
  add column grading_version text not null default 'deterministic-v1'
    check (grading_version in ('deterministic-v1', 'semantic-fill-v2')),
  add column submission_request_id uuid;
alter table public.attempts add constraint semantic_submission_has_request
  check (grading_version <> 'semantic-fill-v2'
    or (status = 'submitted' and submission_request_id is not null));
create unique index attempts_submission_request_idx
  on public.attempts(user_id, submission_request_id) where submission_request_id is not null;

create table public.fill_judgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  quiz_id text not null,
  quiz_revision text not null,
  question_id text not null check (char_length(question_id) between 1 and 100),
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  judge_version text not null check (judge_version = 'semantic-fill-v2'),
  source text not null check (source in ('rule', 'ai')),
  status text not null check (status in ('correct', 'incorrect', 'unanswered')),
  model text,
  reasoning_effort text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  reason text check (reason is null or char_length(reason) <= 240),
  created_at timestamptz not null default clock_timestamp(),
  finalized_at timestamptz not null default clock_timestamp(),
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade,
  unique (attempt_id, question_id),
  check ((source = 'rule' and status in ('correct', 'unanswered') and model is null
      and reasoning_effort is null and confidence is null and reason is null)
    or (source = 'ai' and status in ('correct', 'incorrect')
      and model = 'gpt-6-luna' and reasoning_effort = 'medium'
      and confidence is not null and reason is not null and char_length(btrim(reason)) > 0))
);
create index fill_judgments_user_attempt_idx on public.fill_judgments(user_id, attempt_id);
alter table public.fill_judgments enable row level security;
revoke all on public.fill_judgments from public, anon, authenticated;
grant select on public.fill_judgments to authenticated;
grant select, insert, update, delete on public.fill_judgments to service_role;
create policy fill_judgments_read_own on public.fill_judgments for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.attempts a where a.id = attempt_id
      and a.user_id = (select auth.uid()) and a.status = 'submitted'));

-- Cache successful provider work before finalization; the unique key binds every
-- reuse to an owner, attempt, exact revision, question, answer hash and policy.
create table private.fill_judge_cache (
  user_id uuid not null,
  attempt_id uuid not null,
  quiz_id text not null,
  quiz_revision text not null,
  question_id text not null,
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  judge_version text not null check (judge_version = 'semantic-fill-v2'),
  state text not null check (state in ('reserved', 'completed', 'failed')),
  claim_token uuid not null,
  request_id uuid not null,
  reserved_until timestamptz,
  verdict text check (verdict in ('correct', 'incorrect')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  reason text check (reason is null or char_length(reason) <= 240),
  model text not null check (model = 'gpt-6-luna'),
  reasoning_effort text not null check (reasoning_effort = 'medium'),
  provider_response_id text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, attempt_id, question_id, quiz_revision, answer_hash, judge_version),
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade,
  check ((state = 'completed' and verdict is not null and confidence is not null
      and reason is not null and char_length(btrim(reason)) > 0)
    or (state <> 'completed' and verdict is null and confidence is null and reason is null))
);
create index fill_judge_cache_attempt_idx on private.fill_judge_cache(user_id, attempt_id, created_at);
alter table private.fill_judge_cache enable row level security;
revoke all on private.fill_judge_cache from public, anon, authenticated;
grant select, insert, update, delete on private.fill_judge_cache to service_role;

-- Separate system usage log: no entries in ai_requests and no credit charge.
create table private.fill_judge_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  attempt_id uuid not null,
  question_id text not null,
  quiz_revision text not null,
  answer_hash text not null,
  judge_version text not null,
  claim_token uuid not null unique,
  request_id uuid not null,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  error_code text,
  provider_response_id text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade
);
create index fill_judge_calls_user_time_idx on private.fill_judge_calls(user_id, created_at desc);
create index fill_judge_calls_attempt_time_idx on private.fill_judge_calls(attempt_id, created_at desc);
alter table private.fill_judge_calls enable row level security;
revoke all on private.fill_judge_calls from public, anon, authenticated;
grant select, insert, update, delete on private.fill_judge_calls to service_role;

-- Every answer write advances the attempt CAS, including direct Data API writes.
create or replace function private.lock_answer() returns trigger language plpgsql set search_path = '' as $$
declare parent_status text; target_id uuid;
begin
  if tg_op = 'UPDATE' and (new.attempt_id <> old.attempt_id or new.user_id <> old.user_id or new.question_id <> old.question_id) then
    raise exception 'Answer identity is immutable' using errcode = '23514';
  end if;
  target_id := case when tg_op = 'DELETE' then old.attempt_id else new.attempt_id end;
  select status into parent_status from public.attempts where id = target_id for update;
  if parent_status = 'submitted' then raise exception 'Submitted answers are immutable' using errcode = '23514'; end if;
  if parent_status = 'draft' then
    update public.attempts set updated_at = clock_timestamp() where id = target_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- No authenticated caller, including the old RPC, may finalize an attempt.
create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'submitted' then raise exception 'Submitted attempt is immutable' using errcode = '23514'; end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.quiz_id <> old.quiz_id
    or new.quiz_revision <> old.quiz_revision or new.started_at <> old.started_at then
    raise exception 'Attempt identity is immutable' using errcode = '23514';
  end if;
  if current_user <> 'service_role' and (new.status <> 'draft'
    or new.grading_version <> old.grading_version
    or new.submission_request_id is distinct from old.submission_request_id
    or new.submitted_at is distinct from old.submitted_at
    or new.deterministic_score is distinct from old.deterministic_score
    or new.deterministic_max_score is distinct from old.deterministic_max_score
    or new.correct_count is distinct from old.correct_count
    or new.incorrect_count is distinct from old.incorrect_count
    or new.unanswered_count is distinct from old.unanswered_count) then
    raise exception 'Server submission required' using errcode = '42501';
  end if;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end $$;

create or replace function public.save_quiz_attempt_v3(p_attempt_id uuid, p_payload jsonb, p_expected_updated_at timestamptz)
returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; item record;
begin
  if auth.uid() is null or p_payload->>'ownerId' is distinct from auth.uid()::text then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_payload->>'status' is distinct from 'in-progress'
    or jsonb_typeof(p_payload->'answers') is distinct from 'object' then
    raise exception 'Only draft saving is allowed' using errcode = '42501';
  end if;
  select * into current_row from public.attempts where id = p_attempt_id and user_id = auth.uid() for update;
  if not found or current_row.status <> 'draft' or current_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Attempt version conflict' using errcode = '40001';
  end if;
  if p_payload->>'quizId' is distinct from current_row.quiz_id
    or p_payload->>'quizRevision' is distinct from current_row.quiz_revision
    or (p_payload->>'startedAt')::timestamptz is distinct from current_row.started_at then
    raise exception 'Attempt identity conflict' using errcode = '40001';
  end if;
  delete from public.answers where attempt_id = current_row.id;
  for item in select key, value from jsonb_each(p_payload->'answers') loop
    insert into public.answers(attempt_id, user_id, question_id, answer)
      values(current_row.id, auth.uid(), item.key, item.value);
  end loop;
  return query update public.attempts set client_updated_at = (p_payload->>'updatedAt')::timestamptz
    where id = current_row.id returning *;
end $$;
revoke execute on function public.save_quiz_attempt(text, jsonb, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) to authenticated;

create function public.claim_fill_judgment(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz,
  p_question_id text, p_answer_hash text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.attempts; c private.fill_judge_cache; stored_answer jsonb; token uuid;
begin
  if current_user <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  if p_question_id is null or char_length(p_question_id) not between 1 and 100
    or p_answer_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid identity' using errcode = '22023'; end if;
  select * into a from public.attempts where id = p_attempt_id and user_id = p_user_id for update;
  if not found or a.status <> 'draft' or a.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('state','conflict');
  end if;
  select answer into stored_answer from public.answers where attempt_id = a.id and question_id = p_question_id;
  if stored_answer->>'type' is distinct from 'fill'
    or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(stored_answer->>'text','UTF8')),'hex') is distinct from p_answer_hash then
    return jsonb_build_object('state','conflict');
  end if;
  select * into c from private.fill_judge_cache
    where user_id=p_user_id and attempt_id=a.id and question_id=p_question_id
      and quiz_revision=a.quiz_revision and answer_hash=p_answer_hash and judge_version='semantic-fill-v2'
    for update;
  if found and c.state='completed' then
    return jsonb_build_object('state','cached','verdict',c.verdict,'confidence',c.confidence,'reason',c.reason);
  end if;
  if found and c.state='reserved' and c.reserved_until > clock_timestamp() then
    return jsonb_build_object('state','in_progress');
  end if;
  -- System-level abuse bounds; independent from the user's AI credit ledger.
  if (select count(*) from private.fill_judge_calls where user_id=p_user_id
      and created_at > clock_timestamp()-interval '1 hour') >= 40
    or (select count(*) from private.fill_judge_calls where attempt_id=a.id
      and created_at > clock_timestamp()-interval '1 hour') >= 20 then
    return jsonb_build_object('state','limited');
  end if;
  token := gen_random_uuid();
  insert into private.fill_judge_cache as cache(user_id,attempt_id,quiz_id,quiz_revision,question_id,
    answer_hash,judge_version,state,claim_token,request_id,reserved_until,model,reasoning_effort)
    values(p_user_id,a.id,a.quiz_id,a.quiz_revision,p_question_id,p_answer_hash,'semantic-fill-v2',
      'reserved',token,p_request_id,clock_timestamp()+interval '2 minutes','gpt-6-luna','medium')
    on conflict(user_id,attempt_id,question_id,quiz_revision,answer_hash,judge_version)
    do update set state='reserved',claim_token=token,request_id=p_request_id,
      reserved_until=clock_timestamp()+interval '2 minutes',verdict=null,confidence=null,reason=null,
      provider_response_id=null,updated_at=clock_timestamp();
  insert into private.fill_judge_calls(user_id,attempt_id,question_id,quiz_revision,answer_hash,
    judge_version,claim_token,request_id,status)
    values(p_user_id,a.id,p_question_id,a.quiz_revision,p_answer_hash,'semantic-fill-v2',token,p_request_id,'reserved');
  return jsonb_build_object('state','claimed','claimToken',token);
end $$;
revoke all on function public.claim_fill_judgment(uuid,uuid,timestamptz,text,text,uuid) from public, anon, authenticated;
grant execute on function public.claim_fill_judgment(uuid,uuid,timestamptz,text,text,uuid) to service_role;

create function public.complete_fill_judgment(
  p_claim_token uuid, p_verdict text, p_confidence text, p_reason text,
  p_provider_response_id text, p_input_tokens integer, p_cached_input_tokens integer,
  p_output_tokens integer, p_reasoning_tokens integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if current_user <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  if p_verdict not in ('correct','incorrect') or p_confidence not in ('high','medium','low')
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 240
    or least(p_input_tokens,p_cached_input_tokens,p_output_tokens,p_reasoning_tokens) < 0
    or p_provider_response_id is null or char_length(p_provider_response_id) > 200 then
    raise exception 'Invalid judgment' using errcode = '22023';
  end if;
  update private.fill_judge_cache set state='completed',verdict=p_verdict,confidence=p_confidence,
    reason=p_reason,provider_response_id=p_provider_response_id,reserved_until=null,updated_at=clock_timestamp()
    where claim_token=p_claim_token and state='reserved';
  get diagnostics changed = row_count;
  if changed <> 1 then return false; end if;
  update private.fill_judge_calls set status='completed',provider_response_id=p_provider_response_id,
    input_tokens=p_input_tokens,cached_input_tokens=p_cached_input_tokens,output_tokens=p_output_tokens,
    reasoning_tokens=p_reasoning_tokens,completed_at=clock_timestamp()
    where claim_token=p_claim_token and status='reserved';
  if not found then raise exception 'Usage record missing' using errcode = '23514'; end if;
  return true;
end $$;
revoke all on function public.complete_fill_judgment(uuid,text,text,text,text,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.complete_fill_judgment(uuid,text,text,text,text,integer,integer,integer,integer) to service_role;

create function public.fail_fill_judgment(p_claim_token uuid, p_error_code text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if current_user <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  update private.fill_judge_cache set state='failed',verdict=null,confidence=null,reason=null,
    reserved_until=null,updated_at=clock_timestamp()
    where claim_token=p_claim_token and state='reserved';
  get diagnostics changed = row_count;
  if changed <> 1 then return false; end if;
  update private.fill_judge_calls set status='failed',error_code=left(coalesce(p_error_code,'unknown'),80),
    completed_at=clock_timestamp() where claim_token=p_claim_token and status='reserved';
  return true;
end $$;
revoke all on function public.fail_fill_judgment(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_fill_judgment(uuid,text) to service_role;

create function public.finalize_semantic_fill_submission(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz,
  p_request_id uuid, p_result jsonb, p_judgments jsonb
) returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare a public.attempts; item jsonb; qid text; answer_row jsonb; observed_hash text;
  seen text[] := array[]::text[]; source_value text; status_value text; cache_row private.fill_judge_cache;
begin
  if current_user <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  select * into a from public.attempts where id=p_attempt_id and user_id=p_user_id for update;
  if not found then raise exception 'Attempt unavailable' using errcode = '40001'; end if;
  if a.status='submitted' then
    if a.grading_version='semantic-fill-v2' and a.submission_request_id=p_request_id then
      return next a; return;
    end if;
    raise exception 'Attempt already submitted' using errcode = '40001';
  end if;
  if a.updated_at is distinct from p_expected_updated_at or p_request_id is null
    or jsonb_typeof(p_judgments) is distinct from 'array' or jsonb_array_length(p_judgments)>200
    or jsonb_typeof(p_result) is distinct from 'object' then
    raise exception 'Attempt version conflict' using errcode = '40001';
  end if;
  for item in select value from jsonb_array_elements(p_judgments) loop
    qid := item->>'questionId'; source_value := item->>'source'; status_value := item->>'status';
    if qid is null or qid=any(seen) or char_length(qid) not between 1 and 100 then
      raise exception 'Invalid fill judgment set' using errcode = '22023';
    end if;
    seen := array_append(seen,qid);
    select answer into answer_row from public.answers where attempt_id=a.id and question_id=qid;
    if answer_row is not null and answer_row->>'type' is distinct from 'fill' then
      raise exception 'Answer type conflict' using errcode = '40001';
    end if;
    observed_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(answer_row->>'text',''),'UTF8')),'hex');
    if item->>'answerHash' is distinct from observed_hash then
      raise exception 'Answer changed during judging' using errcode = '40001';
    end if;
    if source_value='ai' then
      select * into cache_row from private.fill_judge_cache
        where user_id=p_user_id and attempt_id=a.id and question_id=qid
          and quiz_revision=a.quiz_revision and answer_hash=observed_hash
          and judge_version='semantic-fill-v2' and state='completed';
      if not found or status_value is distinct from cache_row.verdict
        or item->>'confidence' is distinct from cache_row.confidence
        or item->>'reason' is distinct from cache_row.reason then
        raise exception 'AI judgment unavailable' using errcode = '23514';
      end if;
    elsif source_value<>'rule' or status_value not in ('correct','unanswered') then
      raise exception 'Invalid rule judgment' using errcode = '22023';
    end if;
    insert into public.fill_judgments(user_id,attempt_id,quiz_id,quiz_revision,question_id,
      answer_hash,judge_version,source,status,model,reasoning_effort,confidence,reason)
      values(p_user_id,a.id,a.quiz_id,a.quiz_revision,qid,observed_hash,'semantic-fill-v2',
        source_value,status_value,
        case when source_value='ai' then 'gpt-6-luna' end,
        case when source_value='ai' then 'medium' end,
        case when source_value='ai' then cache_row.confidence end,
        case when source_value='ai' then cache_row.reason end);
  end loop;
  if exists (
    select 1 from public.answers ans
      where ans.attempt_id = a.id and ans.answer->>'type' = 'fill'
        and not (ans.question_id = any(seen))
  ) then
    raise exception 'Incomplete fill judgment set' using errcode = '23514';
  end if;
  return query update public.attempts set status='submitted',grading_version='semantic-fill-v2',
    submission_request_id=p_request_id,submitted_at=clock_timestamp(),
    deterministic_score=(p_result->>'score')::numeric,
    deterministic_max_score=(p_result->>'maxScore')::numeric,
    correct_count=(p_result->>'correctCount')::integer,
    incorrect_count=(p_result->>'incorrectCount')::integer,
    unanswered_count=(p_result->>'unansweredCount')::integer
    where id=a.id returning *;
end $$;
revoke all on function public.finalize_semantic_fill_submission(uuid,uuid,timestamptz,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_semantic_fill_submission(uuid,uuid,timestamptz,uuid,jsonb,jsonb) to service_role;
