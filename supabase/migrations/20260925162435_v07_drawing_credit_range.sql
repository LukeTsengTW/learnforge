-- The original ai_requests column check allows only 1-2 credits.
-- Drawing analysis needs 4; the feature_cost check still enforces the exact cost.
alter table public.ai_requests drop constraint ai_requests_credits_check;
alter table public.ai_requests add constraint ai_requests_credits_check
  check (credits between 1 and 4);
