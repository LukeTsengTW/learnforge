-- M4: formal ai-grading-v4 for schema-2 drafts. Local-only until a separately reviewed rollout.
-- Historical rows and the v3 identity/cache semantics (private.rubric_answer_hash) are unchanged.
alter table public.attempts drop constraint attempts_grading_version_check;
alter table public.attempts add constraint attempts_grading_version_check
  check (grading_version in ('deterministic-v1', 'semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4'));
alter table public.attempts drop constraint versioned_submission_has_request;
alter table public.attempts add constraint versioned_submission_has_request
  check (grading_version not in ('semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4')
    or (status = 'submitted' and submission_request_id is not null));
-- Draft answer schema and formal grading contract cannot drift apart.
alter table public.attempts add constraint attempts_grading_schema_provenance check (
  (grading_version <> 'ai-grading-v4' or answer_schema_version = 2)
  and (status <> 'submitted' or grading_version <> 'ai-grading-v3' or answer_schema_version = 1)
  and (status <> 'submitted' or answer_schema_version <> 2 or grading_version = 'ai-grading-v4'));

alter table public.fill_judgments drop constraint fill_judgments_judge_version_check;
alter table public.fill_judgments add constraint fill_judgments_judge_version_check
  check (judge_version in ('semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4'));
alter table public.rubric_judgments drop constraint rubric_judgments_judge_version_check;
alter table public.rubric_judgments add constraint rubric_judgments_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4'));
alter table private.rubric_judge_cache drop constraint rubric_judge_cache_judge_version_check;
alter table private.rubric_judge_cache add constraint rubric_judge_cache_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4'));
alter table private.rubric_judge_calls drop constraint rubric_judge_calls_judge_version_check;
alter table private.rubric_judge_calls add constraint rubric_judge_calls_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4'));

-- v4 blank classification only. Mirrors src/lib/v4-blank.ts exactly; stored text is never rewritten.
create function private.v4_is_blank_text(p_text text) returns boolean language sql immutable strict
set search_path = '' as $$
  select pg_catalog.btrim(p_text, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = ''
$$;

-- v4 score precision (mirrors src/lib/v4-score.ts): finite with at most 8 fractional digits.
-- PostgreSQL only VERIFIES canonical v4 scores and never rounds them; the Edge canonicalizes
-- provider output first, so exact NUMERIC sums of canonical criteria equal the canonical total.
create function private.v4_score_is_canonical(p_score numeric) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(p_score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and p_score = pg_catalog.round(p_score, 8), false)
$$;

create function private.v4_key_count(p_value jsonb) returns integer language sql immutable strict
set search_path = '' as $$
  select pg_catalog.count(*)::integer from pg_catalog.jsonb_object_keys(p_value)
$$;

-- Structural v4 calculation grammar. Geometry is checked against the canonical config separately.
create function private.v4_calculation_shape_valid(p_answer jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(p_answer) = 'object'
    and p_answer->>'type' = 'calculation'
    and private.v4_key_count(p_answer) = 4
    and p_answer ?& array['type', 'mode', 'text', 'strokes']
    and p_answer->>'mode' in ('text', 'drawing')
    and pg_catalog.jsonb_typeof(p_answer->'text') = 'string'
    and pg_catalog.jsonb_typeof(p_answer->'strokes') = 'array', false)
$$;

create function private.v4_drawing_config_valid(p_drawing jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(p_drawing) = 'object'
    and private.v4_key_count(p_drawing) = 2
    and pg_catalog.jsonb_typeof(p_drawing->'width') = 'number'
    and pg_catalog.jsonb_typeof(p_drawing->'height') = 'number'
    and (p_drawing->>'width')::numeric = pg_catalog.trunc((p_drawing->>'width')::numeric)
    and (p_drawing->>'height')::numeric = pg_catalog.trunc((p_drawing->>'height')::numeric)
    and (p_drawing->>'width')::numeric between 100 and 1200
    and (p_drawing->>'height')::numeric between 100 and 1200, false)
$$;

-- Bounded stroke grammar matching the Edge parser limits. The Edge rasterizer remains the
-- authority for geometry cost and meaningful blankness; SQL never infers blankness from strokes.
create function private.v4_strokes_shape_valid(p_strokes jsonb, p_drawing jsonb) returns boolean language plpgsql immutable
set search_path = '' as $$
declare
  v_stroke jsonb;
  v_point jsonb;
  v_points integer := 0;
  v_width numeric;
  v_height numeric;
begin
  if pg_catalog.jsonb_typeof(p_strokes) is distinct from 'array' or pg_catalog.jsonb_array_length(p_strokes) > 256
    or not private.v4_drawing_config_valid(p_drawing) then
    return false;
  end if;
  v_width := (p_drawing->>'width')::numeric;
  v_height := (p_drawing->>'height')::numeric;
  for v_stroke in select value from pg_catalog.jsonb_array_elements(p_strokes) loop
    if pg_catalog.jsonb_typeof(v_stroke) is distinct from 'object' or private.v4_key_count(v_stroke) <> 4
      or not (v_stroke ?& array['tool', 'color', 'width', 'points'])
      or v_stroke->>'tool' not in ('pen', 'eraser')
      or v_stroke->>'color' not in ('#202b38', '#c03535', '#255bbb')
      or pg_catalog.jsonb_typeof(v_stroke->'color') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_stroke->'width') is distinct from 'number'
      or (v_stroke->>'width')::numeric < 1 or (v_stroke->>'width')::numeric > 40
      or pg_catalog.jsonb_typeof(v_stroke->'points') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_stroke->'points') = 0 then
      return false;
    end if;
    v_points := v_points + pg_catalog.jsonb_array_length(v_stroke->'points');
    if v_points > 6000 then return false; end if;
    for v_point in select value from pg_catalog.jsonb_array_elements(v_stroke->'points') loop
      if pg_catalog.jsonb_typeof(v_point) is distinct from 'object' or private.v4_key_count(v_point) <> 2
        or pg_catalog.jsonb_typeof(v_point->'x') is distinct from 'number'
        or pg_catalog.jsonb_typeof(v_point->'y') is distinct from 'number'
        or (v_point->>'x')::numeric < 0 or (v_point->>'x')::numeric > v_width
        or (v_point->>'y')::numeric < 0 or (v_point->>'y')::numeric > v_height then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end $$;

-- Authoritative active-only projection. Inactive calculation buffers never reach v4 identity.
create function private.v4_active_answer(p_answer jsonb) returns jsonb language plpgsql immutable
set search_path = '' as $$
begin
  if p_answer is null or pg_catalog.jsonb_typeof(p_answer) = 'null' then return 'null'::jsonb; end if;
  if pg_catalog.jsonb_typeof(p_answer) = 'object' and p_answer->>'type' = 'calculation' then
    if not private.v4_calculation_shape_valid(p_answer) then
      raise exception 'Invalid v4 calculation answer' using errcode = '22023';
    end if;
    -- The validated shape has exactly {type, mode, text, strokes}; dropping the inactive key
    -- yields {type, mode, text} or {type, mode, strokes}.
    if p_answer->>'mode' = 'text' then
      return p_answer - 'strokes';
    end if;
    return p_answer - 'text';
  end if;
  return p_answer;
end $$;

-- Domain-separated so a v4 identity can never equal a v3 identity, even for identical JSON.
-- STABLE because convert_to is STABLE; the hash is never used in an index.
create function private.rubric_answer_hash_v4(p_answer jsonb) returns text language sql stable
set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'learnforge:ai-grading-v4:rubric-answer:' || private.v4_active_answer(p_answer)::text, 'UTF8')), 'hex')
$$;

revoke all on function private.v4_score_is_canonical(numeric) from public, anon, authenticated;
grant execute on function private.v4_score_is_canonical(numeric) to service_role;
revoke all on function private.v4_is_blank_text(text) from public, anon, authenticated;
revoke all on function private.v4_key_count(jsonb) from public, anon, authenticated;
revoke all on function private.v4_calculation_shape_valid(jsonb) from public, anon, authenticated;
revoke all on function private.v4_drawing_config_valid(jsonb) from public, anon, authenticated;
revoke all on function private.v4_strokes_shape_valid(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.v4_active_answer(jsonb) from public, anon, authenticated;
revoke all on function private.rubric_answer_hash_v4(jsonb) from public, anon, authenticated;
grant execute on function private.v4_is_blank_text(text) to service_role;
grant execute on function private.v4_key_count(jsonb) to service_role;
grant execute on function private.v4_calculation_shape_valid(jsonb) to service_role;
grant execute on function private.v4_drawing_config_valid(jsonb) to service_role;
grant execute on function private.v4_strokes_shape_valid(jsonb, jsonb) to service_role;
grant execute on function private.v4_active_answer(jsonb) to service_role;
grant execute on function private.rubric_answer_hash_v4(jsonb) to service_role;

-- Browser roles still never submit or forge provenance. Schema-2 draft -> submitted is
-- reserved for the v4 finalizer, which marks its own transaction for this attempt.
create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (new.answer_schema_version = 2 and new.status <> 'draft') or new.grading_version = 'ai-grading-v4' then
      raise exception 'Multimodal submission requires ai-grading-v4 finalization' using errcode = '42501';
    end if;
    if current_user <> 'service_role' and (new.status <> 'draft' or new.answer_schema_version <> 1
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
  if old.answer_schema_version = 2 and new.answer_schema_version <> 2 then
    raise exception 'Answer schema cannot be downgraded' using errcode = '23514';
  end if;
  if (new.answer_schema_version = 2 and new.status <> 'draft') or new.grading_version = 'ai-grading-v4' then
    if current_user <> 'service_role' or old.status <> 'draft' or new.status <> 'submitted'
      or old.answer_schema_version <> 2 or new.answer_schema_version <> 2
      or new.grading_version <> 'ai-grading-v4' or new.submission_request_id is null
      or new.submitted_at is null or new.deterministic_score is null or new.deterministic_max_score is null
      or new.correct_count is null or new.incorrect_count is null or new.unanswered_count is null
      or pg_catalog.current_setting('learnforge.v4_finalization', true) is distinct from new.id::text then
      raise exception 'Multimodal submission requires ai-grading-v4 finalization' using errcode = '42501';
    end if;
  end if;
  if current_user <> 'service_role' and (new.status <> 'draft'
    or new.answer_schema_version is distinct from old.answer_schema_version
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

-- v3 semantics are unchanged; the only addition is that a schema-2 draft can never borrow
-- the v3 contract (its legacy hash identity and blank rules do not apply to v4 answers).
create or replace function public.claim_rubric_judgment(
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
    or v_attempt.quiz_id <> p_quiz_id or v_attempt.quiz_revision <> p_quiz_revision
    or v_attempt.answer_schema_version <> 1 then
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

-- v4 rubric reservation. Same quota/ledger as v3, separate judge_version and active-only identity.
create function public.claim_rubric_judgment_v4(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz, p_request_id uuid,
  p_quiz_id text, p_quiz_revision text, p_question_id text, p_question_type text, p_max_score numeric,
  p_system_unanswered boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.attempts;
  v_answer jsonb;
  v_found boolean;
  v_answer_hash text;
  v_cache private.rubric_judge_cache;
  v_claim_token uuid;
  v_now timestamptz := clock_timestamp();
  v_attempt_calls integer;
  v_user_calls integer;
  v_has_cache boolean;
  v_text_blank boolean := false;
begin
  if current_user <> 'service_role' then raise exception 'Server role required' using errcode = '42501'; end if;
  if p_user_id is null or p_attempt_id is null or p_request_id is null or p_system_unanswered is null
    or p_expected_updated_at is null or p_question_type is null or p_question_type not in ('calculation', 'drawing')
    or p_question_id is null or pg_catalog.char_length(p_question_id) not between 1 and 100
    or p_quiz_id is null or p_quiz_revision is null or p_max_score is null
    or p_max_score <= 0 or not private.v4_score_is_canonical(p_max_score) then
    return pg_catalog.jsonb_build_object('state', 'conflict');
  end if;
  select * into v_attempt from public.attempts
    where id = p_attempt_id and user_id = p_user_id for update;
  if not found or v_attempt.status <> 'draft' or v_attempt.answer_schema_version <> 2
    or v_attempt.updated_at is distinct from p_expected_updated_at
    or v_attempt.quiz_id <> p_quiz_id or v_attempt.quiz_revision <> p_quiz_revision then
    return pg_catalog.jsonb_build_object('state', 'conflict');
  end if;
  select answer into v_answer from public.answers
    where attempt_id = p_attempt_id and user_id = p_user_id and question_id = p_question_id;
  v_found := found;
  if v_found and (v_answer->>'type' is distinct from p_question_type
    or (p_question_type = 'calculation' and not private.v4_calculation_shape_valid(v_answer))
    or (p_question_type = 'drawing' and (private.v4_key_count(v_answer) <> 2
      or pg_catalog.jsonb_typeof(v_answer->'strokes') is distinct from 'array'))) then
    return pg_catalog.jsonb_build_object('state', 'conflict');
  end if;
  v_answer_hash := private.rubric_answer_hash_v4(case when v_found then v_answer else null end);
  if v_found and p_question_type = 'calculation' and v_answer->>'mode' = 'text' then
    v_text_blank := private.v4_is_blank_text(v_answer->>'text');
  end if;
  if p_system_unanswered then
    -- Active text blankness is SQL-verifiable. Drawing-mode and DrawingQuestion blankness is
    -- attested only by the server rasterizer; SQL binds it to the persisted answer identity.
    if p_question_type = 'calculation' and v_found and v_answer->>'mode' = 'text' and not v_text_blank then
      return pg_catalog.jsonb_build_object('state', 'conflict');
    end if;
    return pg_catalog.jsonb_build_object('state', 'unanswered', 'answerHash', v_answer_hash);
  end if;
  if (not v_found and p_question_type <> 'drawing') or v_text_blank then
    return pg_catalog.jsonb_build_object('state', 'conflict');
  end if;

  select * into v_cache from private.rubric_judge_cache
    where user_id = p_user_id and attempt_id = p_attempt_id and quiz_id = p_quiz_id
      and quiz_revision = p_quiz_revision and question_id = p_question_id
      and question_type = p_question_type and answer_hash = v_answer_hash
      and judge_version = 'ai-grading-v4' for update;
  v_has_cache := found;
  if v_has_cache and v_cache.max_score is distinct from p_max_score then
    return pg_catalog.jsonb_build_object('state', 'conflict');
  end if;
  if v_has_cache and v_cache.state = 'completed' then
    return pg_catalog.jsonb_build_object('state', 'cached', 'answerHash', v_answer_hash, 'response', v_cache.response,
      'providerResponseId', v_cache.provider_response_id);
  end if;
  if v_has_cache and v_cache.state = 'reserved' and v_cache.reserved_until > v_now then
    return pg_catalog.jsonb_build_object('state', 'in_progress', 'answerHash', v_answer_hash);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select pg_catalog.count(*) into v_attempt_calls from private.rubric_judge_calls
    where user_id = p_user_id and attempt_id = p_attempt_id and created_at > v_now - interval '24 hours';
  select pg_catalog.count(*) into v_user_calls from private.rubric_judge_calls
    where user_id = p_user_id and created_at > v_now - interval '24 hours';
  if v_attempt_calls >= 20 or v_user_calls >= 100 then
    return pg_catalog.jsonb_build_object('state', 'limited');
  end if;

  v_claim_token := gen_random_uuid();
  if v_has_cache then
    if v_cache.state = 'reserved' then
      update private.rubric_judge_calls set status = 'failed', error_code = 'reservation_expired', completed_at = v_now
        where claim_token = v_cache.claim_token and status = 'reserved';
    end if;
    update private.rubric_judge_cache set state = 'reserved', claim_token = v_claim_token, request_id = p_request_id,
      reserved_until = v_now + interval '90 seconds', response = null, provider_response_id = null,
      max_score = p_max_score, model = 'gpt-6-luna', reasoning_effort = 'medium', updated_at = v_now
      where user_id = p_user_id and attempt_id = p_attempt_id and quiz_id = p_quiz_id
        and quiz_revision = p_quiz_revision and question_id = p_question_id
        and question_type = p_question_type and answer_hash = v_answer_hash and judge_version = 'ai-grading-v4';
  else
    insert into private.rubric_judge_cache(user_id, attempt_id, quiz_id, quiz_revision, question_id,
      question_type, answer_hash, judge_version, max_score, state, claim_token, request_id,
      reserved_until, model, reasoning_effort)
      values(p_user_id, p_attempt_id, p_quiz_id, p_quiz_revision, p_question_id,
        p_question_type, v_answer_hash, 'ai-grading-v4', p_max_score, 'reserved', v_claim_token,
        p_request_id, v_now + interval '90 seconds', 'gpt-6-luna', 'medium');
  end if;
  insert into private.rubric_judge_calls(user_id, attempt_id, quiz_id, quiz_revision, question_id,
    question_type, answer_hash, judge_version, claim_token, request_id, status)
    values(p_user_id, p_attempt_id, p_quiz_id, p_quiz_revision, p_question_id,
      p_question_type, v_answer_hash, 'ai-grading-v4', v_claim_token, p_request_id, 'reserved');
  return pg_catalog.jsonb_build_object('state', 'claimed', 'claimToken', v_claim_token, 'answerHash', v_answer_hash);
end $$;
revoke all on function public.claim_rubric_judgment_v4(uuid,uuid,timestamptz,uuid,text,text,text,text,numeric,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_rubric_judgment_v4(uuid,uuid,timestamptz,uuid,text,text,text,text,numeric,boolean)
  to service_role;

-- Read-only identity for submitted v4 reconstruction; PostgreSQL remains the hash authority.
create function public.rubric_answer_hashes_v4(p_user_id uuid, p_attempt_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_attempt public.attempts; v_hashes jsonb;
begin
  if current_user <> 'service_role' then raise exception 'Server role required' using errcode = '42501'; end if;
  select * into v_attempt from public.attempts where id = p_attempt_id and user_id = p_user_id;
  if not found or v_attempt.answer_schema_version <> 2 then
    raise exception 'Attempt unavailable' using errcode = '40001';
  end if;
  select coalesce(pg_catalog.jsonb_object_agg(a.question_id, private.rubric_answer_hash_v4(a.answer)), '{}'::jsonb)
    into v_hashes from public.answers a
    where a.attempt_id = p_attempt_id and a.user_id = p_user_id and a.answer->>'type' in ('calculation', 'drawing');
  return pg_catalog.jsonb_build_object('answers', v_hashes, 'missing', private.rubric_answer_hash_v4(null));
end $$;
revoke all on function public.rubric_answer_hashes_v4(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rubric_answer_hashes_v4(uuid,uuid) to service_role;

create function public.finalize_ai_grading_v4_submission(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz, p_request_id uuid,
  p_quiz_id text, p_quiz_revision text, p_result jsonb, p_fill_judgments jsonb, p_rubric_judgments jsonb, p_questions jsonb
) returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.attempts;
  v_question jsonb;
  v_grade jsonb;
  v_answer jsonb;
  v_stored record;
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
  if current_user <> 'service_role' then raise exception 'Server role required' using errcode = '42501'; end if;
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
    -- Replay is version-consistent: only the same v4 request returns the stored v4 result.
    if v_attempt.grading_version = 'ai-grading-v4' and v_attempt.submission_request_id = p_request_id then
      return query select a.* from public.attempts a where a.id = v_attempt.id;
      return;
    end if;
    raise exception 'Attempt already submitted' using errcode = '40001';
  end if;
  if v_attempt.answer_schema_version <> 2 then
    raise exception 'Answer schema requires a different grading contract' using errcode = '40001';
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

  if exists (select 1 from public.fill_judgments f where f.attempt_id = p_attempt_id)
    or exists (select 1 from public.rubric_judgments r where r.attempt_id = p_attempt_id) then
    raise exception 'Draft already has finalized judgments' using errcode = '23514';
  end if;

  -- Every stored answer must be inside the exact revision and in the strict v4 grammar,
  -- including inactive calculation buffers. Legacy calculation shape is not accepted here.
  for v_stored in select a.question_id, a.answer from public.answers a
    where a.attempt_id = p_attempt_id and a.user_id = p_user_id loop
    select q.item into v_question from pg_catalog.jsonb_array_elements(p_questions) as q(item)
      where q.item->>'questionId' = v_stored.question_id;
    if not found then raise exception 'Stored answer outside canonical revision' using errcode = '23514'; end if;
    v_answer := v_stored.answer;
    if pg_catalog.jsonb_typeof(v_answer) is distinct from 'object'
      or v_answer->>'type' is distinct from v_question->>'type'
      or (v_question->>'type' = 'single' and (private.v4_key_count(v_answer) <> 2
        or pg_catalog.jsonb_typeof(v_answer->'optionId') is distinct from 'string'))
      or (v_question->>'type' = 'multiple' and (private.v4_key_count(v_answer) <> 2
        or pg_catalog.jsonb_typeof(v_answer->'optionIds') is distinct from 'array'
        or exists (select 1 from pg_catalog.jsonb_array_elements(v_answer->'optionIds') o(value)
          where pg_catalog.jsonb_typeof(o.value) is distinct from 'string')))
      or (v_question->>'type' = 'true-false' and (private.v4_key_count(v_answer) <> 2
        or pg_catalog.jsonb_typeof(v_answer->'value') is distinct from 'boolean'))
      or (v_question->>'type' = 'fill' and (private.v4_key_count(v_answer) <> 2
        or pg_catalog.jsonb_typeof(v_answer->'text') is distinct from 'string'))
      or (v_question->>'type' = 'calculation' and (not private.v4_calculation_shape_valid(v_answer)
        or pg_catalog.char_length(v_answer->>'text') > 100000
        or (v_question ? 'drawing' and not private.v4_strokes_shape_valid(v_answer->'strokes', v_question->'drawing'))
        or (not (v_question ? 'drawing') and (v_answer->>'mode' <> 'text' or v_answer->'strokes' <> '[]'::jsonb))))
      or (v_question->>'type' = 'drawing' and (private.v4_key_count(v_answer) <> 2
        or not private.v4_strokes_shape_valid(v_answer->'strokes', v_question->'drawing'))) then
      raise exception 'Invalid stored v4 answer' using errcode = '23514';
    end if;
  end loop;

  for v_question in select value from pg_catalog.jsonb_array_elements(p_questions) loop
    v_question_id := v_question->>'questionId';
    v_question_type := v_question->>'type';
    if v_question_id is null or pg_catalog.char_length(v_question_id) not between 1 and 100
      or v_question_type is null or v_question_type not in ('single', 'multiple', 'true-false', 'fill', 'calculation', 'drawing')
      or pg_catalog.jsonb_typeof(v_question->'points') is distinct from 'number' then
      raise exception 'Invalid canonical question' using errcode = '23514';
    end if;
    v_points := (v_question->>'points')::numeric;
    if v_points <= 0 or not private.v4_score_is_canonical(v_points) then
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
    if not v_answer_present then v_answer := null; end if;
    v_is_answered := coalesce(v_answer_present and v_answer->>'type' = v_question_type, false);
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
      v_is_answered := v_is_answered and not private.v4_is_blank_text(v_answer_text);
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
        -- The semantic algorithm and its private cache identity are unchanged (semantic-fill-v2).
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
          or (v_expected_criterion->>'maxScore')::numeric <= 0
          or not private.v4_score_is_canonical((v_expected_criterion->>'maxScore')::numeric) then
          raise exception 'Invalid canonical rubric criterion' using errcode = '23514';
        end if;
        v_rubric_sum := v_rubric_sum + (v_expected_criterion->>'maxScore')::numeric;
      end loop;
      if v_rubric_sum <> v_points then raise exception 'Canonical rubric score mismatch' using errcode = '23514'; end if;
      if pg_catalog.jsonb_typeof(v_question->'referenceAnswer') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_question->'solution') is distinct from 'string' then
        raise exception 'Incomplete canonical rubric question' using errcode = '23514'; end if;
      if v_question_type = 'calculation' then
        if v_question ? 'drawing' and not private.v4_drawing_config_valid(v_question->'drawing') then
          raise exception 'Invalid canonical calculation drawing config' using errcode = '23514';
        end if;
        if not v_answer_present then
          v_is_answered := false;
        elsif v_answer->>'mode' = 'text' then
          v_is_answered := not private.v4_is_blank_text(v_answer->>'text');
        else
          -- Drawing mode: present strokes are only eligible for AI evidence; meaningful blankness
          -- is attested by the server rasterizer and carried as system evidence.
          v_is_answered := true;
        end if;
      else
        if not private.v4_drawing_config_valid(v_question->'drawing') then
          raise exception 'Incomplete canonical drawing' using errcode = '23514'; end if;
        v_is_answered := v_answer_present;
      end if;
      v_rubric_expected_count := v_rubric_expected_count + 1;
      select value into v_rubric_judgment from pg_catalog.jsonb_array_elements(p_rubric_judgments)
        where value->>'questionId' = v_question_id;
      v_answer_hash := private.rubric_answer_hash_v4(v_answer);
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
          or (v_question_type = 'calculation' and v_answer_present and v_answer->>'mode' = 'text' and v_is_answered) then
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
          or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_rubric_judgment->>'summary', ''))) not between 1 and 2000
          -- Handwritten calculation stays calculation: drawing-only detail fields are not valid evidence.
          or (v_question_type = 'calculation' and v_rubric_judgment ?| array['observations', 'missingOrUnclear'])
          or (v_question_type = 'drawing' and v_rubric_judgment ?| array['strengths', 'improvements']) then
          raise exception 'Missing or malformed AI rubric judgment' using errcode = '23514';
        end if;
        v_score := (v_rubric_judgment->>'score')::numeric;
        v_max_score := (v_rubric_judgment->>'maxScore')::numeric;
        if v_max_score <> v_points or v_score < 0 or v_score > v_points
          or v_score in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
          raise exception 'Invalid rubric judgment score' using errcode = '23514';
        end if;
        -- Same 8-decimal contract as the Edge: canonical evidence only, then exact sums.
        if not private.v4_score_is_canonical(v_score) or not private.v4_score_is_canonical(v_max_score)
          or exists (select 1 from pg_catalog.jsonb_array_elements(v_rubric_judgment->'criteria') c(value)
            where pg_catalog.jsonb_typeof(c.value->'awardedScore') is distinct from 'number'
              or pg_catalog.jsonb_typeof(c.value->'maxScore') is distinct from 'number'
              or not private.v4_score_is_canonical((c.value->>'awardedScore')::numeric)
              or not private.v4_score_is_canonical((c.value->>'maxScore')::numeric)) then
          raise exception 'Non-canonical v4 rubric score' using errcode = '23514';
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
            and c.judge_version = 'ai-grading-v4' and c.state = 'completed' and c.response = v_rubric_cache_response
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
    else raise exception 'Manual status is not valid in v4' using errcode = '23514'; end if;
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

  -- Final public evidence carries the v4 submission provenance.
  insert into public.fill_judgments(user_id, attempt_id, quiz_id, quiz_revision, question_id, answer_hash,
    judge_version, source, status, model, reasoning_effort, confidence, reason)
  select p_user_id, p_attempt_id, v_attempt.quiz_id, v_attempt.quiz_revision, f.value->>'questionId',
    f.value->>'answerHash', 'ai-grading-v4', f.value->>'source', f.value->>'status',
    case when f.value->>'source' = 'ai' then 'gpt-6-luna' else null end,
    case when f.value->>'source' = 'ai' then 'medium' else null end,
    f.value->>'confidence', f.value->>'reason'
    from pg_catalog.jsonb_array_elements(p_fill_judgments) f(value);

  insert into public.rubric_judgments(user_id, attempt_id, quiz_id, quiz_revision, question_id, question_type,
    answer_hash, judge_version, source, status, score, max_score, criteria, confidence, summary, details, model,
    reasoning_effort, provider_response_id)
  select p_user_id, p_attempt_id, v_attempt.quiz_id, v_attempt.quiz_revision, j.value->>'questionId',
    j.value->>'questionType', j.value->>'answerHash', 'ai-grading-v4', j.value->>'source', j.value->>'status',
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
      and c.answer_hash = j.value->>'answerHash' and c.judge_version = 'ai-grading-v4'
      and c.state = 'completed' and c.response = (j.value - 'source' - 'status' - 'model' - 'reasoningEffort')
    where j.value->>'source' = 'system' or c.claim_token is not null;
  if (select pg_catalog.count(*) from public.rubric_judgments r where r.attempt_id = p_attempt_id)
    <> v_rubric_expected_count then
    raise exception 'Rubric evidence insertion mismatch' using errcode = '23514';
  end if;

  perform pg_catalog.set_config('learnforge.v4_finalization', p_attempt_id::text, true);
  return query update public.attempts a set status = 'submitted', grading_version = 'ai-grading-v4',
    submission_request_id = p_request_id, submitted_at = clock_timestamp(), deterministic_score = v_total_score,
    deterministic_max_score = v_total_max_score, correct_count = v_correct_count, partial_count = v_partial_count,
    incorrect_count = v_incorrect_count, unanswered_count = v_unanswered_count
    where a.id = p_attempt_id and a.user_id = p_user_id returning a.*;
  perform pg_catalog.set_config('learnforge.v4_finalization', '', true);
end $$;
revoke all on function public.finalize_ai_grading_v4_submission(uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_ai_grading_v4_submission(uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,jsonb,jsonb)
  to service_role;
