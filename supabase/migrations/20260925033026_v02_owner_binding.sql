-- Bind every write to the account that created the repository, even if the browser changes sessions mid-request.
create or replace function public.save_quiz_attempt(p_quiz_id text, p_payload jsonb, p_expected_id uuid default null, p_expected_updated_at timestamptz default null)
returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; item record; final_status text;
begin
  if auth.uid() is null or p_payload->>'ownerId' is distinct from auth.uid()::text then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_payload->>'quizId' is distinct from p_quiz_id or p_payload->>'status' not in ('in-progress', 'submitted')
    or jsonb_typeof(p_payload->'answers') is distinct from 'object' then
    raise exception 'Invalid attempt payload' using errcode = '22023';
  end if;
  select * into current_row from public.attempts where user_id = auth.uid() and quiz_id = p_quiz_id for update;
  if found then
    if current_row.id is distinct from p_expected_id or current_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'Attempt version conflict' using errcode = '40001';
    end if;
    if current_row.status = 'submitted' then raise exception 'Submitted attempt is immutable' using errcode = '23514'; end if;
  else
    if p_expected_id is not null then raise exception 'Attempt was restarted' using errcode = '40001'; end if;
    insert into public.attempts(user_id, quiz_id, quiz_revision, status, started_at, client_updated_at)
      values(auth.uid(), p_quiz_id, p_payload->>'quizRevision', 'draft', (p_payload->>'startedAt')::timestamptz,
      (p_payload->>'updatedAt')::timestamptz) returning * into current_row;
  end if;
  delete from public.answers where attempt_id = current_row.id;
  for item in select key, value from jsonb_each(p_payload->'answers') loop
    insert into public.answers(attempt_id, user_id, question_id, answer) values(current_row.id, auth.uid(), item.key, item.value);
  end loop;
  final_status := case when p_payload->>'status' = 'submitted' then 'submitted' else 'draft' end;
  return query update public.attempts set quiz_revision = p_payload->>'quizRevision', status = final_status,
    client_updated_at = (p_payload->>'updatedAt')::timestamptz,
    submitted_at = case when final_status = 'submitted' then (p_payload->>'submittedAt')::timestamptz end,
    deterministic_score = case when final_status = 'submitted' then (p_payload->'result'->>'score')::numeric end,
    deterministic_max_score = case when final_status = 'submitted' then (p_payload->'result'->>'maxScore')::numeric end,
    correct_count = case when final_status = 'submitted' then (p_payload->'result'->>'correctCount')::integer end,
    incorrect_count = case when final_status = 'submitted' then (p_payload->'result'->>'incorrectCount')::integer end,
    unanswered_count = case when final_status = 'submitted' then (p_payload->'result'->>'unansweredCount')::integer end
    where id = current_row.id returning *;
end $$;
