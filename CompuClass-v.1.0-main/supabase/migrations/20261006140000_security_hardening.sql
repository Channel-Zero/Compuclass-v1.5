-- =============================================================================
-- Security hardening for the schema currently in this repo
-- =============================================================================
-- NOT APPLIED. Do not run this against a database from this commit. Review it,
-- run it on a staging copy, then run it in the Supabase SQL editor.
--
-- Target shape (run those scripts first on a brand-new project):
--   supabase-setup.sql
--   supabase-circuit-maze.sql
--   supabase-game-runner.sql
--   supabase-windows-sim.sql
--
-- This file is additive and idempotent. It does not edit those scripts.
-- Re-running it drops and recreates only the policies it owns.
--
-- Column names follow the repo: quizzes.lecturer_id, not created_by.
-- If a live database still uses the older created_by shape, stop and do not
-- run this file until the columns are confirmed.
--
-- Screens named below are the ones that call the table or function.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- is_lecturer() is SECURITY DEFINER so policies can read profiles.role without
-- recursing through the profiles RLS policies. The app decides the role from
-- profiles.role (App.js, ProfileScreen), not from a JWT claim.

CREATE OR REPLACE FUNCTION public.is_lecturer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'lecturer'
  );
$$;

REVOKE ALL ON FUNCTION public.is_lecturer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lecturer() TO authenticated;

-- -----------------------------------------------------------------------------
-- (a) get_students_with_emails() is lecturer-only
-- -----------------------------------------------------------------------------
-- The function is SECURITY DEFINER, so a grant to anon would let anyone with
-- the anon key list every student's email. The check is inside the function,
-- so ClassManagementScreen (getStudents) and StudentProgressScreen
-- (getStudents, addStudent) keep working for a signed-in lecturer.
-- A student or anon caller gets an error. Those screens are lecturer-only.

CREATE OR REPLACE FUNCTION public.get_students_with_emails()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email VARCHAR(255),
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_lecturer() THEN
    RAISE EXCEPTION 'Only lecturers can list students';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    u.email::VARCHAR(255),
    p.role,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.role = 'student'
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_students_with_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_students_with_emails() TO authenticated;

-- -----------------------------------------------------------------------------
-- (f) Signups stay students. Clients cannot promote themselves.
-- -----------------------------------------------------------------------------
-- SignUpScreen no longer sends a role. This function also ignores
-- raw_user_meta_data.role and the old lecturer@compuclass.com shortcut.
-- Promote a lecturer in the SQL editor (runs as postgres):
--   UPDATE public.profiles SET role = 'lecturer' WHERE id = '<uuid>';
-- App.js reads profiles.role after login, so a promoted lecturer sees the
-- lecturer UI on the next sign-in. No screen calls this function directly.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END $$;

-- Block UPDATE profiles SET role from the Data API. postgres and service_role
-- (SQL editor, backend) can still promote someone. ProfileScreen updates
-- full_name only, so that screen is unchanged.

CREATE OR REPLACE FUNCTION public.prevent_client_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'profiles.role cannot be changed from the client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_client_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_profile_role_change();

-- The access-token hook must not overwrite the reserved `role` claim.
-- Writing profiles.role into `role` makes PostgREST stop treating the user
-- as `authenticated`. The app never reads that claim; it reads profiles.role.
-- Expected change: none, until the hook is enabled in Authentication > Hooks.
-- When it is enabled, the claim is `user_role` and RLS policies that say
-- TO authenticated keep matching.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := COALESCE(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'student')));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin, service_role;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (e) quiz_questions.correct_answer
-- -----------------------------------------------------------------------------
-- Drop the public SELECT policy. The remaining "Lecturers can manage quiz
-- questions" FOR ALL policy still lets the owning lecturer read every column,
-- so QuizDetailScreen and lecturerService.getQuizDetail keep working for the
-- lecturer who created the quiz.
--
-- Students no longer receive question rows from the Data API. QuizScreen does
-- not need them: it calls get_quiz_questions_for_attempt and submit_quiz_attempt,
-- which are SECURITY DEFINER and omit the answer until the attempt is graded.
--
-- StudentMaterialsScreen and SearchScreen show a question count. They call
-- quiz_question_counts (below) and fall back to an id-only embed if this
-- function is not deployed yet. After this migration the count still works
-- and correct_answer is not in that response.
--
-- A column-level REVOKE would also hide correct_answer from lecturers, because
-- lecturers and students share the `authenticated` role. That version is in
-- the optional block at the bottom and is NOT applied here.

DROP POLICY IF EXISTS "Everyone can view quiz questions" ON public.quiz_questions;

CREATE OR REPLACE FUNCTION public.quiz_question_counts(p_quiz_ids uuid[])
RETURNS TABLE (quiz_id uuid, question_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, COALESCE(c.n, 0)::integer
  FROM public.quizzes q
  LEFT JOIN (
    SELECT qq.quiz_id, count(*)::integer AS n
    FROM public.quiz_questions qq
    WHERE qq.quiz_id = ANY (p_quiz_ids)
    GROUP BY qq.quiz_id
  ) c ON c.quiz_id = q.id
  WHERE auth.uid() IS NOT NULL
    AND q.id = ANY (p_quiz_ids);
$$;

REVOKE ALL ON FUNCTION public.quiz_question_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_question_counts(uuid[]) TO authenticated;

-- Students can no longer insert a quiz_attempts row with a score they chose.
-- QuizScreen grades through submit_quiz_attempt, which runs as the function
-- owner and still inserts the row. DashboardScreen and lecturerService only
-- SELECT attempts. offlineService, which inserted scores from the client, is
-- removed from the app.

DROP POLICY IF EXISTS "Students can insert own attempts" ON public.quiz_attempts;
REVOKE INSERT ON TABLE public.quiz_attempts FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- (c) Folders, documents, storage, announcements
-- -----------------------------------------------------------------------------
-- Folders and documents are not tied to a class. StudentMaterialsScreen and
-- SearchScreen list every folder and document for the signed-in user.
-- Replacing USING (true) with TO authenticated keeps those screens working
-- and stops the anon key from listing them. Restricting folders to a class
-- enrolment would make StudentMaterialsScreen empty, because folders have
-- only lecturer_id. That tighter rule is not applied.

DROP POLICY IF EXISTS "Students can view folders" ON public.folders;
CREATE POLICY "Signed-in users can view folders"
  ON public.folders
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Everyone can view documents" ON public.documents;
CREATE POLICY "Signed-in users can view documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Quizzes had the same public SELECT. SearchScreen and StudentMaterialsScreen
-- list quizzes for a signed-in user. Anon can no longer list them.
DROP POLICY IF EXISTS "Everyone can view quizzes" ON public.quizzes;
CREATE POLICY "Signed-in users can view quizzes"
  ON public.quizzes
  FOR SELECT
  TO authenticated
  USING (true);

-- Storage. The documents bucket becomes private, 20 MB, with the MIME types
-- ContentUploadScreen and fileAccess.js already allow. Avatar uploads from
-- ProfileScreen use image/jpeg and stay inside that list.
--
-- SELECT stays open to every signed-in user so createSignedUrl works for
-- StudentMaterialsScreen, SearchScreen, and ContentUploadScreen. Those
-- screens sign the path (or an older public URL) before opening it. A public
-- URL copied before this migration stops working. The app falls back to that
-- URL only when signing fails, which is the pre-migration case.
--
-- Any signed-in user can still list object names in this bucket. Closing that
-- would require per-class paths the app does not have, and would break
-- student downloads. Not applied.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users can read document files" ON storage.objects;
CREATE POLICY "Signed-in users can read document files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Announcements are not in the schema scripts. DashboardScreen reads the
-- latest rows. LecturerDashboardScreen inserts title and body.
-- This creates the table when it is missing, then replaces every policy so a
-- hand-made USING (true) policy cannot remain beside the new ones.
-- Expected change: anon cannot read or post. A signed-in student still sees
-- announcements on the dashboard. Only a lecturer can insert. The lecturer
-- screen does not edit or delete announcements, so those commands are not granted.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'announcements'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.announcements', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Signed-in users can read announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Lecturers can post announcements"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_lecturer());

REVOKE ALL ON TABLE public.announcements FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.announcements TO authenticated;

-- -----------------------------------------------------------------------------
-- (b) Maze session leaderboard policy
-- -----------------------------------------------------------------------------
-- "Leaderboard read maze sessions" is USING (true), so anyone who can read
-- the table sees every user's maze session. LeaderboardScreen does not read
-- this table. It calls get_leaderboard. CircuitMazeScreen records a session
-- through circuitMazeService.awardXp, which inserts the signed-in user's row.
-- Dropping the public policy leaves "Users manage own maze sessions", so
-- that insert and a user's own history still work. No screen lists other
-- people's maze sessions.

DO $$
BEGIN
  IF to_regclass('public.circuit_maze_sessions') IS NULL THEN
    RAISE NOTICE 'circuit_maze_sessions is missing; skip maze session policy';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.circuit_maze_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Leaderboard read maze sessions" ON public.circuit_maze_sessions';
END $$;

-- -----------------------------------------------------------------------------
-- (d) Multiplayer room codes
-- -----------------------------------------------------------------------------
-- circuitMazeService.joinRoom and gameRunnerService.joinRoom used to
-- SELECT every waiting room. The policies below hide a room unless the
-- caller is the host or already a player. Joining uses
-- join_circuit_maze_room / join_game_runner_room, which return one waiting
-- room for a code the player typed. Guessing a code still joins that room.
-- Listing every code does not.
--
-- CircuitMazeLobbyScreen and GameRunnerLobbyScreen call those services.
-- Realtime updates still arrive after the player is a member, because the
-- SELECT policy includes members. Host insert and host update policies from
-- the schema scripts are left in place.

CREATE OR REPLACE FUNCTION public.is_circuit_maze_member(p_room uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.circuit_maze_rooms') IS NULL THEN
    RETURN false;
  END IF;
  RETURN auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.circuit_maze_rooms r
      WHERE r.id = p_room AND r.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.circuit_maze_players p
      WHERE p.room_id = p_room AND p.user_id = auth.uid()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_game_runner_member(p_room uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.game_runner_rooms') IS NULL THEN
    RETURN false;
  END IF;
  RETURN auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.game_runner_rooms r
      WHERE r.id = p_room AND r.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.game_runner_players p
      WHERE p.room_id = p_room AND p.user_id = auth.uid()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_circuit_maze_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_game_runner_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circuit_maze_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_game_runner_member(uuid) TO authenticated;

-- Created only when the room table exists, so a database that has not run
-- supabase-circuit-maze.sql or supabase-game-runner.sql still applies the
-- rest of this script. The app falls back to a direct lookup until the
-- function is present.
DO $$
BEGIN
  IF to_regclass('public.circuit_maze_rooms') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.join_circuit_maze_room(p_code text)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_room public.circuit_maze_rooms;
      BEGIN
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;
        SELECT * INTO v_room
        FROM public.circuit_maze_rooms
        WHERE code = upper(trim(p_code))
          AND status = 'waiting';
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Room not found or already started';
        END IF;
        RETURN to_jsonb(v_room);
      END;
      $body$
    $fn$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.join_circuit_maze_room(text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.join_circuit_maze_room(text) TO authenticated';
  END IF;

  IF to_regclass('public.game_runner_rooms') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.join_game_runner_room(p_code text)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_room public.game_runner_rooms;
      BEGIN
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;
        SELECT * INTO v_room
        FROM public.game_runner_rooms
        WHERE code = upper(trim(p_code))
          AND status = 'waiting';
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Room not found or already started';
        END IF;
        RETURN to_jsonb(v_room);
      END;
      $body$
    $fn$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.join_game_runner_room(text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.join_game_runner_room(text) TO authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.circuit_maze_rooms') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.circuit_maze_rooms ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone authenticated can read rooms" ON public.circuit_maze_rooms';
    EXECUTE 'DROP POLICY IF EXISTS "Members can read maze rooms" ON public.circuit_maze_rooms';
    EXECUTE $pol$
      CREATE POLICY "Members can read maze rooms"
        ON public.circuit_maze_rooms
        FOR SELECT
        TO authenticated
        USING (public.is_circuit_maze_member(id))
    $pol$;
  END IF;

  IF to_regclass('public.circuit_maze_players') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.circuit_maze_players ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Players can read room players" ON public.circuit_maze_players';
    EXECUTE 'DROP POLICY IF EXISTS "Members can read maze players" ON public.circuit_maze_players';
    EXECUTE $pol$
      CREATE POLICY "Members can read maze players"
        ON public.circuit_maze_players
        FOR SELECT
        TO authenticated
        USING (public.is_circuit_maze_member(room_id))
    $pol$;
  END IF;

  IF to_regclass('public.game_runner_rooms') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.game_runner_rooms ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone authenticated can read runner rooms" ON public.game_runner_rooms';
    EXECUTE 'DROP POLICY IF EXISTS "Members can read runner rooms" ON public.game_runner_rooms';
    EXECUTE $pol$
      CREATE POLICY "Members can read runner rooms"
        ON public.game_runner_rooms
        FOR SELECT
        TO authenticated
        USING (public.is_game_runner_member(id))
    $pol$;
  END IF;

  IF to_regclass('public.game_runner_players') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.game_runner_players ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Players can read runner room players" ON public.game_runner_players';
    EXECUTE 'DROP POLICY IF EXISTS "Members can read runner players" ON public.game_runner_players';
    EXECUTE $pol$
      CREATE POLICY "Members can read runner players"
        ON public.game_runner_players
        FOR SELECT
        TO authenticated
        USING (public.is_game_runner_member(room_id))
    $pol$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- game_scores
-- -----------------------------------------------------------------------------
-- GameScreen reads a top-five list and upserts the signed-in user's best score.
-- The table is not in the schema scripts. Creating it here is safe when it is
-- missing. If it already exists, the existing columns are left alone.
--
-- get_runner_leaderboard returns names without opening every profiles row to
-- students (students can otherwise read only their own profile). GameScreen
-- calls this function and falls back to the table select before it exists.
-- After this migration the fallback would only show the caller's own row.

CREATE TABLE IF NOT EXISTS public.game_scores (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own runner score" ON public.game_scores;
DROP POLICY IF EXISTS "Users insert own runner score" ON public.game_scores;
DROP POLICY IF EXISTS "Users update own runner score" ON public.game_scores;

CREATE POLICY "Users read own runner score"
  ON public.game_scores
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own runner score"
  ON public.game_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own runner score"
  ON public.game_scores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.game_scores FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_scores TO authenticated;

CREATE OR REPLACE FUNCTION public.get_runner_leaderboard()
RETURNS TABLE (full_name text, score integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, g.score
  FROM public.game_scores g
  JOIN public.profiles p ON p.id = g.user_id
  WHERE auth.uid() IS NOT NULL
  ORDER BY g.score DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_runner_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_runner_leaderboard() TO authenticated;

-- -----------------------------------------------------------------------------
-- Windows 11 simulator sessions
-- -----------------------------------------------------------------------------
-- Windows11SimulatorScreen reads and writes only the signed-in user's row.
-- This repeats the policy from supabase-windows-sim.sql so a live table that
-- was created without RLS still gets it. Behaviour of that screen does not change.

CREATE TABLE IF NOT EXISTS public.windows_simulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_start timestamptz NOT NULL DEFAULT now(),
  session_end timestamptz,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.windows_simulation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own simulator sessions" ON public.windows_simulation_sessions;
CREATE POLICY "Users manage own simulator sessions"
  ON public.windows_simulation_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.windows_simulation_sessions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.windows_simulation_sessions TO authenticated;

-- -----------------------------------------------------------------------------
-- (g) Blanket GRANT ALL to anon / authenticated
-- -----------------------------------------------------------------------------
-- supabase-setup.sql grants ALL on every public table, sequence, and function
-- to anon and authenticated. This does not revoke table DML from authenticated:
-- the app's screens use the Data API as that role, and RLS is what limits rows.
-- A missed table would break a screen if authenticated lost every grant.
--
-- anon loses table DML, sequence usage, and function execute. TRUNCATE is
-- revoked from both anon and authenticated because TRUNCATE ignores RLS.
-- Dangerous functions are revoked by name above and below.
--
-- Gradebook and quiz RPCs that already check the caller (submit_quiz_attempt,
-- get_quiz_questions_for_attempt, get_my_stats, get_my_badges, get_leaderboard,
-- set_question_gamification_settings, award_maze_xp) stay executable by
-- authenticated. Their anon execute grant is removed by the revoke below.
-- QuizScreen, LeaderboardScreen, and ProfileScreen call those functions.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'gamification') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA gamification FROM anon';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gamification FROM anon';
    EXECUTE 'REVOKE TRUNCATE ON ALL TABLES IN SCHEMA gamification FROM anon, authenticated';
  END IF;
END $$;

-- Signup triggers must not be callable from the Data API.
DO $$
BEGIN
  IF to_regprocedure('gamification.handle_new_profile()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION gamification.handle_new_profile() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- Fixed search_path on helpers the client can execute. No behaviour change.
ALTER FUNCTION public.xp_to_level(integer) SET search_path = public;

-- anon must not execute the quiz and profile RPCs. Authenticated keeps them.
REVOKE ALL ON FUNCTION public.xp_to_level(integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_my_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_badges() FROM anon;
REVOKE ALL ON FUNCTION public.get_leaderboard(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_quiz_questions_for_attempt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_question_gamification_settings(uuid, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) FROM anon;

DO $$
BEGIN
  IF to_regprocedure('public.award_maze_xp(integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.award_maze_xp(integer) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.award_maze_xp(integer) TO authenticated';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- OPTIONAL BLOCKS — not executed
-- =============================================================================
-- Uncomment one block only after reading the screen note above it.
-- Each block is independent. Do not uncomment both at once without re-testing
-- the lecturer quiz screen.

-- -----------------------------------------------------------------------------
-- OPTIONAL (e): hide quiz_questions.correct_answer from every authenticated
-- user, including lecturers.
--
-- DO NOT APPLY if QuizDetailScreen or lecturerService.getQuizDetail must keep
-- showing the ticked correct option. Both select * from quiz_questions.
-- lecturerService.createQuiz also inserts correct_answer; INSERT of that
-- column still works, but a follow-up SELECT * fails once the column is revoked.
-- StudentMaterialsScreen and SearchScreen would keep working through
-- quiz_question_counts. QuizScreen would keep working through the RPCs.
--
-- REVOKE SELECT (correct_answer) ON TABLE public.quiz_questions FROM anon, authenticated;
-- GRANT SELECT (id, quiz_id, question, options, order_index, created_at)
--   ON TABLE public.quiz_questions TO authenticated;

-- -----------------------------------------------------------------------------
-- OPTIONAL: cap award_maze_xp (20 second cooldown, 2000 XP per day).
--
-- DO NOT APPLY with the current Circuit Maze screen. CircuitMazeScreen calls
-- circuitMazeService.awardXp on every correct answer and again for the finish
-- bonus. A 20 second cooldown would drop XP the maze already added to its
-- on-screen total. Apply this only after the maze sends one award at the end
-- of a level.
--
-- The function below replaces public.award_maze_xp(integer). It needs
-- gamification.user_stats, which supabase-setup.sql creates.
--
-- CREATE TABLE IF NOT EXISTS public.maze_xp_awards (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--   xp integer NOT NULL,
--   awarded_at timestamptz NOT NULL DEFAULT now()
-- );
-- ALTER TABLE public.maze_xp_awards ENABLE ROW LEVEL SECURITY;
-- -- No policies: only the security definer function writes this log.
--
-- CREATE OR REPLACE FUNCTION public.award_maze_xp(p_xp integer)
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public, gamification
-- AS $fn$
-- DECLARE
--   v_user_id uuid := auth.uid();
--   v_last timestamptz;
--   v_today integer;
--   v_grant integer;
-- BEGIN
--   IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
--   IF p_xp IS NULL OR p_xp <= 0 THEN
--     RETURN jsonb_build_object('xp_awarded', 0);
--   END IF;
--
--   SELECT max(awarded_at) INTO v_last
--   FROM public.maze_xp_awards
--   WHERE user_id = v_user_id;
--   IF v_last IS NOT NULL AND v_last > now() - interval '20 seconds' THEN
--     RAISE EXCEPTION 'Maze XP is cooling down';
--   END IF;
--
--   SELECT COALESCE(sum(xp), 0) INTO v_today
--   FROM public.maze_xp_awards
--   WHERE user_id = v_user_id
--     AND awarded_at >= date_trunc('day', now());
--   v_grant := LEAST(p_xp, GREATEST(0, 2000 - v_today));
--   IF v_grant <= 0 THEN
--     RETURN jsonb_build_object('xp_awarded', 0, 'daily_cap', 2000);
--   END IF;
--
--   INSERT INTO public.maze_xp_awards (user_id, xp) VALUES (v_user_id, v_grant);
--   -- The rest of the body matches award_maze_xp in supabase-circuit-maze.sql,
--   -- using v_grant instead of p_xp.
--   RETURN jsonb_build_object('xp_awarded', v_grant);
-- END;
-- $fn$;
