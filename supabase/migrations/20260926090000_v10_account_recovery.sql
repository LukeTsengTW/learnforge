-- Additive release hardening. No raw recovery secrets or passwords are stored here.
create table private.account_recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'active' check (state in ('active', 'claiming', 'used')),
  created_at timestamptz not null default clock_timestamp(),
  used_at timestamptz,
  claim_id uuid,
  claim_expires_at timestamptz,
  check ((state = 'active' and claim_id is null and used_at is null)
    or (state = 'claiming' and claim_id is not null and claim_expires_at is not null and used_at is null)
    or (state = 'used' and claim_id is not null and used_at is not null))
);
create table private.recovery_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests > 0)
);
create index recovery_rate_limits_expiry_idx on private.recovery_rate_limits(window_start);
alter table private.account_recovery_codes enable row level security;
alter table private.recovery_rate_limits enable row level security;
revoke all on private.account_recovery_codes, private.recovery_rate_limits from public, anon, authenticated;

-- Public RPC signatures are service-only. Browser identity is bound by the Edge wrapper.
create function public.manage_account_recovery(p_user_id uuid, p_session_id uuid, p_code_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.account_recovery_codes;
begin
  if not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id
    and (not_after is null or not_after > clock_timestamp())) then
    return jsonb_build_object('validSession', false);
  end if;
  if p_code_hash is not null then
    if p_code_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid digest'; end if;
    insert into private.account_recovery_codes(user_id, code_hash) values(p_user_id, p_code_hash)
    on conflict(user_id) do update set code_hash=excluded.code_hash, state='active',
      created_at=clock_timestamp(), used_at=null, claim_id=null, claim_expires_at=null;
  end if;
  select * into v_row from private.account_recovery_codes where user_id=p_user_id;
  return jsonb_build_object('validSession', true, 'active', coalesce(v_row.state in ('active','claiming'),false),
    'createdAt', v_row.created_at);
end $$;
revoke all on function public.manage_account_recovery(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.manage_account_recovery(uuid, uuid, text) to service_role;

create function public.claim_account_recovery(p_username text, p_code_hash text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket text;
  v_count integer;
  v_limit integer;
  v_limited boolean := false;
  v_row private.account_recovery_codes;
  v_claim uuid := gen_random_uuid();
begin
  if p_username !~ '^[a-z0-9_]{3,24}$' or p_code_hash !~ '^[a-f0-9]{64}$'
    or p_ip_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('invalid',true); end if;
  -- Central limits: username 5, IP 20, global 200 per fixed 30-minute window.
  -- One global transaction lock makes all three counters durable and race-safe.
  perform pg_catalog.pg_advisory_xact_lock(10001001);
  delete from private.recovery_rate_limits where window_start <= v_now - interval '30 minutes';
  foreach v_bucket in array array['global', 'ip:'||p_ip_hash, 'username:'||p_username] loop
    v_limit := case when v_bucket='global' then 200 when v_bucket like 'ip:%' then 20 else 5 end;
    insert into private.recovery_rate_limits(bucket,window_start,requests) values(v_bucket,v_now,1)
    on conflict(bucket) do update set requests=private.recovery_rate_limits.requests+1
    returning requests into v_count;
    if v_count > v_limit then v_limited := true; end if;
  end loop;
  if v_limited then return jsonb_build_object('limited',true,'retryAfter',1800); end if;
  select r.* into v_row from private.account_recovery_codes r join public.profiles p on p.id=r.user_id
    where p.username=p_username and r.code_hash=p_code_hash for update of r;
  if not found or v_row.state='used' or (v_row.state='claiming' and v_row.claim_expires_at > v_now) then
    return jsonb_build_object('invalid',true);
  end if;
  update private.account_recovery_codes set state='claiming',claim_id=v_claim,
    claim_expires_at=v_now+interval '5 minutes' where user_id=v_row.user_id;
  return jsonb_build_object('userId',v_row.user_id,'claimId',v_claim);
end $$;
revoke all on function public.claim_account_recovery(text,text,text) from public, anon, authenticated;
grant execute on function public.claim_account_recovery(text,text,text) to service_role;

-- The claim transaction and Auth request are distinct. This fence runs INSIDE Auth's
-- password UPDATE transaction: consume and password write commit or roll back together.
-- Removing the transient marker ensures a delayed/replayed Admin call must recheck it.
create function private.consume_account_recovery() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_claim uuid;
begin
  if new.raw_app_meta_data ? 'learnforge_recovery_claim' then
    v_claim := (new.raw_app_meta_data->>'learnforge_recovery_claim')::uuid;
    if new.encrypted_password is not distinct from old.encrypted_password then
      raise exception 'Recovery password update required' using errcode='23514';
    end if;
    update private.account_recovery_codes set state='used', used_at=clock_timestamp()
      where user_id=new.id and claim_id=v_claim and state='claiming' and claim_expires_at > clock_timestamp();
    if not found then raise exception 'Recovery claim invalid' using errcode='23514'; end if;
    new.raw_app_meta_data := new.raw_app_meta_data - 'learnforge_recovery_claim';
    delete from auth.sessions where user_id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.consume_account_recovery() from public, anon, authenticated;
create trigger learnforge_consume_recovery before update on auth.users
  for each row execute function private.consume_account_recovery();

-- On transport ambiguity this serializes with the Auth trigger. If Auth committed,
-- report used; otherwise release. A late Auth write then fails the trigger fence.
create function public.release_account_recovery(p_user_id uuid, p_claim_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_row private.account_recovery_codes;
begin
  select * into v_row from private.account_recovery_codes where user_id=p_user_id for update;
  if v_row.claim_id is distinct from p_claim_id then return 'invalid'; end if;
  if v_row.state='used' then return 'used'; end if;
  update private.account_recovery_codes set state='active',claim_id=null,claim_expires_at=null
    where user_id=p_user_id and state='claiming';
  return 'released';
end $$;
revoke all on function public.release_account_recovery(uuid,uuid) from public, anon, authenticated;
grant execute on function public.release_account_recovery(uuid,uuid) to service_role;

-- Verified against linked rollback fixture on 2026-09-26; trigger owner is postgres.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
