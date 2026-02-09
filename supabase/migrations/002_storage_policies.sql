-- Storage policies for videos bucket
CREATE POLICY "Users can upload videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own videos" ON storage.objects
  FOR DELETE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for outputs bucket
CREATE POLICY "Users can read own outputs" ON storage.objects
  FOR SELECT USING (bucket_id = 'outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role can manage all storage (for Modal worker uploads)
CREATE POLICY "Service role can manage all storage" ON storage.objects
  FOR ALL USING (auth.role() = 'service_role');

-- Storage policies for watermarks bucket
CREATE POLICY "Users can upload watermarks" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'watermarks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own watermarks" ON storage.objects
  FOR SELECT USING (bucket_id = 'watermarks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own watermarks" ON storage.objects
  FOR DELETE USING (bucket_id = 'watermarks' AND auth.uid()::text = (storage.foldername(name))[1]);
