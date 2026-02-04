-- Content Cleanse Database Schema
-- Video uniquification SaaS for OFM community

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- PROFILES (extends Supabase Auth)
-- ========================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  monthly_quota INT DEFAULT 5,
  quota_used INT DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================================
-- PROCESSING JOBS
-- ========================================
CREATE TYPE job_status AS ENUM ('pending', 'uploading', 'processing', 'completed', 'failed');

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  status job_status DEFAULT 'pending',

  -- Source file info
  source_file_path TEXT,
  source_file_name TEXT,
  source_file_size BIGINT,
  source_duration DECIMAL,

  -- Processing settings
  variant_count INT DEFAULT 10,
  settings JSONB DEFAULT '{
    "brightness_range": [-0.03, 0.03],
    "saturation_range": [0.97, 1.03],
    "hue_range": [-5, 5],
    "crop_px_range": [1, 3],
    "speed_range": [0.98, 1.02],
    "remove_watermark": false,
    "add_watermark": false,
    "watermark_path": null
  }'::jsonb,

  -- Progress tracking
  progress INT DEFAULT 0,
  variants_completed INT DEFAULT 0,

  -- Output
  output_zip_path TEXT,

  -- Error handling
  error_message TEXT,
  error_code TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for user's jobs
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- ========================================
-- INDIVIDUAL VARIANTS
-- ========================================
CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs ON DELETE CASCADE,

  -- File info
  file_path TEXT,
  file_size BIGINT,

  -- Applied transformations (for reproducibility)
  transformations JSONB,

  -- Hash for uniqueness verification
  file_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for job's variants
CREATE INDEX idx_variants_job_id ON variants(job_id);

-- ========================================
-- ANALYTICS EVENTS
-- ========================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- ========================================
-- API USAGE (for Agency plan)
-- ========================================
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_code INT,
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for API usage queries
CREATE INDEX idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);

-- ========================================
-- WATERMARKS (user uploaded)
-- ========================================
CREATE TABLE watermarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  position TEXT DEFAULT 'bottom-right' CHECK (position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
  opacity DECIMAL DEFAULT 0.8 CHECK (opacity >= 0 AND opacity <= 1),
  scale DECIMAL DEFAULT 0.15 CHECK (scale > 0 AND scale <= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user's watermarks
CREATE INDEX idx_watermarks_user_id ON watermarks(user_id);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermarks ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Jobs: users can CRUD their own jobs
CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Variants: users can view variants of their jobs
CREATE POLICY "Users can view own variants" ON variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = variants.job_id AND jobs.user_id = auth.uid()
    )
  );

-- Events: users can view their own events
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- API Usage: users can view their own API usage
CREATE POLICY "Users can view own api usage" ON api_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Watermarks: users can CRUD their own watermarks
CREATE POLICY "Users can view own watermarks" ON watermarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own watermarks" ON watermarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watermarks" ON watermarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watermarks" ON watermarks
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STORAGE BUCKETS (run in Supabase dashboard)
-- ========================================
-- Note: Run these in Supabase SQL editor or dashboard
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('outputs', 'outputs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('watermarks', 'watermarks', false);
--
-- Storage policies:
-- CREATE POLICY "Users can upload videos" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users can read own videos" ON storage.objects
--   FOR SELECT USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to reset monthly quotas (run via cron)
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

-- Function to update profile on plan change
CREATE OR REPLACE FUNCTION update_plan_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan != OLD.plan THEN
    NEW.monthly_quota := CASE NEW.plan
      WHEN 'free' THEN 5
      WHEN 'pro' THEN 100
      WHEN 'agency' THEN 10000 -- effectively unlimited
    END;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_plan_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
  EXECUTE FUNCTION update_plan_quota();

-- Function to track job completion and update quota
CREATE OR REPLACE FUNCTION on_job_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE profiles
    SET quota_used = quota_used + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_job_status_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION on_job_completed();
