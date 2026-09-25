-- LearnForge v0.2. Additive schema; no existing objects or data are removed.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.password_hints (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hint text not null check (char_length(btrim(hint)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null check (char_length(quiz_id) between 1 and 100),
  quiz_revision text not null check (char_length(quiz_revision) between 1 and 200),
  status text not null check (status in ('draft', 'submitted')),
  started_at timestamptz not null,
  client_updated_at timestamptz not null,
  submitted_at timestamptz,
  deterministic_score numeric,
  deterministic_max_score numeric,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, quiz_id),
  unique (id, user_id),
  check (client_updated_at >= started_at),
  check ((status = 'draft' and submitted_at is null and deterministic_score is null
    and deterministic_max_score is null and correct_count is null and incorrect_count is null and unanswered_count is null)
    or (status = 'submitted' and submitted_at is not null and submitted_at >= started_at
    and deterministic_score is not null and deterministic_max_score is not null
    and deterministic_score >= 0 and deterministic_max_score >= deterministic_score
    and correct_count is not null and correct_count >= 0
    and incorrect_count is not null and incorrect_count >= 0
    and unanswered_count is not null and unanswered_count >= 0))
);
-- The unique user/quiz index also serves user_id-only lookups.
create index attempts_updated_at_idx on public.attempts(updated_at);
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 100),
  answer jsonb not null check (jsonb_typeof(answer) = 'object'),
  grade jsonb check (grade is null or jsonb_typeof(grade) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (attempt_id, user_id) references public.attempts(id, user_id) on delete cascade,
  unique (attempt_id, question_id)
);
create index answers_user_id_idx on public.answers(user_id);

alter table public.profiles enable row level security;
alter table public.password_hints enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
revoke all on public.profiles, public.password_hints, public.attempts, public.answers from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.attempts, public.answers to authenticated;
-- Hints never have an anonymous/authenticated policy or grant. Only the server reads them.
grant select on public.profiles, public.password_hints to service_role;
create policy profiles_read_own on public.profiles for select to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));
create policy attempts_read_own on public.attempts for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy attempts_insert_own on public.attempts for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy attempts_update_own on public.attempts for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy attempts_delete_own on public.attempts for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));
-- Both the answer and its parent must belong to the caller. The composite FK adds defence in depth.
create policy answers_own on public.answers for all to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()) and exists
    (select 1 from public.attempts a where a.id = attempt_id and a.user_id = (select auth.uid())))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()) and exists
    (select 1 from public.attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

-- Only this narrowly scoped trigger is a definer: Auth registration must create both rows atomically.
create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare uname text := new.raw_user_meta_data->>'username'; hint_value text := btrim(new.raw_user_meta_data->>'password_hint');
begin
  if uname is null or uname !~ '^[a-z0-9_]{3,24}$' or new.email is distinct from uname || '@users.learnforge.invalid'
    or hint_value is null or char_length(hint_value) not between 1 and 200 then
    raise exception 'Invalid registration metadata' using errcode = '22023';
  end if;
  insert into public.profiles(id, username) values (new.id, uname);
  insert into public.password_hints(user_id, hint) values (new.id, hint_value);
  return new;
end $$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger learnforge_create_profile after insert on auth.users for each row execute function private.create_profile();

create function private.lock_submission() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'submitted' then raise exception 'Submitted attempt is immutable' using errcode = '23514'; end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.quiz_id <> old.quiz_id or new.started_at <> old.started_at then
    raise exception 'Attempt identity is immutable' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.lock_submission() from public, anon, authenticated;
create trigger lock_submission before update on public.attempts for each row execute function private.lock_submission();

create function private.lock_answer() returns trigger language plpgsql set search_path = '' as $$
declare parent_status text;
begin
  if tg_op = 'UPDATE' and (new.attempt_id <> old.attempt_id or new.user_id <> old.user_id or new.question_id <> old.question_id) then
    raise exception 'Answer identity is immutable' using errcode = '23514';
  end if;
  -- Lock the parent to serialize answer writes against submission. Missing parent permits cascading restart DELETE.
  select status into parent_status from public.attempts where id = case when tg_op = 'DELETE' then old.attempt_id else new.attempt_id end for update;
  if parent_status = 'submitted' then raise exception 'Submitted answers are immutable' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.lock_answer() from public, anon, authenticated;
create trigger lock_answer before insert or update or delete on public.answers for each row execute function private.lock_answer();

-- Atomic header+answers save. Invoker rights retain RLS; expected version prevents lost updates across devices.
create function public.save_quiz_attempt(p_quiz_id text, p_payload jsonb, p_expected_id uuid default null, p_expected_updated_at timestamptz default null)
returns setof public.attempts language plpgsql security invoker set search_path = '' as $$
declare current_row public.attempts; item record; final_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
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
revoke all on function public.save_quiz_attempt(text, jsonb, uuid, timestamptz) from public, anon;
grant execute on function public.save_quiz_attempt(text, jsonb, uuid, timestamptz) to authenticated;

-- Durable fixed-window budgets, shared by all Edge workers. Not exposed by PostgREST.
create table private.hint_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests > 0)
);
alter table private.hint_rate_limits enable row level security;
revoke all on private.hint_rate_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.hint_rate_limits to service_role;

-- Only the server may call this RPC. Global budget bounds enumeration even with spoofed/rotated IPs.
create function public.request_password_hint(p_username text, p_ip_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare b text; n integer; limit_value integer; result_hint text;
begin
  if p_username is null or p_username !~ '^[a-z0-9_]{3,24}$' or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  delete from private.hint_rate_limits where window_start < now() - interval '1 day';
  -- Fixed order prevents lock-order inversions under concurrent requests.
  foreach b in array array['global', 'ip:' || p_ip_hash, 'user:' || p_username] loop
    limit_value := case when b = 'global' then 100 when b like 'ip:%' then 10 else 3 end;
    insert into private.hint_rate_limits as limits(bucket, window_start, requests) values(b, now(), 1)
      on conflict(bucket) do update set
        requests = case when limits.window_start <= now() - interval '15 minutes' then 1 else limits.requests + 1 end,
        window_start = case when limits.window_start <= now() - interval '15 minutes' then now() else limits.window_start end
      returning requests into n;
    -- Return (do not throw), so consumed budgets commit on denied requests.
    if n > limit_value then return jsonb_build_object('limited', true); end if;
  end loop;
  select h.hint into result_hint from public.password_hints h join public.profiles p on p.id = h.user_id where p.username = p_username;
  return jsonb_build_object('hint', result_hint);
end $$;
revoke all on function public.request_password_hint(text, text) from public, anon, authenticated;
grant execute on function public.request_password_hint(text, text) to service_role;
comment on table public.password_hints is 'No client grants or policies. Hints are available only through the rate-limited Edge Function.';
comment on function public.save_quiz_attempt(text, jsonb, uuid, timestamptz) is 'Client scores are untrusted cache values; LearnForge regrades loaded submissions with the canonical quiz.';
