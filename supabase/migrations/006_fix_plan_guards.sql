-- Fix check_expired_plans to also reset quota_used and clear plan_expires_at
CREATE OR REPLACE FUNCTION check_expired_plans()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET plan = 'free', monthly_quota = 5, quota_used = 0, plan_expires_at = NULL
  WHERE plan != 'free'
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix reset_monthly_quotas to properly reset quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    quota_used = 0,
    quota_reset_at = date_trunc('month', now()) + interval '1 month'
  WHERE quota_reset_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_cron for scheduled tasks (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule quota reset: run at midnight on the 1st of each month
SELECT cron.schedule(
  'reset-monthly-quotas',
  '0 0 1 * *',
  $$SELECT reset_monthly_quotas()$$
);

-- Schedule expired plan check: run every hour
SELECT cron.schedule(
  'check-expired-plans',
  '0 * * * *',
  $$SELECT check_expired_plans()$$
);
