-- LearnForge v0.4. AI usage is controlled only by verified Edge functions using service_role.
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  attempt_id uuid not null,
  question_id text not null check (char_length(question_id) between 1 and 100),
  feature text not null check (feature in ('hint', 'explain_mistake', 'explain_solution')),
  credits integer not null check (credits between 1 and 2),
  model text not null check (model = 'gpt-6-luna'),
  reasoning_effort text not null check (reasoning_effort = 'low'),
  status text not null check (status in ('reserved', 'completed', 'refunded', 'expired')),
  created_at timestamptz not null default clock_timestamp(),
  reserved_until timestamptz not null,
  completed_at timestamptz,
  refunded_at timestamptz,
  provider_response_id text,
  response jsonb check (response is null or jsonb_typeof(response) = 'object'),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  error_code text,
  unique (user_id, request_id),
  check ((status = 'completed' and completed_at is not null and response is not null)
    or (status <> 'completed' and completed_at is null and response is null))
);
create index ai_requests_user_created_idx on public.ai_requests(user_id, created_at desc)
  where status in ('reserved', 'completed');
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from public, anon, authenticated;
grant select, insert, update on public.ai_requests to service_role;

-- A status read also expires stale reservations, so quota recovers without a cron job.
create function public.get_ai_quota_status(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz; v_used integer; v_next timestamptz;
begin
  if p_user_id is null then raise exception 'Invalid user' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  v_now := clock_timestamp();
  update public.ai_requests set status = 'expired' where user_id = p_user_id and status = 'reserved' and reserved_until <= v_now;
  select coalesce(sum(credits), 0)::integer,
    min(case when status = 'completed' then created_at + interval '5 hours' else reserved_until end)
    into v_used, v_next from public.ai_requests
    where user_id = p_user_id and created_at > v_now - interval '5 hours'
      and (status = 'completed' or (status = 'reserved' and reserved_until > v_now));
  return jsonb_build_object('limit', 20, 'used', v_used, 'remaining', greatest(0, 20 - v_used),
    'windowSeconds', 18000, 'nextCreditAt', v_next,
    'featureCosts', jsonb_build_object('hint', 1, 'explain_mistake', 1, 'explain_solution', 2));
end $$;
revoke all on function public.get_ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_quota_status(uuid) to service_role;

-- Read-only retry lookup after the Edge function has verified attempt ownership.
create function public.find_ai_request(p_user_id uuid, p_request_id uuid, p_attempt_id uuid,
  p_question_id text, p_feature text, p_model text, p_reasoning_effort text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_previous public.ai_requests;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Invalid lookup' using errcode = '22023'; end if;
  select * into v_previous from public.ai_requests where user_id = p_user_id and request_id = p_request_id;
  if not found then return jsonb_build_object('state', 'missing'); end if;
  if v_previous.attempt_id is distinct from p_attempt_id or v_previous.question_id is distinct from p_question_id
    or v_previous.feature is distinct from p_feature or v_previous.model is distinct from p_model
    or v_previous.reasoning_effort is distinct from p_reasoning_effort then
    return jsonb_build_object('state', 'mismatch');
  end if;
  if v_previous.status = 'reserved' and v_previous.reserved_until <= clock_timestamp() then
    return jsonb_build_object('state', 'expired');
  end if;
  return jsonb_build_object('state', v_previous.status, 'response', v_previous.response);
end $$;
revoke all on function public.find_ai_request(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.find_ai_request(uuid, uuid, uuid, text, text, text, text) to service_role;

-- The per-user transaction lock serializes counting and insertion across Edge workers.
-- A duplicate request ID never invokes the provider twice. Refunded/expired IDs are terminal.
create function public.reserve_ai_request(p_user_id uuid, p_request_id uuid, p_attempt_id uuid,
  p_question_id text, p_feature text, p_model text, p_reasoning_effort text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz; v_credits integer; v_used integer; v_previous public.ai_requests; v_next timestamptz;
begin
  v_credits := case p_feature when 'hint' then 1 when 'explain_mistake' then 1 when 'explain_solution' then 2 else null end;
  if p_user_id is null or p_request_id is null or p_attempt_id is null or p_question_id is null
    or char_length(p_question_id) not between 1 and 100 or v_credits is null
    or p_model is distinct from 'gpt-6-luna' or p_reasoning_effort is distinct from 'low' then
    raise exception 'Invalid AI request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  v_now := clock_timestamp();
  update public.ai_requests set status = 'expired' where user_id = p_user_id and status = 'reserved' and reserved_until <= v_now;
  select * into v_previous from public.ai_requests where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_previous.feature is distinct from p_feature or v_previous.attempt_id is distinct from p_attempt_id
      or v_previous.question_id is distinct from p_question_id or v_previous.model is distinct from p_model
      or v_previous.reasoning_effort is distinct from p_reasoning_effort then
      return jsonb_build_object('state', 'mismatch');
    end if;
    return jsonb_build_object('state', v_previous.status, 'response', v_previous.response);
  end if;
  select coalesce(sum(credits), 0)::integer,
    min(case when status = 'completed' then created_at + interval '5 hours' else reserved_until end)
    into v_used, v_next from public.ai_requests
    where user_id = p_user_id and created_at > v_now - interval '5 hours'
      and (status = 'completed' or (status = 'reserved' and reserved_until > v_now));
  if v_used + v_credits > 20 then
    return jsonb_build_object('state', 'denied', 'used', v_used, 'remaining', greatest(0, 20 - v_used),
      'nextCreditAt', v_next);
  end if;
  insert into public.ai_requests(user_id, request_id, attempt_id, question_id, feature, credits, model,
    reasoning_effort, status, created_at, reserved_until)
    values(p_user_id, p_request_id, p_attempt_id, p_question_id, p_feature, v_credits, p_model,
      p_reasoning_effort, 'reserved', v_now, v_now + interval '15 minutes');
  return jsonb_build_object('state', 'created', 'used', v_used + v_credits,
    'remaining', 20 - v_used - v_credits, 'credits', v_credits);
end $$;
revoke all on function public.reserve_ai_request(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, uuid, text, text, text, text) to service_role;

create function public.complete_ai_request(p_user_id uuid, p_request_id uuid, p_response jsonb,
  p_provider_response_id text, p_input_tokens integer, p_cached_input_tokens integer,
  p_output_tokens integer, p_reasoning_tokens integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz;
begin
  if p_user_id is null or p_request_id is null or jsonb_typeof(p_response) is distinct from 'object'
    or octet_length(p_response::text) > 16384 or p_input_tokens < 0 or p_cached_input_tokens < 0
    or p_output_tokens < 0 or p_reasoning_tokens < 0 then
    raise exception 'Invalid completion' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  v_now := clock_timestamp();
  update public.ai_requests set status = 'completed', completed_at = v_now, response = p_response,
    provider_response_id = left(p_provider_response_id, 200), input_tokens = p_input_tokens,
    cached_input_tokens = p_cached_input_tokens, output_tokens = p_output_tokens,
    reasoning_tokens = p_reasoning_tokens
    where user_id = p_user_id and request_id = p_request_id and status = 'reserved' and reserved_until > v_now;
  return found;
end $$;
revoke all on function public.complete_ai_request(uuid, uuid, jsonb, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.complete_ai_request(uuid, uuid, jsonb, text, integer, integer, integer, integer)
  to service_role;

create function public.refund_ai_request(p_user_id uuid, p_request_id uuid, p_error_code text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if p_user_id is null or p_request_id is null or p_error_code is null or char_length(p_error_code) > 60 then
    raise exception 'Invalid refund' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  update public.ai_requests set status = 'refunded', refunded_at = clock_timestamp(), error_code = p_error_code
    where user_id = p_user_id and request_id = p_request_id and status = 'reserved';
  return found;
end $$;
revoke all on function public.refund_ai_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_request(uuid, uuid, text) to service_role;

comment on table public.ai_requests is 'Private server-controlled rolling AI credit ledger. No browser grants or policies.';
