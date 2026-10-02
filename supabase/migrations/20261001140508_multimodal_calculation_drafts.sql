-- Draft answer schema is independent of the historical/formal grading version.
alter table public.attempts add column answer_schema_version smallint not null default 1
  constraint attempts_answer_schema_version_check check (answer_schema_version in (1, 2));

create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.answer_schema_version = 2 and new.status <> 'draft' then
      raise exception 'Multimodal submission is not enabled' using errcode = '42501';
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
  -- Schema 2 is draft-only until a separately reviewed formal submission milestone.
  if new.answer_schema_version = 2 and new.status <> 'draft' then
    raise exception 'Multimodal submission is not enabled' using errcode = '42501';
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
    if parent_schema = 2 then
      raise exception 'Server draft saving required' using errcode = '42501';
    end if;
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

-- Keep the v1.2 invoker/ownership/CAS contract; reject future shapes before any delete.
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
  if not found or current_row.status <> 'draft' or current_row.updated_at is distinct from p_expected_updated_at
    or current_row.answer_schema_version <> 1 then
    raise exception 'Attempt version conflict' using errcode = '40001';
  end if;
  if p_payload->>'quizId' is distinct from current_row.quiz_id
    or p_payload->>'quizRevision' is distinct from current_row.quiz_revision
    or (p_payload->>'startedAt')::timestamptz is distinct from current_row.started_at then
    raise exception 'Attempt identity conflict' using errcode = '40001';
  end if;
  if exists (select 1 from jsonb_each(p_payload->'answers') as entry
    where entry.value->>'type' = 'calculation' and (entry.value ? 'mode' or entry.value ? 'strokes')) then
    raise exception 'Legacy calculation shape required' using errcode = '42501';
  end if;
  delete from public.answers where attempt_id = current_row.id;
  for item in select key, value from jsonb_each(p_payload->'answers') loop
    insert into public.answers(attempt_id, user_id, question_id, answer)
      values(current_row.id, auth.uid(), item.key, item.value);
  end loop;
  return query update public.attempts set client_updated_at = (p_payload->>'updatedAt')::timestamptz
    where id = current_row.id returning *;
end $$;
revoke all on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) to authenticated;

-- Canonical semantics are checked by save-quiz-draft before this service-only transaction.
-- SQL bounds intentionally allow jsonb's added whitespace beyond the Edge's 4 MiB compact JSON bound.
create function public.save_quiz_attempt_v4(
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
  end loop;
  select * into current_row from public.attempts where id = p_attempt_id and user_id = p_user_id for update;
  if not found or current_row.status <> 'draft' or current_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Attempt version conflict' using errcode = '40001';
  end if;
  delete from public.answers where attempt_id = current_row.id;
  for item in select key, value from jsonb_each(p_answers) loop
    insert into public.answers(attempt_id, user_id, question_id, answer)
      values(current_row.id, p_user_id, item.key, item.value);
  end loop;
  return query update public.attempts set answer_schema_version = 2, client_updated_at = p_client_updated_at
    where id = current_row.id returning *;
end $$;
-- SECURITY INVOKER needs answer-row writes. Keep INSERT column-scoped and omit UPDATE.
grant insert (attempt_id, user_id, question_id, answer) on public.answers to service_role;
grant delete on public.answers to service_role;
revoke all on function public.save_quiz_attempt_v4(uuid, uuid, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_attempt_v4(uuid, uuid, timestamptz, timestamptz, jsonb) to service_role;
