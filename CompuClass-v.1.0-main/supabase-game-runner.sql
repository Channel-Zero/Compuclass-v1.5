-- ============================================================
-- CompuRunner multiplayer: add to your Supabase SQL Editor
-- Mirrors the circuit_maze_rooms/players pattern in
-- supabase-circuit-maze.sql — see that file for context.
-- Existing single-player scores stay in game_scores; this is
-- only for live room state during a multiplayer race.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_runner_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,          -- 6-char join code
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_runner_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.game_runner_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT,
  lane INTEGER NOT NULL DEFAULT 1,        -- current lane, 0-2
  score INTEGER NOT NULL DEFAULT 0,
  lives INTEGER NOT NULL DEFAULT 3,
  finished BOOLEAN NOT NULL DEFAULT false,
  finish_rank INTEGER,                    -- 1 = first to finish
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.game_runner_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_runner_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read runner rooms" ON public.game_runner_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Host can insert runner room" ON public.game_runner_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update runner room" ON public.game_runner_rooms
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Players can read runner room players" ON public.game_runner_players
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Players can insert self into runner room" ON public.game_runner_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can update own runner row" ON public.game_runner_players
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable Realtime on these tables (run in SQL editor)
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_runner_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_runner_players;
