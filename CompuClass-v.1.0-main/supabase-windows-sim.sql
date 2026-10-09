-- ============================================================
-- Windows 11 Simulator session tracking: add to your Supabase SQL Editor
-- ============================================================
--
-- Windows11SimulatorScreen.js reads/writes this table (start/end session,
-- duration) but it was never added to supabase-setup.sql, so it existed
-- (if at all) only as whatever was clicked together by hand in the
-- dashboard, with no tracked schema and no guaranteed RLS. This brings it
-- under version control with the same "users manage only their own rows"
-- policy used for quiz_attempts and circuit_maze_sessions.

CREATE TABLE IF NOT EXISTS public.windows_simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.windows_simulation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own simulator sessions" ON public.windows_simulation_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
