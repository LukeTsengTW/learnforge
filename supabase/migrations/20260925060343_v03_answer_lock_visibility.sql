-- The answer-lock trigger SELECTs its parent FOR UPDATE, which also requires the
-- parent's UPDATE policy to make submitted rows visible to that lock. The
-- lock_submission trigger still rejects every submitted mutation.
drop policy attempts_update_own on public.attempts;
create policy attempts_update_own on public.attempts for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()) and status in ('draft', 'submitted'));
