-- Faceswap feature: faces table + storage bucket

-- Faces table for saved model face profiles
CREATE TABLE faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users see and manage only their own faces
ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own faces"
  ON faces FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own faces"
  ON faces FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own faces"
  ON faces FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for API routes
CREATE POLICY "Service role full access to faces"
  ON faces FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup by user
CREATE INDEX idx_faces_user_id ON faces(user_id);

-- Create faces storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('faces', 'faces', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for faces bucket (same pattern as images bucket in 009)
CREATE POLICY "Users can upload faces" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own faces" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own faces" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role full access to faces storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'faces' AND auth.role() = 'service_role'
  );
