-- v0.5 keeps the ledger private. Only authenticated Edge handlers may call these
-- service_role-only, security-invoker projections after verifying the JWT.

-- Latest completed response for each question/feature within an attempt.
create index ai_requests_restore_completed_idx on public.ai_requests
  (user_id, attempt_id, question_id, feature, completed_at desc, created_at desc, id desc)
  where status = 'completed';

-- Active reservations are only surfaced as a pending signal, never as content.
create index ai_requests_restore_reserved_idx on public.ai_requests
  (user_id, attempt_id, question_id, feature, created_at desc, id desc)
  where status = 'reserved';

-- Stable cursor pagination and per-user time-window aggregates include all statuses.
create index ai_requests_user_cursor_idx on public.ai_requests
  (user_id, created_at desc, id desc);

create function public.get_ai_responses_for_attempt(p_user_id uuid, p_attempt_id uuid)
returns table(question_id text, feature text, response jsonb, completed_at timestamptz, pending boolean)
language sql stable security invoker set search_path = '' as $$
  with completed as (
    select distinct on (r.question_id, r.feature)
      r.question_id, r.feature, r.response, r.completed_at, false as pending
    from public.ai_requests r
    where r.user_id = p_user_id and r.attempt_id = p_attempt_id and r.status = 'completed'
    order by r.question_id, r.feature, r.completed_at desc, r.created_at desc, r.id desc
  ), active as (
    select distinct on (r.question_id, r.feature)
      r.question_id, r.feature, null::jsonb as response, null::timestamptz as completed_at,
      true as pending
    from public.ai_requests r
    where r.user_id = p_user_id and r.attempt_id = p_attempt_id
      and r.status = 'reserved' and r.reserved_until > statement_timestamp()
    order by r.question_id, r.feature, r.created_at desc, r.id desc
  )
  select * from completed
  union all
  select * from active;
$$;
revoke all on function public.get_ai_responses_for_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_ai_responses_for_attempt(uuid, uuid) to service_role;

-- NULL provider usage means unreported; sums treat it as zero, not a measured zero.
-- The counts expose how many requests have any provider token field populated.
create function public.get_ai_usage_summary(p_user_id uuid) returns jsonb
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

create function public.get_ai_usage_page(p_user_id uuid, p_cursor_at timestamptz default null,
  p_cursor_id uuid default null, p_limit integer default 21)
returns table(id uuid, created_at timestamptz, quiz_id text, quiz_revision text,
  question_id text, feature text, credits integer, status text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_user_id is null or p_limit is null or p_limit not between 1 and 21
    or (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception 'Invalid AI usage page' using errcode = '22023';
  end if;
  return query
    select r.id, r.created_at, a.quiz_id, a.quiz_revision, r.question_id,
      r.feature, r.credits,
      case when r.status = 'reserved' and r.reserved_until <= statement_timestamp()
        then 'expired' else r.status end
    from public.ai_requests r
    left join public.attempts a on a.id = r.attempt_id and a.user_id = r.user_id
    where r.user_id = p_user_id
      and (p_cursor_at is null or (r.created_at, r.id) < (p_cursor_at, p_cursor_id))
    order by r.created_at desc, r.id desc
    limit p_limit;
end $$;
revoke all on function public.get_ai_usage_page(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_ai_usage_page(uuid, timestamptz, uuid, integer)
  to service_role;

-- Keep the quota timestamp in the same DB clock domain as nextCreditAt.
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
    'featureCosts', jsonb_build_object('hint', 1, 'explain_mistake', 1, 'explain_solution', 2));
end $$;
revoke all on function public.get_ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_quota_status(uuid) to service_role;
