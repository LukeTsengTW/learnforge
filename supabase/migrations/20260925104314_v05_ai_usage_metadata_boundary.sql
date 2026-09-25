-- v0.5 correction: service_role owns the private ledger, while attempt metadata
-- is resolved by the Edge handler's user-scoped RLS client.
drop function public.get_ai_usage_page(uuid, timestamptz, uuid, integer);

create function public.get_ai_usage_page(p_user_id uuid, p_cursor_at timestamptz default null,
  p_cursor_id uuid default null, p_limit integer default 21)
returns table(id uuid, created_at timestamptz, attempt_id uuid,
  question_id text, feature text, credits integer, status text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_user_id is null or p_limit is null or p_limit not between 1 and 21
    or (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception 'Invalid AI usage page' using errcode = '22023';
  end if;
  return query
    select r.id, r.created_at, r.attempt_id, r.question_id, r.feature, r.credits,
      case when r.status = 'reserved' and r.reserved_until <= statement_timestamp()
        then 'expired' else r.status end
    from public.ai_requests r
    where r.user_id = p_user_id
      and (p_cursor_at is null or (r.created_at, r.id) < (p_cursor_at, p_cursor_id))
    order by r.created_at desc, r.id desc
    limit p_limit;
end $$;
revoke all on function public.get_ai_usage_page(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_ai_usage_page(uuid, timestamptz, uuid, integer)
  to service_role;
