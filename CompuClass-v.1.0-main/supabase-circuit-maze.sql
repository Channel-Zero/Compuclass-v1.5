-- ============================================================
-- Circuit Maze: add to your Supabase SQL Editor
-- ============================================================

-- 1. Session history (single-player records + leaderboard source)
CREATE TABLE IF NOT EXISTS public.circuit_maze_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  finish_bonus INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.circuit_maze_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own maze sessions" ON public.circuit_maze_sessions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Leaderboard read maze sessions" ON public.circuit_maze_sessions
  FOR SELECT USING (true);

-- 2. Real-time multiplayer rooms
CREATE TABLE IF NOT EXISTS public.circuit_maze_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,          -- 6-char join code
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.circuit_maze_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.circuit_maze_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,   -- current node id
  hearts INTEGER NOT NULL DEFAULT 5,
  xp INTEGER NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  finish_rank INTEGER,                    -- 1 = first to finish
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.circuit_maze_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_maze_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read rooms" ON public.circuit_maze_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Host can insert room" ON public.circuit_maze_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update room" ON public.circuit_maze_rooms
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Players can read room players" ON public.circuit_maze_players
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Players can insert self" ON public.circuit_maze_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can update self" ON public.circuit_maze_players
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable Realtime on these tables (run in SQL editor)
ALTER PUBLICATION supabase_realtime ADD TABLE public.circuit_maze_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circuit_maze_players;

-- 3. Award XP into the existing gamification.user_stats
CREATE OR REPLACE FUNCTION public.award_maze_xp(p_xp INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gamification'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_old_xp INTEGER;
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_xp <= 0 THEN RETURN jsonb_build_object('xp_awarded', 0); END IF;

  INSERT INTO gamification.user_stats (user_id) VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT xp, level INTO v_old_xp, v_old_level
  FROM gamification.user_stats WHERE user_id = v_user_id;

  v_new_xp    := v_old_xp + p_xp;
  v_new_level := public.xp_to_level(v_new_xp);

  UPDATE gamification.user_stats
  SET xp = v_new_xp, level = v_new_level,
      last_activity_date = CURRENT_DATE, updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'xp_awarded', p_xp,
    'new_xp', v_new_xp,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'leveled_up', v_new_level > v_old_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_maze_xp(integer) TO authenticated;
