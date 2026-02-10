-- Add notification preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"processing_complete": true, "quota_warnings": true, "plan_expiry_reminder": true, "product_updates": false}'::jsonb;
