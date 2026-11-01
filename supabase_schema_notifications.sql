-- Notifications Table for Dayal CRM
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  message text NOT NULL,
  module text DEFAULT 'general', -- 'lead', 'client', 'project', 'service', 'task'
  reference_id text, -- ID of the newly created lead/client/project
  recipient_role text DEFAULT 'All_Staff', -- 'Admin', 'Employee', 'All_Staff' (excludes Clients)
  recipient_user_id uuid, -- Optional: specific employee uuid
  is_read boolean DEFAULT false,
  created_by_name text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow reading and writing for anon & authenticated users (managed at app layer)
CREATE POLICY "Allow public read on notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert on notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on notifications" ON public.notifications FOR UPDATE USING (true);

-- Enable Supabase Realtime for instant notification badges
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
