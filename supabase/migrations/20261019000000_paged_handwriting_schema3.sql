-- M5: additive storage support for schema-3 paged calculation drafts.
-- Local-only until a separately reviewed production rollout. Existing rows are not rewritten.

alter table public.attempts drop constraint attempts_answer_schema_version_check;
alter table public.attempts add constraint attempts_answer_schema_version_check
  check (answer_schema_version in (1, 2, 3));

alter table public.attempts drop constraint attempts_grading_version_check;
alter table public.attempts add constraint attempts_grading_version_check
  check (grading_version in ('deterministic-v1', 'semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5'));
alter table public.attempts drop constraint versioned_submission_has_request;
alter table public.attempts add constraint versioned_submission_has_request
  check (grading_version not in ('semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5')
    or (status = 'submitted' and submission_request_id is not null));
alter table public.attempts drop constraint attempts_grading_schema_provenance;
alter table public.attempts add constraint attempts_grading_schema_provenance check (
  (grading_version <> 'ai-grading-v4' or answer_schema_version = 2)
  and (grading_version <> 'ai-grading-v5' or answer_schema_version = 3)
  and (status <> 'submitted' or grading_version <> 'ai-grading-v3' or answer_schema_version = 1)
  and (status <> 'submitted' or answer_schema_version <> 2 or grading_version = 'ai-grading-v4')
  and (status <> 'submitted' or answer_schema_version <> 3 or grading_version = 'ai-grading-v5'));

alter table public.fill_judgments drop constraint fill_judgments_judge_version_check;
alter table public.fill_judgments add constraint fill_judgments_judge_version_check
  check (judge_version in ('semantic-fill-v2', 'ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5'));
alter table public.rubric_judgments drop constraint rubric_judgments_judge_version_check;
alter table public.rubric_judgments add constraint rubric_judgments_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5'));
alter table private.rubric_judge_cache drop constraint rubric_judge_cache_judge_version_check;
alter table private.rubric_judge_cache add constraint rubric_judge_cache_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5'));
alter table private.rubric_judge_calls drop constraint rubric_judge_calls_judge_version_check;
alter table private.rubric_judge_calls add constraint rubric_judge_calls_judge_version_check
  check (judge_version in ('ai-grading-v3', 'ai-grading-v4', 'ai-grading-v5'));

create function private.v5_key_count(p_value jsonb) returns integer language sql immutable strict
set search_path = '' as $$
  select pg_catalog.count(*)::integer from pg_catalog.jsonb_object_keys(p_value)
$$;

-- Schema-3 pages share one 16,000 stroke / 32,000 point budget across the entire answer.
-- Exact quiz drawing dimensions and aggregate raster geometry remain checked by the Edge parser.
create function private.v5_drawing_pages_shape_valid(p_pages jsonb) returns boolean language plpgsql immutable
set search_path = '' as $$
declare
  v_page jsonb;
  v_stroke jsonb;
  v_point jsonb;
  v_strokes integer := 0;
  v_points integer := 0;
  v_pages integer;
begin
  if pg_catalog.jsonb_typeof(p_pages) is distinct from 'array' then return false; end if;
  v_pages := pg_catalog.jsonb_array_length(p_pages);
  -- [] is the canonical representation for a text-only calculation; Edge checks exact capability.
  if v_pages > 6 then return false; end if;
  for v_page in select value from pg_catalog.jsonb_array_elements(p_pages) loop
    if pg_catalog.jsonb_typeof(v_page) is distinct from 'array' then return false; end if;
    for v_stroke in select value from pg_catalog.jsonb_array_elements(v_page) loop
      if pg_catalog.jsonb_typeof(v_stroke) is distinct from 'object' or private.v5_key_count(v_stroke) <> 4
        or not (v_stroke ?& array['tool', 'color', 'width', 'points'])
        or pg_catalog.jsonb_typeof(v_stroke->'tool') is distinct from 'string'
        or v_stroke->>'tool' not in ('pen', 'eraser')
        or pg_catalog.jsonb_typeof(v_stroke->'color') is distinct from 'string'
        or v_stroke->>'color' not in ('#202b38', '#c03535', '#255bbb')
        or pg_catalog.jsonb_typeof(v_stroke->'width') is distinct from 'number'
        or (v_stroke->>'width')::numeric < 1 or (v_stroke->>'width')::numeric > 100
        or pg_catalog.jsonb_typeof(v_stroke->'points') is distinct from 'array'
        or pg_catalog.jsonb_array_length(v_stroke->'points') = 0 then
        return false;
      end if;
      v_strokes := v_strokes + 1;
      v_points := v_points + pg_catalog.jsonb_array_length(v_stroke->'points');
      if v_strokes > 16000 or v_points > 32000 then return false; end if;
      for v_point in select value from pg_catalog.jsonb_array_elements(v_stroke->'points') loop
        if pg_catalog.jsonb_typeof(v_point) is distinct from 'object' or private.v5_key_count(v_point) <> 2
          or not (v_point ?& array['x', 'y'])
          or pg_catalog.jsonb_typeof(v_point->'x') is distinct from 'number'
          or pg_catalog.jsonb_typeof(v_point->'y') is distinct from 'number'
          or (v_point->>'x')::numeric < 0 or (v_point->>'x')::numeric > 1200
          or (v_point->>'y')::numeric < 0 or (v_point->>'y')::numeric > 1200 then
          return false;
        end if;
      end loop;
    end loop;
  end loop;
  return true;
end $$;

create function private.v5_calculation_shape_valid(p_answer jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(p_answer) = 'object'
    and p_answer->>'type' = 'calculation'
    and private.v5_key_count(p_answer) = 4
    and p_answer ?& array['type', 'mode', 'text', 'pages']
    and p_answer->>'mode' in ('text', 'drawing')
    and pg_catalog.jsonb_typeof(p_answer->'text') = 'string'
    and (p_answer->>'mode' <> 'drawing' or p_answer->'pages' <> '[]'::jsonb)
    and private.v5_drawing_pages_shape_valid(p_answer->'pages'), false)
$$;

revoke all on function private.v5_key_count(jsonb) from public, anon, authenticated;
revoke all on function private.v5_drawing_pages_shape_valid(jsonb) from public, anon, authenticated;
revoke all on function private.v5_calculation_shape_valid(jsonb) from public, anon, authenticated;
grant execute on function private.v5_key_count(jsonb) to service_role;
grant execute on function private.v5_drawing_pages_shape_valid(jsonb) to service_role;
grant execute on function private.v5_calculation_shape_valid(jsonb) to service_role;

-- Preserve schema-2 locking/finalization checks and add a separate v5 finalization boundary.
create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (new.answer_schema_version in (2, 3) and new.status <> 'draft')
      or new.grading_version in ('ai-grading-v4', 'ai-grading-v5') then
      raise exception 'Multimodal submission requires its grading finalizer' using errcode = '42501';
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
  if (old.answer_schema_version = 2 and new.answer_schema_version not in (2, 3))
    or (old.answer_schema_version = 3 and new.answer_schema_version <> 3) then
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
  if (new.answer_schema_version = 3 and new.status <> 'draft') or new.grading_version = 'ai-grading-v5' then
    if current_user <> 'service_role' or old.status <> 'draft' or new.status <> 'submitted'
      or old.answer_schema_version <> 3 or new.answer_schema_version <> 3
      or new.grading_version <> 'ai-grading-v5' or new.submission_request_id is null
      or new.submitted_at is null or new.deterministic_score is null or new.deterministic_max_score is null
      or new.correct_count is null or new.incorrect_count is null or new.unanswered_count is null
      or pg_catalog.current_setting('learnforge.v5_finalization', true) is distinct from new.id::text then
      raise exception 'Paged handwriting submission requires ai-grading-v5 finalization' using errcode = '42501';
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

-- Schema-2 and schema-3 answer rows both require the authenticated Edge save path.
create or replace function private.lock_answer() returns trigger language plpgsql set search_path = '' as $$
declare parent_status text; parent_schema smallint; target_id uuid;
begin
  if tg_op = 'UPDATE' and (new.attempt_id <> old.attempt_id or new.user_id <> old.user_id or new.question_id <> old.question_id) then
    raise exception 'Answer identity is immutable' using errcode = '23514';
  end if;
  target_id := case when tg_op = 'DELETE' then old.attempt_id else new.attempt_id end;
  select status, answer_schema_version into parent_status, parent_schema from public.attempts where id = target_id for update;
  if parent_status = 'submitted' then raise exception 'Submitted answers are immutable' using errcode = '23514'; end if;
  if current_user <> 'service_role' then
    if parent_schema in (2, 3) then raise exception 'Server draft saving required' using errcode = '42501'; end if;
    if tg_op <> 'DELETE' and new.answer->>'type' = 'calculation'
      and (new.answer ? 'mode' or new.answer ? 'strokes') then
      raise exception 'Legacy calculation shape required' using errcode = '42501';
    end if;
  end if;
  if parent_status = 'draft' then
    update public.attempts set updated_at = clock_timestamp() where id = target_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- Edge validates the exact quiz context; SQL adds a strict pages grammar and aggregate backstop.
create function public.save_quiz_attempt_v5(
  p_user_id uuid, p_attempt_id uuid, p_expected_updated_at timestamptz,
  p_client_updated_at timestamptz, p_answers jsonb
) returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; item record;
begin
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Server role required' using errcode = '42501';
  end if;
  if p_client_updated_at is null or not isfinite(p_client_updated_at)
    or jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Invalid draft payload' using errcode = '22023';
  end if;
  if octet_length(convert_to(p_answers::text, 'UTF8')) > 8388608
    or (select count(*) from jsonb_each(p_answers)) > 100 then
    raise exception 'Draft payload too large' using errcode = '22023';
  end if;
  for item in select key, value from jsonb_each(p_answers) loop
    if item.key !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$' or jsonb_typeof(item.value) is distinct from 'object' then
      raise exception 'Invalid draft entry' using errcode = '22023';
    end if;
    if item.value->>'type' = 'calculation' and not private.v5_calculation_shape_valid(item.value) then
      raise exception 'Invalid schema-3 calculation answer' using errcode = '22023';
    end if;
  end loop;
  select * into current_row from public.attempts where id = p_attempt_id and user_id = p_user_id for update;
  if not found or current_row.status <> 'draft' or current_row.updated_at is distinct from p_expected_updated_at
    or current_row.answer_schema_version not in (1, 2, 3) then
    raise exception 'Attempt version conflict' using errcode = '40001';
  end if;
  delete from public.answers where attempt_id = current_row.id;
  for item in select key, value from jsonb_each(p_answers) loop
    insert into public.answers(attempt_id, user_id, question_id, answer)
      values(current_row.id, p_user_id, item.key, item.value);
  end loop;
  return query update public.attempts set answer_schema_version = 3, client_updated_at = p_client_updated_at
    where id = current_row.id returning *;
end $$;
grant insert (attempt_id, user_id, question_id, answer) on public.answers to service_role;
grant delete on public.answers to service_role;
revoke all on function public.save_quiz_attempt_v5(uuid, uuid, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_attempt_v5(uuid, uuid, timestamptz, timestamptz, jsonb) to service_role;
