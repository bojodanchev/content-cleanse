-- Enable Supabase Realtime for the jobs table
-- This is required for the frontend to receive live job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
