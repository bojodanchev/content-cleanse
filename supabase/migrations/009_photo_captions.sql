-- Add photo captions support to jobs and variants tables

-- Jobs: add job_type column to distinguish video vs photo_captions jobs
ALTER TABLE jobs ADD COLUMN job_type TEXT NOT NULL DEFAULT 'video';

-- Variants: add caption_text column for the caption burned into each image variant
ALTER TABLE variants ADD COLUMN caption_text TEXT;

-- Index for filtering jobs by type
CREATE INDEX idx_jobs_job_type ON jobs(job_type);

-- Create images storage bucket (private, same RLS pattern as videos)
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for images bucket
CREATE POLICY "Users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role needs full access for Modal worker uploads/downloads
CREATE POLICY "Service role full access to images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'images' AND auth.role() = 'service_role'
  );
