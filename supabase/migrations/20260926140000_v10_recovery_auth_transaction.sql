-- Auth Admin writes the password and app_metadata in separate UPDATE statements
-- inside one transaction. Check its FINAL row at transaction end, not per statement.
-- The initial claim RPC remains a separate transaction; this deferred fence makes
-- password, one-time consume, marker removal and session revocation atomic together.
create or replace function private.consume_account_recovery() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users; v_claim uuid;
begin
  select * into v_user from auth.users where id=new.id for update;
  if v_user.raw_app_meta_data ? 'learnforge_recovery_claim' then
    v_claim := (v_user.raw_app_meta_data->>'learnforge_recovery_claim')::uuid;
    if v_user.encrypted_password is not distinct from old.encrypted_password then
      raise exception 'Recovery password update required' using errcode='23514';
    end if;
    update private.account_recovery_codes set state='used', used_at=clock_timestamp()
      where user_id=new.id and claim_id=v_claim and state='claiming'
        and claim_expires_at > clock_timestamp();
    if not found then raise exception 'Recovery claim invalid' using errcode='23514'; end if;
    update auth.users set raw_app_meta_data=raw_app_meta_data-'learnforge_recovery_claim'
      where id=new.id;
    delete from auth.sessions where user_id=new.id;
  end if;
  return null;
end $$;
drop trigger learnforge_consume_recovery on auth.users;
create constraint trigger learnforge_consume_recovery after update on auth.users
  deferrable initially deferred for each row execute function private.consume_account_recovery();
