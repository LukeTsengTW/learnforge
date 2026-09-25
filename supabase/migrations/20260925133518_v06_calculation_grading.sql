-- v0.6: calculation grading is a private, advisory-only AI ledger feature.
-- Existing attempt, answer, and deterministic grade tables are untouched.
alter table public.ai_requests drop constraint if exists ai_requests_feature_check;
alter table public.ai_requests drop constraint if exists ai_requests_reasoning_effort_check;
alter table public.ai_requests add constraint ai_requests_feature_check
  check (feature in ('hint', 'explain_mistake', 'explain_solution', 'calculation_grading'));
alter table public.ai_requests add constraint ai_requests_reasoning_effort_check
  check ((feature = 'calculation_grading' and reasoning_effort = 'medium')
    or (feature <> 'calculation_grading' and reasoning_effort = 'low'));
alter table public.ai_requests add constraint ai_requests_feature_cost_check
  check (credits = case feature
    when 'hint' then 1 when 'explain_mistake' then 1
    when 'explain_solution' then 2 when 'calculation_grading' then 2 end);

create or replace function public.get_ai_quota_status(p_user_id uuid) returns jsonb
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
    'windowSeconds', 18000, 'serverNow', v_now, 'nextCreditAt', v_next,
    'featureCosts', jsonb_build_object('hint', 1, 'explain_mistake', 1,
      'explain_solution', 2, 'calculation_grading', 2));
end $$;
revoke all on function public.get_ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_quota_status(uuid) to service_role;

-- Same signature and per-user transaction lock as v0.4. Neither cost nor model
-- settings are parameters: they are derived and checked inside this function.
create or replace function public.reserve_ai_request(p_user_id uuid, p_request_id uuid, p_attempt_id uuid,
  p_question_id text, p_feature text, p_model text, p_reasoning_effort text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz; v_credits integer; v_used integer; v_previous public.ai_requests; v_next timestamptz;
begin
  v_credits := case p_feature when 'hint' then 1 when 'explain_mistake' then 1
    when 'explain_solution' then 2 when 'calculation_grading' then 2 else null end;
  if p_user_id is null or p_request_id is null or p_attempt_id is null or p_question_id is null
    or char_length(p_question_id) not between 1 and 100 or v_credits is null
    or p_model is distinct from 'gpt-6-luna'
    or p_reasoning_effort is distinct from (case when p_feature = 'calculation_grading' then 'medium' else 'low' end) then
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

create or replace function public.get_ai_usage_summary(p_user_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with bounds as (select statement_timestamp() as server_now),
  windows(name, cutoff) as (
    select 'last5Hours'::text, server_now - interval '5 hours' from bounds
    union all select 'last24Hours', server_now - interval '24 hours' from bounds
    union all select 'allTime', '-infinity'::timestamptz
  )
  select jsonb_object_agg(w.name, jsonb_build_object(
    'requestCount', a.request_count,
    'completedCount', a.completed_count,
    'refundedCount', a.refunded_count,
    'expiredCount', a.expired_count,
    'hintCount', a.hint_count,
    'mistakeCount', a.mistake_count,
    'solutionCount', a.solution_count,
    'calculationGradingCount', a.calculation_grading_count,
    'inputTokens', a.input_tokens,
    'cachedInputTokens', a.cached_input_tokens,
    'outputTokens', a.output_tokens,
    'reasoningTokens', a.reasoning_tokens,
    'usageReportedCount', a.usage_reported_count
  ))
  from windows w cross join lateral (
    select count(*) as request_count,
      count(*) filter (where effective_status = 'completed') as completed_count,
      count(*) filter (where effective_status = 'refunded') as refunded_count,
      count(*) filter (where effective_status = 'expired') as expired_count,
      count(*) filter (where effective_status = 'completed' and feature = 'hint') as hint_count,
      count(*) filter (where effective_status = 'completed' and feature = 'explain_mistake') as mistake_count,
      count(*) filter (where effective_status = 'completed' and feature = 'explain_solution') as solution_count,
      count(*) filter (where effective_status = 'completed' and feature = 'calculation_grading') as calculation_grading_count,
      coalesce(sum(input_tokens), 0) as input_tokens,
      coalesce(sum(cached_input_tokens), 0) as cached_input_tokens,
      coalesce(sum(output_tokens), 0) as output_tokens,
      coalesce(sum(reasoning_tokens), 0) as reasoning_tokens,
      count(*) filter (where input_tokens is not null or cached_input_tokens is not null
        or output_tokens is not null or reasoning_tokens is not null) as usage_reported_count
    from (select r.*, case when r.status = 'reserved' and r.reserved_until <= statement_timestamp()
        then 'expired' else r.status end as effective_status
      from public.ai_requests r
      where r.user_id = p_user_id and r.created_at > w.cutoff) r
  ) a;
$$;
revoke all on function public.get_ai_usage_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_usage_summary(uuid) to service_role;
