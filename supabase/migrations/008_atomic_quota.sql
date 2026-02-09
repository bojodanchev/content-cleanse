-- Atomic quota consumption: returns true if quota was available and consumed
CREATE OR REPLACE FUNCTION try_consume_quota(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  consumed boolean;
BEGIN
  UPDATE profiles
  SET quota_used = quota_used + 1
  WHERE id = p_user_id
    AND quota_used < monthly_quota
  RETURNING true INTO consumed;

  RETURN COALESCE(consumed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refund quota when a job fails (give the credit back)
CREATE OR REPLACE FUNCTION refund_quota(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET quota_used = GREATEST(quota_used - 1, 0)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the job completion trigger: no longer increment quota (done before processing now)
-- Instead, refund quota if job fails
CREATE OR REPLACE FUNCTION on_job_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND OLD.status = 'processing' THEN
    -- Refund the quota credit since processing failed
    PERFORM refund_quota(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
