-- v1.2 trusted six-type grading. Existing v1/v2 submission rows keep their stored results.
alter table public.attempts drop constraint attempts_grading_version_check;
alter table public.attempts add constraint attempts_grading_version_check
  check (grading_version in ('deterministic-v1', 'semantic-fill-v2', 'ai-grading-v3'));

alter table public.attempts add column partial_count integer not null default 0
  check (partial_count >= 0);
alter table public.attempts drop constraint semantic_submission_has_request;
alter table public.attempts add constraint versioned_submission_has_request
  check (grading_version not in ('semantic-fill-v2', 'ai-grading-v3')
    or (status = 'submitted' and submission_request_id is not null));

-- A browser can save draft content but cannot forge any submission metadata or aggregates.
create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_user <> 'service_role' and (new.status <> 'draft'
      or new.grading_version <> 'deterministic-v1' or new.submission_request_id is not null
      or new.submitted_at is not null or new.deterministic_score is not null
      or new.deterministic_max_score is not null or new.correct_count is not null
      or new.partial_count <> 0 or new.incorrect_count is not null or new.unanswered_count is not null) then
      raise exception 'Server submission required' using errcode = '42501';
    end if;
    return new;
  end if;
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
    or new.partial_count is distinct from old.partial_count
    or new.incorrect_count is distinct from old.incorrect_count
    or new.unanswered_count is distinct from old.unanswered_count) then
    raise exception 'Server submission required' using errcode = '42501';
  end if;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end $$;
drop trigger lock_submission on public.attempts;
create trigger lock_submission before insert or update on public.attempts
  for each row execute function private.lock_submission();

alter table public.fill_judgments drop constraint fill_judgments_judge_version_check;
alter table public.fill_judgments add constraint fill_judgments_judge_version_check
  check (judge_version in ('semantic-fill-v2', 'ai-grading-v3'));

create table public.rubric_judgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  quiz_id text not null,
  quiz_revision text not null,
  question_id text not null check (char_length(question_id) between 1 and 100),
  question_type text not null check (question_type in ('calculation', 'drawing')),
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  judge_version text not null check (judge_version = 'ai-grading-v3'),
  source text not null check (source in ('system', 'ai')),
  status text not null check (status in ('unanswered', 'correct', 'partial', 'incorrect')),
  score numeric not null,
  max_score numeric not null check (max_score > 0),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array'),
  confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  summary text check (summary is null or char_length(btrim(summary)) between 1 and 2000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  model text check (model is null or model = 'gpt-6-luna'),
  reasoning_effort text check (reasoning_effort is null or reasoning_effort = 'medium'),
  provider_response_id text,
  created_at timestamptz not null default clock_timestamp(),
  finalized_at timestamptz not null default clock_timestamp(),
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade,
  unique (attempt_id, question_id),
  check (score >= 0 and score <= max_score
    and score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and max_score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  check ((source = 'system' and status = 'unanswered' and score = 0 and jsonb_array_length(criteria) = 0
      and confidence is null and summary is null and model is null and reasoning_effort is null
      and provider_response_id is null and details = '{}'::jsonb)
    or (source = 'ai' and status in ('correct', 'partial', 'incorrect') and jsonb_array_length(criteria) > 0
      and confidence in ('high', 'medium', 'low') and summary is not null and model = 'gpt-6-luna'
      and reasoning_effort = 'medium')),
  check ((status = 'correct' and score = max_score)
    or (status = 'partial' and score > 0 and score < max_score)
    or (status = 'incorrect' and score = 0)
    or (status = 'unanswered' and score = 0))
);
create index rubric_judgments_user_attempt_idx on public.rubric_judgments(user_id, attempt_id);
alter table public.rubric_judgments enable row level security;
revoke all on public.rubric_judgments from public, anon, authenticated, service_role;
grant select on public.rubric_judgments to authenticated;
grant select, insert on public.rubric_judgments to service_role;
create policy rubric_judgments_read_own on public.rubric_judgments for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.attempts a where a.id = attempt_id and a.user_id = (select auth.uid())
      and a.status = 'submitted'));

create table private.rubric_judge_cache (
  user_id uuid not null,
  attempt_id uuid not null,
  quiz_id text not null,
  quiz_revision text not null,
  question_id text not null,
  question_type text not null check (question_type in ('calculation', 'drawing')),
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  judge_version text not null check (judge_version = 'ai-grading-v3'),
  max_score numeric not null check (max_score > 0),
  state text not null check (state in ('reserved', 'completed', 'failed')),
  claim_token uuid not null,
  request_id uuid not null,
  reserved_until timestamptz,
  response jsonb,
  model text not null check (model = 'gpt-6-luna'),
  reasoning_effort text not null check (reasoning_effort = 'medium'),
  provider_response_id text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, attempt_id, quiz_id, quiz_revision, question_id, question_type, answer_hash, judge_version),
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade,
  check ((state = 'completed' and response is not null and reserved_until is null)
    or (state = 'reserved' and response is null and reserved_until is not null)
    or (state = 'failed' and response is null))
);
create index rubric_judge_cache_attempt_idx on private.rubric_judge_cache(user_id, attempt_id, created_at);
alter table private.rubric_judge_cache enable row level security;
revoke all on private.rubric_judge_cache from public, anon, authenticated;
revoke all on private.rubric_judge_cache from service_role;
grant select, insert, update on private.rubric_judge_cache to service_role;

create table private.rubric_judge_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  attempt_id uuid not null,
  quiz_id text not null,
  quiz_revision text not null,
  question_id text not null,
  question_type text not null check (question_type in ('calculation', 'drawing')),
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  judge_version text not null check (judge_version = 'ai-grading-v3'),
  claim_token uuid not null unique,
  request_id uuid not null,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  provider_response_id text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  error_code text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade
);
create index rubric_judge_calls_user_time_idx on private.rubric_judge_calls(user_id, created_at desc);
create index rubric_judge_calls_attempt_time_idx on private.rubric_judge_calls(attempt_id, created_at desc);
alter table private.rubric_judge_calls enable row level security;
revoke all on private.rubric_judge_calls from public, anon, authenticated;
revoke all on private.rubric_judge_calls from service_role;
grant select, insert, update on private.rubric_judge_calls to service_role;

create function private.rubric_answer_hash(p_answer jsonb) returns text language sql immutable strict set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answer::text, 'UTF8')), 'hex')
$$;
revoke all on function private.rubric_answer_hash(jsonb) from public, anon, authenticated;
grant execute on function private.rubric_answer_hash(jsonb) to service_role;

create function public.claim_rubric_judgment(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz, p_request_id uuid,
  p_quiz_id text, p_quiz_revision text, p_question_id text, p_question_type text, p_max_score numeric,
  p_system_unanswered boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.attempts;
  v_answer jsonb;
  v_answer_hash text;
  v_cache private.rubric_judge_cache;
  v_claim_token uuid;
  v_now timestamptz := clock_timestamp();
  v_attempt_calls integer;
  v_user_calls integer;
  v_has_cache boolean;
begin
  if p_user_id is null or p_attempt_id is null or p_request_id is null or p_system_unanswered is null
    or p_expected_updated_at is null or p_question_type is null or p_question_type not in ('calculation', 'drawing')
    or p_question_id is null or char_length(p_question_id) not between 1 and 100
    or p_quiz_id is null or p_quiz_revision is null or p_max_score is null
    or p_max_score <= 0 or p_max_score in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    return jsonb_build_object('state', 'conflict');
  end if;
  select * into v_attempt from public.attempts
    where id = p_attempt_id and user_id = p_user_id for update;
  if not found or v_attempt.status <> 'draft' or v_attempt.updated_at is distinct from p_expected_updated_at
    or v_attempt.quiz_id <> p_quiz_id or v_attempt.quiz_revision <> p_quiz_revision then
    return jsonb_build_object('state', 'conflict');
  end if;
  select answer into v_answer from public.answers
    where attempt_id = p_attempt_id and user_id = p_user_id and question_id = p_question_id;
  if found and v_answer->>'type' is distinct from p_question_type then
    return jsonb_build_object('state', 'conflict');
  end if;
  v_answer_hash := private.rubric_answer_hash(coalesce(v_answer, 'null'::jsonb));
  if p_system_unanswered then
    if p_question_type = 'calculation' and found
      and pg_catalog.btrim(coalesce(v_answer->>'text', '')) <> '' then
      return jsonb_build_object('state', 'conflict');
    end if;
    -- Drawing blankness is attested by the server rasterizer; SQL only binds this
    -- evidence to the exact persisted answer and never infers blankness from strokes.
    return jsonb_build_object('state', 'unanswered', 'answerHash', v_answer_hash);
  end if;
  if (not found and p_question_type <> 'drawing')
    or (p_question_type = 'calculation' and pg_catalog.btrim(coalesce(v_answer->>'text', '')) = '') then
    return jsonb_build_object('state', 'conflict');
  end if;

  select * into v_cache from private.rubric_judge_cache
    where user_id = p_user_id and attempt_id = p_attempt_id and quiz_id = p_quiz_id
      and quiz_revision = p_quiz_revision and question_id = p_question_id
      and question_type = p_question_type and answer_hash = v_answer_hash
      and judge_version = 'ai-grading-v3' for update;
  v_has_cache := found;
  if v_has_cache and v_cache.max_score is distinct from p_max_score then
    return jsonb_build_object('state', 'conflict');
  end if;
  if found and v_cache.state = 'completed' then
    return jsonb_build_object('state', 'cached', 'answerHash', v_answer_hash, 'response', v_cache.response,
      'providerResponseId', v_cache.provider_response_id);
  end if;
  if found and v_cache.state = 'reserved' and v_cache.reserved_until > v_now then
    return jsonb_build_object('state', 'in_progress', 'answerHash', v_answer_hash);
  end if;

  -- Serialize per-user metering across distinct attempts so concurrent claims cannot exceed the cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select count(*) into v_attempt_calls from private.rubric_judge_calls
    where user_id = p_user_id and attempt_id = p_attempt_id and created_at > v_now - interval '24 hours';
  select count(*) into v_user_calls from private.rubric_judge_calls
    where user_id = p_user_id and created_at > v_now - interval '24 hours';
  if v_attempt_calls >= 20 or v_user_calls >= 100 then
    return jsonb_build_object('state', 'limited');
  end if;

  if v_has_cache then
    if v_cache.state = 'reserved' then
      update private.rubric_judge_calls set status = 'failed', error_code = 'reservation_expired', completed_at = v_now
        where claim_token = v_cache.claim_token and status = 'reserved';
    end if;
    v_claim_token := gen_random_uuid();
    update private.rubric_judge_cache set state = 'reserved', claim_token = v_claim_token, request_id = p_request_id,
      reserved_until = v_now + interval '90 seconds', response = null, provider_response_id = null,
      max_score = p_max_score, model = 'gpt-6-luna', reasoning_effort = 'medium', updated_at = v_now
      where user_id = p_user_id and attempt_id = p_attempt_id and quiz_id = p_quiz_id
        and quiz_revision = p_quiz_revision and question_id = p_question_id
        and question_type = p_question_type and answer_hash = v_answer_hash and judge_version = 'ai-grading-v3';
  else
    v_claim_token := gen_random_uuid();
    insert into private.rubric_judge_cache(user_id, attempt_id, quiz_id, quiz_revision, question_id,
      question_type, answer_hash, judge_version, max_score, state, claim_token, request_id,
      reserved_until, model, reasoning_effort)
      values(p_user_id, p_attempt_id, p_quiz_id, p_quiz_revision, p_question_id,
        p_question_type, v_answer_hash, 'ai-grading-v3', p_max_score, 'reserved', v_claim_token,
        p_request_id, v_now + interval '90 seconds', 'gpt-6-luna', 'medium');
  end if;
  insert into private.rubric_judge_calls(user_id, attempt_id, quiz_id, quiz_revision, question_id,
    question_type, answer_hash, judge_version, claim_token, request_id, status)
    values(p_user_id, p_attempt_id, p_quiz_id, p_quiz_revision, p_question_id,
      p_question_type, v_answer_hash, 'ai-grading-v3', v_claim_token, p_request_id, 'reserved');
  return jsonb_build_object('state', 'claimed', 'claimToken', v_claim_token, 'answerHash', v_answer_hash);
end $$;
revoke all on function public.claim_rubric_judgment(uuid,uuid,timestamptz,uuid,text,text,text,text,numeric,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_rubric_judgment(uuid,uuid,timestamptz,uuid,text,text,text,text,numeric,boolean)
  to service_role;

create function public.complete_rubric_judgment(
  p_claim_token uuid, p_response jsonb, p_provider_response_id text,
  p_input_tokens integer, p_cached_input_tokens integer, p_output_tokens integer, p_reasoning_tokens integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_cache private.rubric_judge_cache;
  v_criterion jsonb;
  v_ids text[] := array[]::text[];
  v_score numeric;
  v_max_score numeric;
  v_sum numeric := 0;
begin
  if p_claim_token is null or pg_catalog.jsonb_typeof(p_response) is distinct from 'object'
    or p_input_tokens is null or p_input_tokens < 0 or p_cached_input_tokens is null or p_cached_input_tokens < 0
    or p_output_tokens is null or p_output_tokens < 0 or p_reasoning_tokens is null or p_reasoning_tokens < 0 then
    return false;
  end if;
  select * into v_cache from private.rubric_judge_cache where claim_token = p_claim_token for update;
  if not found or v_cache.state <> 'reserved' or v_cache.reserved_until <= clock_timestamp() then return false; end if;
  if p_response->>'questionId' is distinct from v_cache.question_id
    or p_response->>'questionType' is distinct from v_cache.question_type
    or p_response->>'answerHash' is distinct from v_cache.answer_hash
    or pg_catalog.jsonb_typeof(p_response->'score') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_response->'maxScore') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_response->'criteria') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_response->'criteria') = 0
    or p_response->>'confidence' is null or p_response->>'confidence' not in ('high', 'medium', 'low')
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_response->>'summary', ''))) not between 1 and 2000 then
    return false;
  end if;
  v_score := (p_response->>'score')::numeric;
  v_max_score := (p_response->>'maxScore')::numeric;
  if v_score in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    or v_max_score in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    or v_max_score <> v_cache.max_score or v_score < 0 or v_score > v_max_score then return false; end if;
  for v_criterion in select value from pg_catalog.jsonb_array_elements(p_response->'criteria') loop
    if pg_catalog.jsonb_typeof(v_criterion) is distinct from 'object'
      or coalesce(v_criterion->>'criterionId', '') = ''
      or v_criterion->>'criterionId' = any(v_ids)
      or pg_catalog.jsonb_typeof(v_criterion->'maxScore') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_criterion->'awardedScore') is distinct from 'number'
      or v_criterion->>'status' is null or v_criterion->>'status' not in ('full', 'partial', 'none') then return false; end if;
    v_ids := array_append(v_ids, v_criterion->>'criterionId');
    if (v_criterion->>'maxScore')::numeric <= 0
      or (v_criterion->>'awardedScore')::numeric < 0
      or (v_criterion->>'awardedScore')::numeric > (v_criterion->>'maxScore')::numeric
      or (v_criterion->>'status' = 'full' and (v_criterion->>'awardedScore')::numeric <> (v_criterion->>'maxScore')::numeric)
      or (v_criterion->>'status' = 'partial' and not ((v_criterion->>'awardedScore')::numeric > 0
        and (v_criterion->>'awardedScore')::numeric < (v_criterion->>'maxScore')::numeric))
      or (v_criterion->>'status' = 'none' and (v_criterion->>'awardedScore')::numeric <> 0) then return false; end if;
    v_sum := v_sum + (v_criterion->>'awardedScore')::numeric;
  end loop;
  if v_sum <> v_score then return false; end if;
  update private.rubric_judge_cache set state = 'completed', reserved_until = null,
    response = p_response, provider_response_id = p_provider_response_id, updated_at = clock_timestamp()
    where claim_token = p_claim_token;
  update private.rubric_judge_calls set status = 'completed', provider_response_id = p_provider_response_id,
    input_tokens = p_input_tokens, cached_input_tokens = p_cached_input_tokens, output_tokens = p_output_tokens,
    reasoning_tokens = p_reasoning_tokens, completed_at = clock_timestamp()
    where claim_token = p_claim_token and status = 'reserved';
  return found;
end $$;
revoke all on function public.complete_rubric_judgment(uuid,jsonb,text,integer,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.complete_rubric_judgment(uuid,jsonb,text,integer,integer,integer,integer)
  to service_role;

create function public.fail_rubric_judgment(p_claim_token uuid, p_error_code text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update private.rubric_judge_cache set state = 'failed', reserved_until = null, response = null,
    updated_at = clock_timestamp() where claim_token = p_claim_token and state = 'reserved';
  update private.rubric_judge_calls set status = 'failed',
    error_code = left(coalesce(nullif(p_error_code, ''), 'grading_unavailable'), 100),
    completed_at = clock_timestamp() where claim_token = p_claim_token and status = 'reserved';
end $$;
revoke all on function public.fail_rubric_judgment(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_rubric_judgment(uuid,text) to service_role;
create function public.finalize_ai_grading_submission(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz, p_request_id uuid,
  p_quiz_id text, p_quiz_revision text, p_result jsonb, p_fill_judgments jsonb, p_rubric_judgments jsonb, p_questions jsonb
) returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.attempts;
  v_question jsonb;
  v_grade jsonb;
  v_answer jsonb;
  v_fill jsonb;
  v_rubric_judgment jsonb;
  v_rubric_cache_response jsonb;
  v_expected_criterion jsonb;
  v_criterion jsonb;
  v_question_id text;
  v_question_type text;
  v_answer_text text;
  v_answer_hash text;
  v_status text;
  v_source text;
  v_answer_present boolean;
  v_score numeric;
  v_max_score numeric;
  v_points numeric;
  v_criteria_sum numeric;
  v_rubric_sum numeric;
  v_index integer;
  v_expected_count integer;
  v_distinct_count integer;
  v_fill_expected_count integer := 0;
  v_rubric_expected_count integer := 0;
  v_is_answered boolean;
  v_rule_correct boolean;
  v_correct_count integer := 0;
  v_partial_count integer := 0;
  v_incorrect_count integer := 0;
  v_unanswered_count integer := 0;
  v_total_score numeric := 0;
  v_total_max_score numeric := 0;
begin
  if p_user_id is null or p_attempt_id is null or p_request_id is null or p_expected_updated_at is null
    or p_quiz_id is null or p_quiz_revision is null
    or pg_catalog.jsonb_typeof(p_result) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_result->'questions') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_questions) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_fill_judgments) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_rubric_judgments) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_result->'score') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'maxScore') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'correctCount') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'partialCount') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'incorrectCount') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'unansweredCount') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_result->'manualCount') is distinct from 'number' then
    raise exception 'Invalid finalization input' using errcode = '23514';
  end if;
  select * into v_attempt from public.attempts
    where id = p_attempt_id and user_id = p_user_id for update;
  if not found then raise exception 'Attempt owner mismatch' using errcode = '40001'; end if;
  if v_attempt.status = 'submitted' then
    if v_attempt.grading_version = 'ai-grading-v3' and v_attempt.submission_request_id = p_request_id then
      return query select a.* from public.attempts a where a.id = v_attempt.id;
      return;
    end if;
    raise exception 'Attempt already submitted' using errcode = '40001';
  end if;
  if v_attempt.status <> 'draft' or v_attempt.updated_at is distinct from p_expected_updated_at
    then raise exception 'Attempt version conflict' using errcode = '40001'; end if;
  if v_attempt.quiz_id is distinct from p_quiz_id or v_attempt.quiz_revision is distinct from p_quiz_revision then
    raise exception 'Exact quiz revision mismatch' using errcode = '40001';
  end if;

  select pg_catalog.count(*), pg_catalog.count(distinct value->>'questionId')
    into v_expected_count, v_distinct_count from pg_catalog.jsonb_array_elements(p_questions);
  if v_expected_count = 0 or v_expected_count <> v_distinct_count
    or v_expected_count <> pg_catalog.jsonb_array_length(p_result->'questions') then
    raise exception 'Invalid canonical question set' using errcode = '23514';
  end if;
  select pg_catalog.count(*), pg_catalog.count(distinct value->>'questionId')
    into v_expected_count, v_distinct_count from pg_catalog.jsonb_array_elements(p_result->'questions');
  if v_expected_count <> v_distinct_count then raise exception 'Duplicate result question' using errcode = '23514'; end if;
  select pg_catalog.count(*), pg_catalog.count(distinct value->>'questionId')
    into v_expected_count, v_distinct_count from pg_catalog.jsonb_array_elements(p_fill_judgments);
  if v_expected_count <> v_distinct_count then raise exception 'Duplicate fill judgment' using errcode = '23514'; end if;
  select pg_catalog.count(*), pg_catalog.count(distinct value->>'questionId')
    into v_expected_count, v_distinct_count from pg_catalog.jsonb_array_elements(p_rubric_judgments);
  if v_expected_count <> v_distinct_count then raise exception 'Duplicate rubric judgment' using errcode = '23514'; end if;

  if exists (select 1 from public.answers a where a.attempt_id = p_attempt_id and a.user_id = p_user_id
    and not exists (select 1 from pg_catalog.jsonb_array_elements(p_questions) as q(item)
      where q.item->>'questionId' = a.question_id)) then
    raise exception 'Stored answer outside canonical revision' using errcode = '23514';
  end if;
  if exists (select 1 from public.fill_judgments f where f.attempt_id = p_attempt_id)
    or exists (select 1 from public.rubric_judgments r where r.attempt_id = p_attempt_id) then
    raise exception 'Draft already has finalized judgments' using errcode = '23514';
  end if;

  for v_question in select value from pg_catalog.jsonb_array_elements(p_questions) loop
    v_question_id := v_question->>'questionId';
    v_question_type := v_question->>'type';
    if v_question_id is null or pg_catalog.char_length(v_question_id) not between 1 and 100
      or v_question_type is null or v_question_type not in ('single', 'multiple', 'true-false', 'fill', 'calculation', 'drawing')
      or pg_catalog.jsonb_typeof(v_question->'points') is distinct from 'number' then
      raise exception 'Invalid canonical question' using errcode = '23514';
    end if;
    v_points := (v_question->>'points')::numeric;
    if v_points <= 0 or v_points in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
      raise exception 'Invalid canonical max score' using errcode = '23514';
    end if;
    select value into v_grade from pg_catalog.jsonb_array_elements(p_result->'questions')
      where value->>'questionId' = v_question_id;
    if not found or v_grade->>'type' is distinct from v_question_type
      or pg_catalog.jsonb_typeof(v_grade->'score') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_grade->'maxScore') is distinct from 'number' then
      raise exception 'Missing or malformed result grade' using errcode = '23514';
    end if;
    select answer into v_answer from public.answers
      where attempt_id = p_attempt_id and user_id = p_user_id and question_id = v_question_id;
    v_answer_present := found;
    v_is_answered := coalesce(found and v_answer->>'type' = v_question_type, false);
    v_status := null;
    v_score := 0;
    v_max_score := v_points;

    if v_question_type in ('single', 'multiple', 'true-false') then
      if v_question_type = 'single' then
        if pg_catalog.jsonb_typeof(v_question->'correctOptionId') is distinct from 'string'
          or coalesce(v_question->>'correctOptionId', '') = '' then
          raise exception 'Missing canonical single answer' using errcode = '23514';
        end if;
        v_is_answered := v_is_answered and pg_catalog.btrim(coalesce(v_answer->>'optionId', '')) <> '';
        if v_is_answered then
          v_status := case when v_answer->>'optionId' = v_question->>'correctOptionId' then 'correct' else 'incorrect' end;
        end if;
      elsif v_question_type = 'multiple' then
        if pg_catalog.jsonb_typeof(v_question->'correctOptionIds') is distinct from 'array'
          or pg_catalog.jsonb_array_length(v_question->'correctOptionIds') = 0 then
          raise exception 'Missing canonical multiple answer' using errcode = '23514';
        end if;
        v_is_answered := v_is_answered and pg_catalog.jsonb_typeof(v_answer->'optionIds') = 'array'
          and pg_catalog.jsonb_array_length(v_answer->'optionIds') > 0;
        if v_is_answered then
          v_status := case when
            (select pg_catalog.count(distinct value) from pg_catalog.jsonb_array_elements_text(v_answer->'optionIds'))
              = (select pg_catalog.count(distinct value) from pg_catalog.jsonb_array_elements_text(v_question->'correctOptionIds'))
            and not exists (select 1 from pg_catalog.jsonb_array_elements_text(v_answer->'optionIds') a(value)
              where not (v_question->'correctOptionIds' @> pg_catalog.to_jsonb(a.value)))
            then 'correct' else 'incorrect' end;
        end if;
      else
        if pg_catalog.jsonb_typeof(v_question->'correctAnswer') is distinct from 'boolean' then
          raise exception 'Missing canonical true-false answer' using errcode = '23514';
        end if;
        v_is_answered := v_is_answered and pg_catalog.jsonb_typeof(v_answer->'value') = 'boolean';
        if v_is_answered then
          v_status := case when (v_answer->>'value')::boolean = (v_question->>'correctAnswer')::boolean
            then 'correct' else 'incorrect' end;
        end if;
      end if;
      if not v_is_answered then v_status := 'unanswered'; end if;
      if v_status = 'correct' then v_score := v_points; end if;

    elsif v_question_type = 'fill' then
      v_fill_expected_count := v_fill_expected_count + 1;
      if pg_catalog.jsonb_typeof(v_question->'correctAnswer') is distinct from 'string'
        or v_question->>'match' is null or v_question->>'match' not in ('exact', 'case-insensitive') then
        raise exception 'Missing canonical fill rule' using errcode = '23514';
      end if;
      v_answer_text := case when v_is_answered then coalesce(v_answer->>'text', '') else '' end;
      v_is_answered := v_is_answered and pg_catalog.btrim(v_answer_text) <> '';
      v_answer_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_answer_text, 'UTF8')), 'hex');
      v_rule_correct := case when v_question->>'match' = 'case-insensitive'
        then pg_catalog.lower(v_answer_text) = pg_catalog.lower(v_question->>'correctAnswer')
        else v_answer_text = v_question->>'correctAnswer' end;
      select value into v_fill from pg_catalog.jsonb_array_elements(p_fill_judgments)
        where value->>'questionId' = v_question_id;
      if not found or v_fill->>'answerHash' is distinct from v_answer_hash then
        raise exception 'Missing or stale fill judgment' using errcode = '23514';
      end if;
      v_source := v_fill->>'source';
      if not v_is_answered then
        v_status := 'unanswered';
        if v_source is distinct from 'rule' or v_fill->>'status' is distinct from v_status then
          raise exception 'Blank fill must be unanswered' using errcode = '23514';
        end if;
      elsif v_rule_correct then
        v_status := 'correct';
        if v_source is distinct from 'rule' or v_fill->>'status' is distinct from v_status then
          raise exception 'Rule-matched fill judgment mismatch' using errcode = '23514';
        end if;
      else
        if v_source is distinct from 'ai' or v_fill->>'status' is null or v_fill->>'status' not in ('correct', 'incorrect')
          or v_fill->>'confidence' is null or v_fill->>'confidence' not in ('high', 'medium', 'low')
          or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_fill->>'reason', ''))) not between 1 and 240
          or not exists (select 1 from private.fill_judge_cache c where c.user_id = p_user_id
            and c.attempt_id = p_attempt_id and c.quiz_id = v_attempt.quiz_id and c.quiz_revision = v_attempt.quiz_revision
            and c.question_id = v_question_id and c.answer_hash = v_answer_hash and c.state = 'completed'
            and c.judge_version = 'semantic-fill-v2' and c.verdict = v_fill->>'status'
            and c.confidence = v_fill->>'confidence' and c.reason = v_fill->>'reason'
            and c.model = 'gpt-6-luna' and c.reasoning_effort = 'medium') then
          raise exception 'AI fill cache evidence missing' using errcode = '23514';
        end if;
        v_status := v_fill->>'status';
      end if;
      if v_status = 'correct' then v_score := v_points; end if;

    else
      if pg_catalog.jsonb_typeof(v_question->'rubric') is distinct from 'array'
        or pg_catalog.jsonb_array_length(v_question->'rubric') = 0 then
        raise exception 'Missing canonical rubric' using errcode = '23514';
      end if;
      v_rubric_sum := 0;
      v_index := 0;
      for v_expected_criterion in select value from pg_catalog.jsonb_array_elements(v_question->'rubric') loop
        v_index := v_index + 1;
        if v_expected_criterion->>'criterionId' is distinct from 'r' || v_index::text
          or pg_catalog.jsonb_typeof(v_expected_criterion->'maxScore') is distinct from 'number'
          or (v_expected_criterion->>'maxScore')::numeric <= 0 then
          raise exception 'Invalid canonical rubric criterion' using errcode = '23514';
        end if;
        v_rubric_sum := v_rubric_sum + (v_expected_criterion->>'maxScore')::numeric;
      end loop;
      if v_rubric_sum <> v_points then raise exception 'Canonical rubric score mismatch' using errcode = '23514'; end if;
      if v_question_type = 'calculation' then
        if pg_catalog.jsonb_typeof(v_question->'referenceAnswer') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_question->'solution') is distinct from 'string' then
          raise exception 'Incomplete canonical calculation' using errcode = '23514'; end if;
        if v_answer_present and v_answer->>'type' is distinct from v_question_type then
          raise exception 'Stored calculation answer type mismatch' using errcode = '23514';
        end if;
        v_is_answered := v_answer_present and v_answer->>'type' = v_question_type
          and pg_catalog.btrim(coalesce(v_answer->>'text', '')) <> '';
      else
        if pg_catalog.jsonb_typeof(v_question->'referenceAnswer') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_question->'solution') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_question->'drawing') is distinct from 'object' then
          raise exception 'Incomplete canonical drawing' using errcode = '23514'; end if;
        if v_answer_present and v_answer->>'type' is distinct from v_question_type then
          raise exception 'Stored drawing answer type mismatch' using errcode = '23514';
        end if;
        -- The server rasterizer is authoritative for drawing visibility. A present
        -- drawing is only eligible for AI evidence; a system blank attestation can
        -- represent erased or sub-threshold strokes.
        v_is_answered := v_answer_present;
      end if;
      v_rubric_expected_count := v_rubric_expected_count + 1;
      select value into v_rubric_judgment from pg_catalog.jsonb_array_elements(p_rubric_judgments)
        where value->>'questionId' = v_question_id;
      v_answer_hash := private.rubric_answer_hash(coalesce(v_answer, 'null'::jsonb));
      if not found or v_rubric_judgment->>'questionType' is distinct from v_question_type
        or v_rubric_judgment->>'answerHash' is distinct from v_answer_hash then
        raise exception 'Missing or stale rubric answer-state evidence' using errcode = '23514';
      end if;
      v_source := v_rubric_judgment->>'source';
      if v_source = 'system' then
        if v_rubric_judgment->>'status' is distinct from 'unanswered'
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'score') is distinct from 'number'
          or (v_rubric_judgment->>'score')::numeric <> 0
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'maxScore') is distinct from 'number'
          or (v_rubric_judgment->>'maxScore')::numeric <> v_points
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'criteria') is distinct from 'array'
          or pg_catalog.jsonb_array_length(v_rubric_judgment->'criteria') <> 0
          or v_rubric_judgment ?| array['confidence', 'summary', 'strengths', 'improvements',
            'observations', 'missingOrUnclear', 'model', 'reasoningEffort']
          or (v_question_type = 'calculation' and v_is_answered) then
          raise exception 'Invalid system unanswered rubric evidence' using errcode = '23514';
        end if;
        v_status := 'unanswered';
        v_score := 0;
        v_max_score := v_points;
      elsif v_source = 'ai' then
        if not v_is_answered
          or v_rubric_judgment->>'status' not in ('correct', 'partial', 'incorrect')
          or v_rubric_judgment->>'model' is distinct from 'gpt-6-luna'
          or v_rubric_judgment->>'reasoningEffort' is distinct from 'medium'
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'score') is distinct from 'number'
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'maxScore') is distinct from 'number'
          or pg_catalog.jsonb_typeof(v_rubric_judgment->'criteria') is distinct from 'array'
          or pg_catalog.jsonb_array_length(v_rubric_judgment->'criteria') <> pg_catalog.jsonb_array_length(v_question->'rubric')
          or v_rubric_judgment->>'confidence' is null or v_rubric_judgment->>'confidence' not in ('high', 'medium', 'low')
          or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_rubric_judgment->>'summary', ''))) not between 1 and 2000 then
          raise exception 'Missing or malformed AI rubric judgment' using errcode = '23514';
        end if;
        v_score := (v_rubric_judgment->>'score')::numeric;
        v_max_score := (v_rubric_judgment->>'maxScore')::numeric;
        if v_max_score <> v_points or v_score < 0 or v_score > v_points
          or v_score in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
          raise exception 'Invalid rubric judgment score' using errcode = '23514';
        end if;
        v_criteria_sum := 0;
        v_index := 0;
        for v_expected_criterion in select value from pg_catalog.jsonb_array_elements(v_question->'rubric') loop
          v_index := v_index + 1;
          select value into v_criterion from pg_catalog.jsonb_array_elements(v_rubric_judgment->'criteria') with ordinality c(value, ordinal)
            where c.ordinal = v_index;
          if not found or v_criterion->>'criterionId' is distinct from v_expected_criterion->>'criterionId'
            or pg_catalog.jsonb_typeof(v_criterion->'maxScore') is distinct from 'number'
            or pg_catalog.jsonb_typeof(v_criterion->'awardedScore') is distinct from 'number'
            or (v_criterion->>'maxScore')::numeric <> (v_expected_criterion->>'maxScore')::numeric
            or (v_criterion->>'awardedScore')::numeric < 0
            or (v_criterion->>'awardedScore')::numeric > (v_expected_criterion->>'maxScore')::numeric
            or v_criterion->>'status' is null or v_criterion->>'status' not in ('full', 'partial', 'none')
            or (v_criterion->>'status' = 'full' and (v_criterion->>'awardedScore')::numeric <> (v_criterion->>'maxScore')::numeric)
            or (v_criterion->>'status' = 'partial' and not ((v_criterion->>'awardedScore')::numeric > 0
              and (v_criterion->>'awardedScore')::numeric < (v_criterion->>'maxScore')::numeric))
            or (v_criterion->>'status' = 'none' and (v_criterion->>'awardedScore')::numeric <> 0) then
            raise exception 'Rubric criterion mismatch' using errcode = '23514';
          end if;
          v_criteria_sum := v_criteria_sum + (v_criterion->>'awardedScore')::numeric;
        end loop;
        v_rubric_cache_response := v_rubric_judgment - 'source' - 'status' - 'model' - 'reasoningEffort';
        if v_criteria_sum <> v_score or not exists (select 1 from private.rubric_judge_cache c
          where c.user_id = p_user_id and c.attempt_id = p_attempt_id and c.quiz_id = v_attempt.quiz_id
            and c.quiz_revision = v_attempt.quiz_revision and c.question_id = v_question_id
            and c.question_type = v_question_type and c.answer_hash = v_answer_hash
            and c.judge_version = 'ai-grading-v3' and c.state = 'completed' and c.response = v_rubric_cache_response
            and c.max_score = v_points and c.model = 'gpt-6-luna' and c.reasoning_effort = 'medium') then
          raise exception 'Completed rubric cache evidence missing' using errcode = '23514';
        end if;
        v_status := case when v_score = v_points then 'correct' when v_score = 0 then 'incorrect' else 'partial' end;
        if v_rubric_judgment->>'status' is distinct from v_status then
          raise exception 'AI rubric status mismatch' using errcode = '23514';
        end if;
      else
        raise exception 'Unknown rubric evidence source' using errcode = '23514';
      end if;
    end if;

    if v_grade->>'status' is distinct from v_status
      or (v_grade->>'score')::numeric <> v_score or (v_grade->>'maxScore')::numeric <> v_max_score then
      raise exception 'Result grade does not match trusted evidence' using errcode = '23514';
    end if;
    v_total_score := v_total_score + v_score;
    v_total_max_score := v_total_max_score + v_max_score;
    if v_status = 'correct' then v_correct_count := v_correct_count + 1;
    elsif v_status = 'partial' then v_partial_count := v_partial_count + 1;
    elsif v_status = 'incorrect' then v_incorrect_count := v_incorrect_count + 1;
    elsif v_status = 'unanswered' then v_unanswered_count := v_unanswered_count + 1;
    else raise exception 'Manual status is not valid in v3' using errcode = '23514'; end if;
  end loop;

  if pg_catalog.jsonb_array_length(p_fill_judgments) <> v_fill_expected_count
    or pg_catalog.jsonb_array_length(p_rubric_judgments) <> v_rubric_expected_count then
    raise exception 'Extra or missing judgment' using errcode = '23514';
  end if;
  if (p_result->>'score')::numeric <> v_total_score
    or (p_result->>'maxScore')::numeric <> v_total_max_score
    or (p_result->>'correctCount')::integer <> v_correct_count
    or (p_result->>'partialCount')::integer <> v_partial_count
    or (p_result->>'incorrectCount')::integer <> v_incorrect_count
    or (p_result->>'unansweredCount')::integer <> v_unanswered_count
    or v_correct_count + v_partial_count + v_incorrect_count + v_unanswered_count <> pg_catalog.jsonb_array_length(p_questions)
    or coalesce((p_result->>'manualCount')::integer, 0) <> 0 then
    raise exception 'Result aggregate mismatch' using errcode = '23514';
  end if;

  insert into public.fill_judgments(user_id, attempt_id, quiz_id, quiz_revision, question_id, answer_hash,
    judge_version, source, status, model, reasoning_effort, confidence, reason)
  select p_user_id, p_attempt_id, v_attempt.quiz_id, v_attempt.quiz_revision, f.value->>'questionId',
    f.value->>'answerHash', 'ai-grading-v3', f.value->>'source', f.value->>'status',
    case when f.value->>'source' = 'ai' then 'gpt-6-luna' else null end,
    case when f.value->>'source' = 'ai' then 'medium' else null end,
    f.value->>'confidence', f.value->>'reason'
    from pg_catalog.jsonb_array_elements(p_fill_judgments) f(value);

  insert into public.rubric_judgments(user_id, attempt_id, quiz_id, quiz_revision, question_id, question_type,
    answer_hash, judge_version, source, status, score, max_score, criteria, confidence, summary, details, model,
    reasoning_effort, provider_response_id)
  select p_user_id, p_attempt_id, v_attempt.quiz_id, v_attempt.quiz_revision, j.value->>'questionId',
    j.value->>'questionType', j.value->>'answerHash', 'ai-grading-v3', j.value->>'source', j.value->>'status',
    (j.value->>'score')::numeric,
    (j.value->>'maxScore')::numeric, j.value->'criteria', j.value->>'confidence', j.value->>'summary',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('strengths', j.value->'strengths',
      'improvements', j.value->'improvements', 'observations', j.value->'observations',
      'missingOrUnclear', j.value->'missingOrUnclear')),
    c.model, c.reasoning_effort, c.provider_response_id
    from pg_catalog.jsonb_array_elements(p_rubric_judgments) j(value)
    left join private.rubric_judge_cache c on j.value->>'source' = 'ai'
      and c.user_id = p_user_id and c.attempt_id = p_attempt_id
      and c.quiz_id = v_attempt.quiz_id and c.quiz_revision = v_attempt.quiz_revision
      and c.question_id = j.value->>'questionId' and c.question_type = j.value->>'questionType'
      and c.answer_hash = j.value->>'answerHash' and c.judge_version = 'ai-grading-v3'
      and c.state = 'completed' and c.response = (j.value - 'source' - 'status' - 'model' - 'reasoningEffort')
    where j.value->>'source' = 'system' or c.claim_token is not null;

  return query update public.attempts a set status = 'submitted', grading_version = 'ai-grading-v3',
    submission_request_id = p_request_id, submitted_at = clock_timestamp(), deterministic_score = v_total_score,
    deterministic_max_score = v_total_max_score, correct_count = v_correct_count, partial_count = v_partial_count,
    incorrect_count = v_incorrect_count, unanswered_count = v_unanswered_count
    where a.id = p_attempt_id and a.user_id = p_user_id returning a.*;
end $$;
revoke all on function public.finalize_ai_grading_submission(uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_ai_grading_submission(uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,jsonb,jsonb)
  to service_role;

revoke all on public.attempts, public.answers, public.fill_judgments, public.rubric_judgments from service_role;
grant select, update on public.attempts to service_role;
grant select on public.answers to service_role;
grant select, insert on public.fill_judgments to service_role;
grant select, insert on public.rubric_judgments to service_role;
