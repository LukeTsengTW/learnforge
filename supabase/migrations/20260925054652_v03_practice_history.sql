-- LearnForge v0.3: preserve every existing attempt and answer in place.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.attempts'::regclass
    and conname = 'attempts_user_id_quiz_id_key' and contype = 'u') then
    raise exception 'Expected v0.2 attempts_user_id_quiz_id_key constraint is missing';
  end if;
end $$;
alter table public.attempts drop constraint attempts_user_id_quiz_id_key;
create unique index attempts_one_draft_per_quiz_idx on public.attempts(user_id, quiz_id) where status = 'draft';
create index attempts_history_idx on public.attempts(user_id, submitted_at desc, id desc) where status = 'submitted';

drop policy attempts_insert_own on public.attempts;
create policy attempts_insert_own on public.attempts for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()) and status = 'draft');
drop policy attempts_update_own on public.attempts;
create policy attempts_update_own on public.attempts for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()) and status = 'draft')
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()) and status in ('draft', 'submitted'));
drop policy attempts_delete_own on public.attempts;
create policy attempts_delete_own on public.attempts for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()) and status = 'draft');

create or replace function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'submitted' then raise exception 'Submitted attempt is immutable' using errcode = '23514'; end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.quiz_id <> old.quiz_id
    or new.quiz_revision <> old.quiz_revision or new.started_at <> old.started_at then
    raise exception 'Attempt identity is immutable' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- An authenticated caller can obtain the one draft without allocating a competing client UUID.
-- A transaction advisory lock serializes simultaneous starts for the same user and quiz.
create function public.get_or_create_quiz_draft(p_owner_id uuid, p_quiz_id text, p_quiz_revision text)
returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; started timestamptz;
begin
  if auth.uid() is null or p_owner_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_quiz_id is null or char_length(p_quiz_id) not between 1 and 100
    or p_quiz_revision is null or char_length(p_quiz_revision) not between 1 and 200 then
    raise exception 'Invalid quiz identity' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_quiz_id, 0));
  select * into current_row from public.attempts
    where user_id = auth.uid() and quiz_id = p_quiz_id and status = 'draft' for update;
  if not found then
    started := clock_timestamp();
    insert into public.attempts(user_id, quiz_id, quiz_revision, status, started_at, client_updated_at)
      values(auth.uid(), p_quiz_id, p_quiz_revision, 'draft', started, started)
      returning * into current_row;
  end if;
  return next current_row;
end $$;
revoke all on function public.get_or_create_quiz_draft(uuid, text, text) from public, anon;
grant execute on function public.get_or_create_quiz_draft(uuid, text, text) to authenticated;

-- All draft writes target one immutable attempt UUID and use the server timestamp as CAS.
create function public.save_quiz_attempt_v3(p_attempt_id uuid, p_payload jsonb, p_expected_updated_at timestamptz)
returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; item record; final_status text;
begin
  if auth.uid() is null or p_payload->>'ownerId' is distinct from auth.uid()::text then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_payload->>'status' not in ('in-progress', 'submitted')
    or jsonb_typeof(p_payload->'answers') is distinct from 'object' then
    raise exception 'Invalid attempt payload' using errcode = '22023';
  end if;
  select * into current_row from public.attempts where id = p_attempt_id and user_id = auth.uid() for update;
  if not found or current_row.status <> 'draft' then
    raise exception 'Draft unavailable' using errcode = '40001';
  end if;
  if current_row.updated_at is distinct from p_expected_updated_at then
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
  final_status := case when p_payload->>'status' = 'submitted' then 'submitted' else 'draft' end;
  return query update public.attempts set status = final_status,
    client_updated_at = (p_payload->>'updatedAt')::timestamptz,
    submitted_at = case when final_status = 'submitted' then (p_payload->>'submittedAt')::timestamptz end,
    deterministic_score = case when final_status = 'submitted' then (p_payload->'result'->>'score')::numeric end,
    deterministic_max_score = case when final_status = 'submitted' then (p_payload->'result'->>'maxScore')::numeric end,
    correct_count = case when final_status = 'submitted' then (p_payload->'result'->>'correctCount')::integer end,
    incorrect_count = case when final_status = 'submitted' then (p_payload->'result'->>'incorrectCount')::integer end,
    unanswered_count = case when final_status = 'submitted' then (p_payload->'result'->>'unansweredCount')::integer end
    where id = current_row.id returning *;
end $$;
revoke all on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_quiz_attempt_v3(uuid, jsonb, timestamptz) to authenticated;

-- The v0.2 quiz-unique RPC cannot safely address multiple attempts.
revoke execute on function public.save_quiz_attempt(text, jsonb, uuid, timestamptz) from authenticated;
