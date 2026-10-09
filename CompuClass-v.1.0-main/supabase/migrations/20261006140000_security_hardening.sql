-- =============================================================================
-- Security hardening
-- =============================================================================
-- NOT APPLIED. Do not run this against a database from this commit until the
-- preflight result below has been read. A failure inside BEGIN/COMMIT aborts
-- the transaction: PostgreSQL keeps none of the changes.
--
-- Run the preflight SELECT block on its own first. It only reads catalogs.
-- Then run this whole file. Do not wrap the file in another transaction,
-- because the COMMIT below ends the migration transaction.
--
-- Confirmed from the live project (read-only) and from the repo SQL:
--   * public.quizzes owner column is created_by on the live project.
--     supabase-setup.sql creates lecturer_id instead. This script accepts
--     exactly one of those two names and uses that name in every quiz owner
--     policy and function it writes.
--   * public.classes, public.documents, and public.folders use lecturer_id
--     in both the live project and the repo. This script requires that
--     column before it touches those policies.
--   * quizzes, classes, folders, documents, and announcements have no
--     class_id on the live project. This script does not read or write
--     class_id on those tables. Student materials stay a signed-in list,
--     which is what StudentMaterialsScreen and SearchScreen already do.
--   * announcements is not created by any schema file in the repo. The app
--     reads id, title, body, and created_at (DashboardScreen) and inserts
--     title and body (LecturerDashboardScreen). Any other column is unknown.
--     The live table has none of lecturer_id, created_by, or class_id.
--
-- Not modified, because this script does not know the live rows are the same
-- shape as the repo and it does not need them to lock the policies below:
--   * public.quiz_assignments (repo: id, quiz_id, class_id, assigned_at)
--   * public.class_students (repo: id, class_id, student_id, joined_at)
--   * bodies of submit_quiz_attempt and get_quiz_questions_for_attempt
--     (live copies may already use created_by; replacing them from the repo
--     would point them at lecturer_id)
--
-- Screens named under each section are the ones that call the table or function.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Preflight (read-only). Run this block by itself first.
-- -----------------------------------------------------------------------------
-- Empty result sets are information, not errors. Compare them with the notes
-- above before running the transaction.

SELECT table_name, column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'quizzes', 'quiz_questions', 'quiz_attempts',
    'folders', 'documents', 'classes', 'announcements',
    'quiz_assignments', 'class_students', 'game_scores',
    'circuit_maze_sessions', 'circuit_maze_rooms', 'circuit_maze_players',
    'game_runner_rooms', 'game_runner_players',
    'windows_simulation_sessions'
  )
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_on,
       pol.polname AS policy_name,
       pol.polcmd AS command,
       pol.polpermissive AS permissive,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr,
       pol.polroles AS role_oids
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'folders', 'documents', 'quizzes', 'quiz_questions', 'quiz_attempts',
    'announcements', 'game_scores', 'circuit_maze_sessions',
    'circuit_maze_rooms', 'circuit_maze_players',
    'game_runner_rooms', 'game_runner_players',
    'windows_simulation_sessions'
  )
ORDER BY c.relname, pol.polname;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname, p.proname) IN (
  ('public', 'get_students_with_emails'),
  ('public', 'handle_new_user'),
  ('public', 'custom_access_token_hook'),
  ('public', 'xp_to_level'),
  ('public', 'get_my_stats'),
  ('public', 'get_my_badges'),
  ('public', 'get_leaderboard'),
  ('public', 'get_quiz_questions_for_attempt'),
  ('public', 'set_question_gamification_settings'),
  ('public', 'submit_quiz_attempt'),
  ('public', 'award_maze_xp'),
  ('public', 'is_lecturer'),
  ('gamification', 'handle_new_profile')
)
ORDER BY 1, 2, 3;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'storage' AND table_name = 'buckets'
ORDER BY ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relname IN ('buckets', 'objects');


BEGIN;

-- -----------------------------------------------------------------------------
-- Helpers used only for the rest of this transaction
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.expr_mentions(p_expr text, p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_expr, '') ~* ('(^|[^a-z0-9_])' || p_name || '([^a-z0-9_]|$)');
$$;

CREATE OR REPLACE FUNCTION pg_temp.norm_expr(p_expr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(COALESCE(p_expr, '')), '[[:space:]]', '', 'g');
$$;

-- Public read policies this script is allowed to replace. Anything else is
-- left alone and the transaction stops, so a stricter rule is not widened.
CREATE OR REPLACE FUNCTION pg_temp.expr_is_open(p_expr text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_temp.norm_expr(p_expr) IN (
    'true', '(true)', '((true))',
    'auth.uid()isnotnull', '(auth.uid()isnotnull)', '((auth.uid()isnotnull))'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.expr_is_own_row(p_expr text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_temp.norm_expr(p_expr) ~ '^(\()+auth\.uid\(\)(::uuid)?=user_id(\))+$'
      OR pg_temp.norm_expr(p_expr) ~ '^(\()+user_id=auth\.uid\(\)(::uuid)?(\))+$';
$$;

CREATE OR REPLACE FUNCTION pg_temp.require_uuid(p_table text, p_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_type text;
BEGIN
  PERFORM pg_temp.require_column(p_table, p_column);
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column;
  IF v_type <> 'uuid' THEN
    RAISE EXCEPTION 'public.%.% is %, not uuid. Refusing to compare it with auth.uid().', p_table, p_column, v_type;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.require_column(p_table text, p_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RAISE EXCEPTION 'public.% does not exist. This migration stops so later statements cannot run against a different schema.', p_table;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    RAISE EXCEPTION 'public.% is missing column %. Actual columns are in the preflight result. This migration stops.', p_table, p_column;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Column and function assumptions. A failure here rolls back this transaction,
-- including the helper functions created above.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_owner_count integer;
  v_owner text;
BEGIN
  PERFORM pg_temp.require_column('profiles', 'id');
  PERFORM pg_temp.require_column('profiles', 'full_name');
  PERFORM pg_temp.require_column('profiles', 'role');
  PERFORM pg_temp.require_column('profiles', 'created_at');

  PERFORM pg_temp.require_column('folders', 'lecturer_id');
  PERFORM pg_temp.require_column('documents', 'lecturer_id');
  PERFORM pg_temp.require_column('quizzes', 'id');
  PERFORM pg_temp.require_column('quiz_questions', 'id');
  PERFORM pg_temp.require_column('quiz_questions', 'quiz_id');
  PERFORM pg_temp.require_column('quiz_questions', 'correct_answer');
  PERFORM pg_temp.require_column('quiz_attempts', 'user_id');
  PERFORM pg_temp.require_column('quiz_attempts', 'quiz_id');
  PERFORM pg_temp.require_column('quiz_attempts', 'score');

  -- classes is not modified. Require lecturer_id only when the table exists,
  -- so a live table that drifted away from lecturer_id cannot be mistaken
  -- for the repo shape later. A missing classes table is left alone:
  -- no statement in this file reads it.
  IF to_regclass('public.classes') IS NOT NULL THEN
    PERFORM pg_temp.require_column('classes', 'lecturer_id');
  END IF;

  SELECT count(*) INTO v_owner_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'quizzes'
    AND column_name IN ('created_by', 'lecturer_id');

  IF v_owner_count = 0 THEN
    RAISE EXCEPTION 'public.quizzes has neither created_by nor lecturer_id. Refusing to build an owner policy.';
  ELSIF v_owner_count > 1 THEN
    RAISE EXCEPTION 'public.quizzes has both created_by and lecturer_id. Refusing to guess which one owns the quiz.';
  END IF;

  SELECT column_name INTO v_owner
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'quizzes'
    AND column_name IN ('created_by', 'lecturer_id');

  PERFORM pg_temp.require_uuid('profiles', 'id');
  PERFORM pg_temp.require_uuid('folders', 'lecturer_id');
  PERFORM pg_temp.require_uuid('documents', 'lecturer_id');
  PERFORM pg_temp.require_uuid('quizzes', v_owner);
  PERFORM pg_temp.require_uuid('quiz_attempts', 'user_id');
  IF to_regclass('public.classes') IS NOT NULL THEN
    PERFORM pg_temp.require_uuid('classes', 'lecturer_id');
  END IF;

  CREATE TEMP TABLE sec_facts (k text PRIMARY KEY, v text) ON COMMIT DROP;
  INSERT INTO sec_facts (k, v) VALUES ('quiz_owner', v_owner);

  -- Students lose direct selects on quiz_questions below. These two functions
  -- are how QuizScreen loads and grades a quiz. Do not replace their bodies:
  -- the live copies are not in git and may already use created_by.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_quiz_questions_for_attempt'
  ) THEN
    RAISE EXCEPTION 'public.get_quiz_questions_for_attempt is missing. Refusing to remove direct reads of quiz_questions.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_quiz_attempt'
  ) THEN
    RAISE EXCEPTION 'public.submit_quiz_attempt is missing. Refusing to remove client inserts into quiz_attempts.';
  END IF;

  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users is missing. This script is for a Supabase project.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- is_lecturer()
-- -----------------------------------------------------------------------------
-- Policies and get_students_with_emails call this. The app reads profiles.role
-- in App.js and ProfileScreen, not a JWT claim. SECURITY DEFINER avoids
-- recursing through the profiles RLS policy.

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
-- The function is SECURITY DEFINER. A grant to anon would list every student
-- email. The role check is inside the function, so a signed-in lecturer still
-- gets rows. ClassManagementScreen and StudentProgressScreen call it through
-- lecturerService.getStudents and addStudent. A student or anon caller gets
-- an error. Those screens are lecturer-only.
--
-- Drop first so a live copy with a different return type can be replaced.
-- The return columns are the ones those screens read: id, full_name, email,
-- role, created_at.

DO $$
DECLARE
  r regprocedure;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_students_with_emails'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r);
  END LOOP;
END $$;

CREATE FUNCTION public.get_students_with_emails()
RETURNS TABLE (
  id uuid,
  full_name text,
  email character varying(255),
  role text,
  created_at timestamp with time zone
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
    u.email::character varying(255),
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
-- Promote a lecturer in the SQL editor, which runs as postgres:
--   UPDATE public.profiles SET role = 'lecturer' WHERE id = '<uuid>';
-- App.js reads profiles.role after login. No screen calls this function.
-- The existing on_auth_user_created trigger keeps calling it. A missing
-- trigger is created. Any other trigger on auth.users is left in place.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'handle_new_user'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Block UPDATE profiles SET role from the Data API. postgres and service_role
-- can still promote someone. ProfileScreen updates full_name only.

CREATE OR REPLACE FUNCTION public.prevent_client_profile_role_change()
RETURNS trigger
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

-- The access-token hook must not overwrite the reserved role claim.
-- Writing profiles.role into role makes PostgREST stop treating the user as
-- authenticated. The app never reads that claim. Expected change: none, until
-- the hook is enabled under Authentication > Hooks. The claim written here
-- is user_role.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'custom_access_token_hook'
  ) AND to_regprocedure('public.custom_access_token_hook(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'public.custom_access_token_hook exists with an unexpected signature. Refusing to replace it.';
  END IF;
END $$;

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
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (e) quiz_questions.correct_answer
-- -----------------------------------------------------------------------------
-- Drop public SELECT policies whose expression is true. The owning lecturer
-- still reads every column through the existing FOR ALL policy, so
-- QuizDetailScreen and lecturerService.getQuizDetail keep working for the
-- lecturer who owns the quiz.
--
-- The owner column inside that policy is created_by on the live project and
-- lecturer_id in supabase-setup.sql. If no policy names the detected column,
-- one is created. A policy this script does not recognise stops the run
-- instead of being dropped or widened.
--
-- Students no longer receive question rows from the Data API. QuizScreen calls
-- get_quiz_questions_for_attempt and submit_quiz_attempt, which omit the
-- answer until the attempt is graded.
--
-- StudentMaterialsScreen and SearchScreen show a question count. They call
-- quiz_question_counts and fall back to an id-only embed if this function is
-- not deployed yet.

DO $$
DECLARE
  v_owner text;
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_has_owner boolean := false;
  v_name text;
BEGIN
  SELECT v INTO v_owner FROM sec_facts WHERE k = 'quiz_owner';

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quiz_questions'
  LOOP
    IF pg_temp.expr_mentions(r.qual, v_owner) OR pg_temp.expr_mentions(r.chk, v_owner)
       OR pg_temp.expr_mentions(r.qual, 'is_lecturer') OR pg_temp.expr_mentions(r.chk, 'is_lecturer') THEN
      v_has_owner := v_has_owner
        OR pg_temp.expr_mentions(r.qual, v_owner)
        OR pg_temp.expr_mentions(r.chk, v_owner);
      CONTINUE;
    END IF;

    IF r.polcmd = 'r'
       AND pg_temp.expr_is_open(r.qual)
       AND (r.chk IS NULL OR pg_temp.expr_is_open(r.chk)) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'public.quiz_questions policy % is not an owner policy and is not USING (true). Expression: %. Refusing to drop or widen it.',
      r.polname, COALESCE(r.qual, r.chk, '(none)');
  END LOOP;

  IF NOT v_has_owner THEN
    EXECUTE format($pol$
      CREATE POLICY "Lecturers can manage quiz questions"
        ON public.quiz_questions
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id
              AND q.%I = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id
              AND q.%I = auth.uid()
          )
        )
    $pol$, v_owner, v_owner);
  END IF;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.quiz_questions', v_name);
  END LOOP;

  ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
END $$;

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
-- Every INSERT policy is removed. A FOR ALL policy would also grant insert,
-- and this script does not know how to split one, so it stops instead.
-- submit_quiz_attempt runs as its owner and still inserts the row.
-- DashboardScreen and lecturerService only SELECT attempts.

DO $$
DECLARE
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_name text;
BEGIN
  FOR r IN
    SELECT pol.polname, pol.polcmd
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quiz_attempts'
  LOOP
    IF r.polcmd = 'a' THEN
      v_drop := v_drop || r.polname;
    ELSIF r.polcmd = '*' THEN
      RAISE EXCEPTION
        'public.quiz_attempts policy % is FOR ALL. Refusing to drop it, because that would also remove SELECT.',
        r.polname;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.quiz_attempts', v_name);
  END LOOP;

  ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
END $$;

REVOKE INSERT ON TABLE public.quiz_attempts FROM PUBLIC, anon, authenticated;

-- set_question_gamification_settings is called by lecturerService.createQuiz.
-- The repo body reads quizzes.lecturer_id. On the live project that column
-- does not exist, so a function still compiled against lecturer_id fails when
-- a lecturer saves a timer. Rewrite it only in that case, using whichever
-- owner column sec_facts recorded. A body that already uses the live column
-- is not replaced.

DO $$
DECLARE
  v_owner text;
  v_wrong text;
  v_src text;
  v_count integer;
BEGIN
  SELECT v INTO v_owner FROM sec_facts WHERE k = 'quiz_owner';
  v_wrong := CASE v_owner WHEN 'created_by' THEN 'lecturer_id' ELSE 'created_by' END;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_question_gamification_settings';

  IF v_count > 1 THEN
    RAISE EXCEPTION 'More than one public.set_question_gamification_settings exists. Refusing to rewrite it.';
  END IF;

  SELECT p.prosrc INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_question_gamification_settings';

  -- Rewrite only when the body names the missing owner column on quizzes.
  -- A function that already uses the live column is left as it is.
  IF v_src IS NOT NULL
     AND v_src NOT ILIKE '%qz.' || v_wrong || '%'
     AND v_src NOT ILIKE '%quizzes.' || v_wrong || '%' THEN
    RETURN;
  END IF;

  IF to_regclass('gamification.quiz_question_settings') IS NULL THEN
    IF v_src IS NULL THEN
      RAISE NOTICE 'gamification.quiz_question_settings is absent; quiz timer settings are unchanged';
      RETURN;
    END IF;
    RAISE EXCEPTION 'set_question_gamification_settings references % but gamification.quiz_question_settings is missing. Refusing to rewrite it.', v_wrong;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'gamification'
      AND table_name = 'quiz_question_settings'
      AND column_name = 'question_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'gamification'
      AND table_name = 'quiz_question_settings'
      AND column_name = 'time_limit_seconds'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'gamification'
      AND table_name = 'quiz_question_settings'
      AND column_name = 'difficulty'
  ) THEN
    RAISE EXCEPTION 'gamification.quiz_question_settings is missing question_id, time_limit_seconds, or difficulty. Refusing to rewrite set_question_gamification_settings.';
  END IF;

  EXECUTE format($fmt$
    CREATE OR REPLACE FUNCTION public.set_question_gamification_settings(
      p_question_id uuid,
      p_time_limit_seconds integer,
      p_difficulty text
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO public, gamification
    AS $function$
    DECLARE
      v_owner uuid;
    BEGIN
      SELECT qz.%1$I INTO v_owner
      FROM public.quiz_questions qq
      JOIN public.quizzes qz ON qz.id = qq.quiz_id
      WHERE qq.id = p_question_id;

      IF v_owner IS NULL OR v_owner <> auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to edit this question';
      END IF;

      INSERT INTO gamification.quiz_question_settings (question_id, time_limit_seconds, difficulty)
      VALUES (p_question_id, p_time_limit_seconds, COALESCE(p_difficulty, 'medium'))
      ON CONFLICT (question_id) DO UPDATE
        SET time_limit_seconds = EXCLUDED.time_limit_seconds,
            difficulty = EXCLUDED.difficulty;
    END;
    $function$
  $fmt$, v_owner);
END $$;

-- -----------------------------------------------------------------------------
-- (c) Folders, documents, quizzes
-- -----------------------------------------------------------------------------
-- These tables are not tied to a class. StudentMaterialsScreen and
-- SearchScreen list every folder, document, and quiz for the signed-in user.
-- A public USING (true) SELECT is replaced with the same read limited to
-- authenticated. Anon stops seeing them. Signed-in students still do.
--
-- The lecturer FOR ALL policy is kept. It uses lecturer_id on folders and
-- documents. On quizzes it uses the detected owner column. If that owner
-- policy is missing, one is created so ContentUploadScreen and quiz editing
-- still work. Any other policy stops the run.
--
-- If there is no public USING (true) policy, no signed-in read-all policy is
-- added. Adding one would widen a table that is already private.

DO $$
DECLARE
  v_quiz_owner text;
  v_table text;
  v_owner_column text;
  v_new_policy text;
  r record;
  v_drop text[];
  v_has_owner boolean;
  v_open integer;
  v_name text;
BEGIN
  SELECT v INTO v_quiz_owner FROM sec_facts WHERE k = 'quiz_owner';

  FOREACH v_table IN ARRAY ARRAY['folders', 'documents', 'quizzes'] LOOP
    v_owner_column := CASE WHEN v_table = 'quizzes' THEN v_quiz_owner ELSE 'lecturer_id' END;
    v_new_policy := CASE v_table
      WHEN 'folders' THEN 'Signed-in users can view folders'
      WHEN 'documents' THEN 'Signed-in users can view documents'
      ELSE 'Signed-in users can view quizzes'
    END;
    v_drop := ARRAY[]::text[];
    v_has_owner := false;
    v_open := 0;

    FOR r IN
      SELECT pol.polname, pol.polcmd,
             pg_get_expr(pol.polqual, pol.polrelid) AS qual,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table
    LOOP
      IF pg_temp.expr_mentions(r.qual, v_owner_column) OR pg_temp.expr_mentions(r.chk, v_owner_column)
         OR pg_temp.expr_mentions(r.qual, 'is_lecturer') OR pg_temp.expr_mentions(r.chk, 'is_lecturer') THEN
        v_has_owner := v_has_owner
          OR pg_temp.expr_mentions(r.qual, v_owner_column)
          OR pg_temp.expr_mentions(r.chk, v_owner_column);
        CONTINUE;
      END IF;

      IF r.polcmd = 'r'
         AND pg_temp.expr_is_open(r.qual)
         AND (r.chk IS NULL OR pg_temp.expr_is_open(r.chk)) THEN
        v_drop := v_drop || r.polname;
        v_open := v_open + 1;
        CONTINUE;
      END IF;

      RAISE EXCEPTION
        'public.% policy % is not an owner policy and is not a public USING (true) read. Expression: %. Refusing to change policies on this table.',
        v_table, r.polname, COALESCE(r.qual, r.chk, '(none)');
    END LOOP;

    IF NOT v_has_owner THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = %I) WITH CHECK (auth.uid() = %I)',
        'Owners manage own ' || v_table,
        v_table,
        v_owner_column,
        v_owner_column
      );
    END IF;

    IF v_open = 0 THEN
      RAISE NOTICE 'public.% has no public USING (true) SELECT. Not adding a signed-in read-all policy.', v_table;
    ELSE
      FOREACH v_name IN ARRAY v_drop LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', v_name, v_table);
      END LOOP;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_new_policy, v_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        v_new_policy,
        v_table
      );
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
  END LOOP;
END $$;

-- Storage. The documents bucket becomes private, 20 MB, with the MIME types
-- ContentUploadScreen and fileAccess.js already allow. ProfileScreen avatar
-- uploads use image/jpeg and stay inside that list.
--
-- A SELECT policy whose only test is bucket_id = 'documents' is replaced with
-- the same test limited to authenticated, so createSignedUrl works for
-- StudentMaterialsScreen, SearchScreen, and ContentUploadScreen. A public URL
-- copied before this migration stops working. The app falls back to that URL
-- only when signing fails, which is the pre-migration case.
--
-- A SELECT policy that adds any other test is left untouched and stops the
-- run, so a tighter rule is not replaced with a bucket-wide read.
-- Upload, update, and delete policies are not modified.
--
-- Any signed-in user can still list object names in this bucket. Closing that
-- would need per-class paths the app does not have. Not applied.

DO $$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'storage.buckets or storage.objects is missing. Refusing to continue.';
  END IF;

  SELECT string_agg(required.column_name, ', ') INTO v_missing
  FROM (VALUES ('public'), ('file_size_limit'), ('allowed_mime_types')) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'storage.buckets is missing %. Refusing to update the documents bucket.', v_missing;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,
  ARRAY[
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
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_name text;
  v_norm text;
BEGIN
  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
  LOOP
    IF r.polcmd <> 'r' THEN
      CONTINUE;
    END IF;
    IF COALESCE(r.qual, '') NOT ILIKE '%documents%' THEN
      CONTINUE;
    END IF;
    IF r.polname = 'Signed-in users can read document files' THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    v_norm := pg_temp.norm_expr(r.qual);
    IF v_norm IN (
      '(bucket_id=''documents''::text)',
      '((bucket_id=''documents''::text))',
      '(bucket_id=''documents'')',
      '((bucket_id=''documents''))',
      'bucket_id=''documents''::text',
      'bucket_id=''documents'''
    ) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'storage.objects SELECT policy % is not a bucket-only documents read. Expression: %. Refusing to replace it with a signed-in bucket read.',
      r.polname, COALESCE(r.qual, '(none)');
  END LOOP;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', v_name);
  END LOOP;

  CREATE POLICY "Signed-in users can read document files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents');
END $$;

-- Announcements are not in the schema scripts. DashboardScreen reads id,
-- title, body, and created_at. LecturerDashboardScreen inserts title and body.
-- If the table is missing, it is created with those columns only. If it
-- exists, those columns are required and no column is added or dropped.
-- Extra columns are left as they are. lecturer_id, created_by, and class_id
-- are not referenced, because the live table has none of them.
--
-- A USING (true) policy is replaced. Anon can no longer read or post. A
-- signed-in student still sees announcements. Only a lecturer can insert.
-- The lecturer screen does not edit or delete, so those commands are not granted.
-- A policy that is not USING (true) and is not one of the two policies created
-- here stops the run.

DO $$
DECLARE
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_name text;
  v_rls boolean;
BEGIN
  IF to_regclass('public.announcements') IS NULL THEN
    CREATE TABLE public.announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text,
      body text,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    PERFORM pg_temp.require_column('announcements', 'id');
    PERFORM pg_temp.require_column('announcements', 'title');
    PERFORM pg_temp.require_column('announcements', 'body');
    PERFORM pg_temp.require_column('announcements', 'created_at');
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'announcements';

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'announcements'
  LOOP
    IF r.polname IN (
      'Signed-in users can read announcements',
      'Lecturers can post announcements'
    ) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    IF (r.qual IS NULL OR pg_temp.expr_is_open(r.qual))
       AND (r.chk IS NULL OR pg_temp.expr_is_open(r.chk))
       AND (pg_temp.expr_is_open(r.qual) OR pg_temp.expr_is_open(r.chk)) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'public.announcements policy % is not a public USING (true) policy. Expression: %. Refusing to replace it.',
      r.polname, COALESCE(r.qual, r.chk, '(none)');
  END LOOP;

  IF v_rls AND cardinality(v_drop) = 0 THEN
    RAISE EXCEPTION 'public.announcements has RLS and no public read policy. Refusing to add a signed-in read-all policy.';
  END IF;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.announcements', v_name);
  END LOOP;

  ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

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
END $$;

REVOKE ALL ON TABLE public.announcements FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.announcements TO authenticated;

-- -----------------------------------------------------------------------------
-- (b) Maze session leaderboard policy
-- -----------------------------------------------------------------------------
-- "Leaderboard read maze sessions" is USING (true), so anyone who can read
-- the table sees every user's maze session. LeaderboardScreen does not read
-- this table. It calls get_leaderboard. CircuitMazeScreen records a session
-- through circuitMazeService.awardXp, which inserts the signed-in user's row.
--
-- The public SELECT is dropped. The own-row policy stays. If the table exists
-- without user_id, the run stops before that drop. If the table is absent,
-- this section does nothing: the maze script has not been applied.

DO $$
DECLARE
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_has_own boolean := false;
  v_name text;
BEGIN
  IF to_regclass('public.circuit_maze_sessions') IS NULL THEN
    RAISE NOTICE 'circuit_maze_sessions is missing; maze session policies are unchanged';
    RETURN;
  END IF;

  PERFORM pg_temp.require_uuid('circuit_maze_sessions', 'user_id');

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'circuit_maze_sessions'
  LOOP
    IF pg_temp.expr_is_own_row(r.qual)
       AND (r.chk IS NULL OR pg_temp.expr_is_own_row(r.chk)) THEN
      v_has_own := true;
      CONTINUE;
    END IF;

    IF r.polcmd = 'r' AND pg_temp.expr_is_open(r.qual) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'public.circuit_maze_sessions policy % is not an own-row policy and is not USING (true). Expression: %. Refusing to change it.',
      r.polname, COALESCE(r.qual, r.chk, '(none)');
  END LOOP;

  IF NOT v_has_own THEN
    CREATE POLICY "Users manage own maze sessions"
      ON public.circuit_maze_sessions
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.circuit_maze_sessions', v_name);
  END LOOP;

  ALTER TABLE public.circuit_maze_sessions ENABLE ROW LEVEL SECURITY;
END $$;

-- -----------------------------------------------------------------------------
-- (d) Multiplayer room codes
-- -----------------------------------------------------------------------------
-- circuitMazeService.joinRoom and gameRunnerService.joinRoom used to SELECT
-- every waiting room. After this section a room is visible only to its host
-- or a player. Joining uses join_circuit_maze_room / join_game_runner_room,
-- which return one waiting room for a code the player typed. Guessing a code
-- still joins that room. Listing every code does not.
--
-- CircuitMazeLobbyScreen and GameRunnerLobbyScreen call those services.
-- The app falls back to a direct lookup until the function exists.
-- Host insert and host update policies are kept when they test host_id or
-- user_id. A SELECT policy this script does not recognise stops the run.
--
-- Repo columns, required when the table exists:
--   rooms: id, code, host_id, status
--   players: room_id, user_id
-- A missing pair of tables is skipped. One table without the other stops
-- the run, because the member test reads both.

CREATE OR REPLACE FUNCTION public.is_circuit_maze_member(p_room uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.circuit_maze_rooms') IS NULL
     OR to_regclass('public.circuit_maze_players') IS NULL THEN
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
  IF to_regclass('public.game_runner_rooms') IS NULL
     OR to_regclass('public.game_runner_players') IS NULL THEN
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

DO $$
DECLARE
  v_rooms text;
  v_players text;
  v_join text;
  v_member text;
  v_policy text;
  v_pair text[] := ARRAY['circuit_maze', 'game_runner'];
  v_prefix text;
  v_col text;
  r record;
  v_drop text[];
  v_name text;
BEGIN
  FOREACH v_prefix IN ARRAY v_pair LOOP
    v_rooms := v_prefix || '_rooms';
    v_players := v_prefix || '_players';
    v_member := CASE v_prefix
      WHEN 'circuit_maze' THEN 'is_circuit_maze_member'
      ELSE 'is_game_runner_member'
    END;
    v_join := CASE v_prefix
      WHEN 'circuit_maze' THEN 'join_circuit_maze_room'
      ELSE 'join_game_runner_room'
    END;
    v_policy := CASE v_prefix
      WHEN 'circuit_maze' THEN 'Members can read maze rooms'
      ELSE 'Members can read runner rooms'
    END;

    IF to_regclass('public.' || v_rooms) IS NULL
       AND to_regclass('public.' || v_players) IS NULL THEN
      RAISE NOTICE '% rooms are missing; room policies are unchanged', v_prefix;
      CONTINUE;
    END IF;

    IF to_regclass('public.' || v_rooms) IS NULL
       OR to_regclass('public.' || v_players) IS NULL THEN
      RAISE EXCEPTION 'public.% and public.% must both exist. Refusing to lock one of them.', v_rooms, v_players;
    END IF;

    FOREACH v_col IN ARRAY ARRAY['id', 'code', 'host_id', 'status'] LOOP
      PERFORM pg_temp.require_column(v_rooms, v_col);
    END LOOP;
    PERFORM pg_temp.require_uuid(v_rooms, 'host_id');
    FOREACH v_col IN ARRAY ARRAY['room_id', 'user_id'] LOOP
      PERFORM pg_temp.require_column(v_players, v_col);
    END LOOP;
    PERFORM pg_temp.require_uuid(v_players, 'user_id');

    EXECUTE format($fmt$
      CREATE OR REPLACE FUNCTION public.%I(p_code text)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $function$
      DECLARE
        v_room public.%I;
      BEGIN
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;
        SELECT * INTO v_room
        FROM public.%I
        WHERE code = upper(trim(p_code))
          AND status = 'waiting';
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Room not found or already started';
        END IF;
        RETURN to_jsonb(v_room);
      END;
      $function$
    $fmt$, v_join, v_rooms, v_rooms);

    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(text) FROM PUBLIC, anon', v_join);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(text) TO authenticated', v_join);

    -- Rooms, then players. Players use room_id in the member test.
    v_drop := ARRAY[]::text[];
    FOR r IN
      SELECT pol.polname, pol.polcmd,
             pg_get_expr(pol.polqual, pol.polrelid) AS qual,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_rooms
    LOOP
      IF r.polname = v_policy THEN
        v_drop := v_drop || r.polname;
      ELSIF r.polcmd = 'r' AND pg_temp.expr_is_open(r.qual) THEN
        v_drop := v_drop || r.polname;
      ELSIF r.polcmd = 'r' THEN
        RAISE EXCEPTION
          'public.% SELECT policy % is not a list-all policy. Expression: %. Refusing to leave room codes readable.',
          v_rooms, r.polname, COALESCE(r.qual, '(none)');
      ELSIF NOT (
        pg_temp.expr_mentions(r.qual, 'host_id') OR pg_temp.expr_mentions(r.chk, 'host_id')
        OR pg_temp.expr_mentions(r.qual, 'user_id') OR pg_temp.expr_mentions(r.chk, 'user_id')
      ) THEN
        RAISE EXCEPTION
          'public.% policy % does not test host_id or user_id. Expression: %. Refusing to change room policies.',
          v_rooms, r.polname, COALESCE(r.qual, r.chk, '(none)');
      END IF;
    END LOOP;

    FOREACH v_name IN ARRAY v_drop LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_name, v_rooms);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_rooms);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.%I(id))',
      v_policy, v_rooms, v_member
    );

    v_policy := CASE v_prefix
      WHEN 'circuit_maze' THEN 'Members can read maze players'
      ELSE 'Members can read runner players'
    END;
    v_drop := ARRAY[]::text[];
    FOR r IN
      SELECT pol.polname, pol.polcmd,
             pg_get_expr(pol.polqual, pol.polrelid) AS qual,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_players
    LOOP
      IF r.polname = v_policy THEN
        v_drop := v_drop || r.polname;
      ELSIF r.polcmd = 'r' AND pg_temp.expr_is_open(r.qual) THEN
        v_drop := v_drop || r.polname;
      ELSIF r.polcmd = 'r' THEN
        RAISE EXCEPTION
          'public.% SELECT policy % is not a list-all policy. Expression: %. Refusing to change it.',
          v_players, r.polname, COALESCE(r.qual, '(none)');
      ELSIF NOT (
        pg_temp.expr_mentions(r.qual, 'user_id') OR pg_temp.expr_mentions(r.chk, 'user_id')
        OR pg_temp.expr_mentions(r.qual, 'room_id') OR pg_temp.expr_mentions(r.chk, 'room_id')
      ) THEN
        RAISE EXCEPTION
          'public.% policy % does not test user_id or room_id. Expression: %. Refusing to change it.',
          v_players, r.polname, COALESCE(r.qual, r.chk, '(none)');
      END IF;
    END LOOP;

    FOREACH v_name IN ARRAY v_drop LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_name, v_players);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_players);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.%I(room_id))',
      v_policy, v_players, v_member
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- game_scores
-- -----------------------------------------------------------------------------
-- GameScreen upserts the signed-in user's best score and reads a top-five
-- list. The table is not created by the schema scripts. If it is missing, it
-- is created with user_id, score, and updated_at. If it exists, user_id must
-- be uuid, score must be integer, and user_id must already be unique. This
-- script does not add or rewrite a key.
--
-- Own-row policies replace a public USING (true) read. get_runner_leaderboard
-- returns the top five names without opening every profiles row. GameScreen
-- calls that function and falls back to the table until the function exists.
-- After this migration the table fallback only returns the caller's row.

DO $$
DECLARE
  v_type text;
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_name text;
BEGIN
  IF to_regclass('public.game_scores') IS NULL THEN
    CREATE TABLE public.game_scores (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      score integer NOT NULL DEFAULT 0,
      updated_at timestamptz DEFAULT now()
    );
  ELSE
    PERFORM pg_temp.require_column('game_scores', 'user_id');
    PERFORM pg_temp.require_column('game_scores', 'score');

    SELECT data_type INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_scores' AND column_name = 'user_id';
    IF v_type <> 'uuid' THEN
      RAISE EXCEPTION 'public.game_scores.user_id is %, not uuid. Refusing to add an own-row policy.', v_type;
    END IF;

    SELECT data_type INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_scores' AND column_name = 'score';
    IF v_type <> 'integer' THEN
      RAISE EXCEPTION 'public.game_scores.score is %, not integer. Refusing to build the leaderboard function.', v_type;
    END IF;

    PERFORM pg_temp.require_uuid('game_scores', 'user_id');

    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'game_scores'
        AND i.indisunique
        AND i.indnkeyatts = 1
        AND pg_get_indexdef(i.indexrelid) ~* '\(\s*"?user_id"?\s*\)'
    ) THEN
      RAISE EXCEPTION 'public.game_scores.user_id is not unique. GameScreen upserts on that column. Refusing to rewrite the key.';
    END IF;
  END IF;

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'game_scores'
  LOOP
    IF r.polname IN (
      'Users read own runner score',
      'Users insert own runner score',
      'Users update own runner score'
    ) OR (
      pg_temp.expr_is_own_row(r.qual)
      AND (r.chk IS NULL OR pg_temp.expr_is_own_row(r.chk))
    ) OR (
      r.polcmd = 'r' AND pg_temp.expr_is_open(r.qual)
    ) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'public.game_scores policy % is not an own-row or public-read policy. Expression: %. Refusing to change it.',
      r.polname, COALESCE(r.qual, r.chk, '(none)');
  END LOOP;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.game_scores', v_name);
  END LOOP;

  ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

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
END $$;

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
-- Windows11SimulatorScreen inserts user_id and session_start, then updates
-- session_end and duration_seconds on that id. If the table is missing, it is
-- created with the columns in supabase-windows-sim.sql. If it exists, those
-- columns are required and none are added. The own-row policy is unchanged
-- in effect. A public USING (true) policy is dropped. Any other policy stops
-- the run.

DO $$
DECLARE
  r record;
  v_drop text[] := ARRAY[]::text[];
  v_name text;
  v_col text;
BEGIN
  IF to_regclass('public.windows_simulation_sessions') IS NULL THEN
    CREATE TABLE public.windows_simulation_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      session_start timestamptz NOT NULL DEFAULT now(),
      session_end timestamptz,
      duration_seconds integer,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    FOREACH v_col IN ARRAY ARRAY['id', 'user_id', 'session_start', 'session_end', 'duration_seconds'] LOOP
      PERFORM pg_temp.require_column('windows_simulation_sessions', v_col);
    END LOOP;
    PERFORM pg_temp.require_uuid('windows_simulation_sessions', 'user_id');
  END IF;

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'windows_simulation_sessions'
  LOOP
    IF r.polname = 'Users manage own simulator sessions'
       OR (
         pg_temp.expr_is_own_row(r.qual)
         AND (r.chk IS NULL OR pg_temp.expr_is_own_row(r.chk))
       )
       OR (r.polcmd = 'r' AND pg_temp.expr_is_open(r.qual)) THEN
      v_drop := v_drop || r.polname;
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'public.windows_simulation_sessions policy % is not an own-row or public-read policy. Expression: %. Refusing to change it.',
      r.polname, COALESCE(r.qual, r.chk, '(none)');
  END LOOP;

  FOREACH v_name IN ARRAY v_drop LOOP
    EXECUTE format('DROP POLICY %I ON public.windows_simulation_sessions', v_name);
  END LOOP;

  ALTER TABLE public.windows_simulation_sessions ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users manage own simulator sessions"
    ON public.windows_simulation_sessions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

REVOKE ALL ON TABLE public.windows_simulation_sessions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.windows_simulation_sessions TO authenticated;

-- -----------------------------------------------------------------------------
-- (g) Blanket GRANT ALL to anon / authenticated
-- -----------------------------------------------------------------------------
-- supabase-setup.sql grants ALL on every public table, sequence, and function
-- to anon and authenticated. PostgreSQL also grants EXECUTE on new functions
-- to PUBLIC, which includes anon. Revoking anon alone leaves that PUBLIC
-- grant in place.
--
-- This block removes anon and PUBLIC privileges on public tables, sequences,
-- and functions. Where PUBLIC held a privilege that authenticated did not
-- already have, that same privilege is copied to authenticated first, except
-- TRUNCATE. Signed-in screens keep the access they already had. Anon loses
-- table DML and function execute. TRUNCATE is revoked from authenticated as
-- well, because TRUNCATE ignores RLS.
--
-- Authenticated table DML is not revoked. RLS is what limits rows. Revoking
-- it here would break every screen.
--
-- handle_new_user and custom_access_token_hook stay revoked from authenticated.
-- The auth service and service_role grants from earlier in this file remain.

DO $$
DECLARE
  v_class regclass;
  v_grant record;
  v_priv text;
  v_func oid;
  v_who text;
  v_public boolean;
  v_anon boolean;
  v_auth boolean;
BEGIN
  -- Copy a PUBLIC table privilege onto authenticated only when authenticated
  -- does not already have that privilege in the table ACL. has_table_privilege
  -- is not used here: it returns true for authenticated when the privilege
  -- comes from PUBLIC, and the REVOKE below would then remove the only grant.
  FOR v_class IN
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    FOR v_grant IN
      SELECT a.privilege_type
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid = v_class
        AND a.grantee = 0
        AND a.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER')
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        CROSS JOIN LATERAL aclexplode(c.relacl) a
        JOIN pg_roles r ON r.oid = a.grantee
        WHERE c.oid = v_class
          AND r.rolname = 'authenticated'
          AND a.privilege_type = v_grant.privilege_type
      ) THEN
        EXECUTE format(
          'GRANT %s ON TABLE %s TO authenticated',
          v_grant.privilege_type,
          v_class
        );
      END IF;
    END LOOP;
  END LOOP;

  FOR v_class IN
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['USAGE', 'SELECT'] LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_class c
        CROSS JOIN LATERAL aclexplode(c.relacl) a
        WHERE c.oid = v_class AND a.grantee = 0 AND a.privilege_type = v_priv
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_class c
        CROSS JOIN LATERAL aclexplode(c.relacl) a
        JOIN pg_roles r ON r.oid = a.grantee
        WHERE c.oid = v_class
          AND r.rolname = 'authenticated'
          AND a.privilege_type = v_priv
      ) THEN
        EXECUTE format('GRANT %s ON SEQUENCE %s TO authenticated', v_priv, v_class);
      END IF;
    END LOOP;
  END LOOP;

  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC';
  EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC';
  EXECUTE 'REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC';

  FOR v_func, v_who IN
    SELECT p.oid, p.proname::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    v_public := false;
    v_anon := false;
    v_auth := false;

    FOR v_priv IN
      SELECT COALESCE(r.rolname, 'PUBLIC')
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      LEFT JOIN pg_roles r ON r.oid = a.grantee
      WHERE p.oid = v_func
        AND a.privilege_type = 'EXECUTE'
    LOOP
      IF v_priv = 'PUBLIC' THEN v_public := true; END IF;
      IF v_priv = 'anon' THEN v_anon := true; END IF;
      IF v_priv = 'authenticated' THEN v_auth := true; END IF;
    END LOOP;

    IF v_who IN ('handle_new_user', 'custom_access_token_hook') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_func::regprocedure);
      CONTINUE;
    END IF;

    IF v_public OR v_anon THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_func::regprocedure);
      IF NOT v_auth THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_func::regprocedure);
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'gamification') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA gamification FROM anon, PUBLIC';
    EXECUTE 'REVOKE TRUNCATE ON ALL TABLES IN SCHEMA gamification FROM anon, authenticated, PUBLIC';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gamification FROM anon, PUBLIC';
  END IF;

  IF to_regprocedure('gamification.handle_new_profile()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION gamification.handle_new_profile() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- Pin search_path only when the function does not already have one.
-- Overwriting a live setting could break a body that names another schema.
-- xp_to_level does not read gamification. award_maze_xp does, and the maze
-- script pins it to public, gamification.

DO $$
DECLARE
  r record;
  v_cfg text[];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'xp_to_level'
  LOOP
    IF r.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(r.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
    ) THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    END IF;
  END LOOP;

  IF to_regprocedure('public.award_maze_xp(integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.award_maze_xp(integer) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.award_maze_xp(integer) TO authenticated';
    SELECT p.proconfig INTO v_cfg
    FROM pg_proc p
    WHERE p.oid = 'public.award_maze_xp(integer)'::regprocedure;
    IF v_cfg IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(v_cfg) AS cfg WHERE cfg LIKE 'search_path=%'
    ) THEN
      EXECUTE 'ALTER FUNCTION public.award_maze_xp(integer) SET search_path = public, gamification';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'award_maze_xp'
  ) THEN
    RAISE EXCEPTION 'public.award_maze_xp exists with a signature other than (integer). Refusing to revoke the wrong function.';
  END IF;
END $$;

-- A quiz function that still names the owner column that does not exist
-- would fail closed at runtime, but only after this transaction committed.
-- Stop now if one is still in the catalog. Folders and documents may mention
-- lecturer_id; that is their own column and is not an error.

DO $$
DECLARE
  v_owner text;
  v_wrong text;
  r record;
BEGIN
  SELECT v INTO v_owner FROM sec_facts WHERE k = 'quiz_owner';
  v_wrong := CASE v_owner WHEN 'created_by' THEN 'lecturer_id' ELSE 'created_by' END;

  FOR r IN
    SELECT n.nspname, p.proname, p.prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'gamification')
      AND p.prokind = 'f'
  LOOP
    IF pg_temp.expr_mentions(r.prosrc, v_wrong)
       AND (
         r.prosrc ILIKE '%quizzes.' || v_wrong || '%'
         OR r.prosrc ILIKE '%qz.' || v_wrong || '%'
       ) THEN
      RAISE EXCEPTION
        '%.% still reads quizzes.% but the owner column is %. Refusing to commit.',
        r.nspname, r.proname, v_wrong, v_owner;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Final checks. A failed check rolls back every change above.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_anon oid := (SELECT oid FROM pg_roles WHERE rolname = 'anon');
  r record;
  v_owner text;
BEGIN
  SELECT v INTO v_owner FROM sec_facts WHERE k = 'quiz_owner';

  -- Anon or PUBLIC must not still have an open read on the tables we locked.
  FOR r IN
    SELECT n.nspname, c.relname, pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pol.polroles
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname = 'public' AND c.relname IN (
            'folders', 'documents', 'quizzes', 'quiz_questions', 'announcements',
            'circuit_maze_sessions', 'circuit_maze_rooms', 'circuit_maze_players',
            'game_runner_rooms', 'game_runner_players', 'game_scores'
          ))
       OR (n.nspname = 'storage' AND c.relname = 'objects')
  LOOP
    IF r.nspname = 'storage' AND COALESCE(r.qual, '') NOT ILIKE '%documents%' THEN
      CONTINUE;
    END IF;

    IF cardinality(r.polroles) = 0 OR v_anon = ANY (r.polroles) THEN
      IF pg_temp.expr_is_open(r.qual)
         OR (
           r.nspname = 'storage'
           AND r.qual ILIKE '%documents%'
           AND r.polcmd = 'r'
           AND pg_temp.norm_expr(r.qual) LIKE '%bucket_id=%'
           AND pg_temp.norm_expr(r.qual) NOT LIKE '%auth.uid%'
         ) THEN
        RAISE EXCEPTION
          '%.% policy % is still open to anon or PUBLIC. Refusing to commit.',
          r.nspname, r.relname, r.polname;
      END IF;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'quiz_questions'
      AND (
        pg_temp.expr_mentions(pg_get_expr(pol.polqual, pol.polrelid), v_owner)
        OR pg_temp.expr_mentions(pg_get_expr(pol.polwithcheck, pol.polrelid), v_owner)
      )
  ) THEN
    RAISE EXCEPTION 'quiz_questions has no policy using %. Refusing to commit.', v_owner;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'quiz_attempts'
      AND pol.polcmd IN ('a', '*')
  ) THEN
    RAISE EXCEPTION 'quiz_attempts still has an INSERT or FOR ALL policy. Refusing to commit.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- OPTIONAL BLOCKS — not executed. They are comments so they are not part of
-- this transaction. Do not uncomment them in the same run.
-- -----------------------------------------------------------------------------
--
-- OPTIONAL (e): hide quiz_questions.correct_answer from every authenticated
-- user, including lecturers.
--
-- DO NOT APPLY if QuizDetailScreen or lecturerService.getQuizDetail must keep
-- showing the ticked correct option. Both select * from quiz_questions.
-- lecturerService.createQuiz also inserts correct_answer. StudentMaterialsScreen
-- and SearchScreen keep working through quiz_question_counts. QuizScreen keeps
-- working through the RPCs.
--
-- REVOKE SELECT (correct_answer) ON TABLE public.quiz_questions FROM anon, authenticated;
-- GRANT SELECT (id, quiz_id, question, options, order_index, created_at)
--   ON TABLE public.quiz_questions TO authenticated;
--
-- OPTIONAL: cap award_maze_xp (20 second cooldown, 2000 XP per day).
--
-- DO NOT APPLY with the current Circuit Maze screen. CircuitMazeScreen calls
-- circuitMazeService.awardXp on every correct answer and again for the finish
-- bonus. A 20 second cooldown would drop XP the maze already added to its
-- on-screen total. Apply this only after the maze sends one award at the end
-- of a level. The function would also have to be finished: the sketch in the
-- previous revision of this file did not update gamification.user_stats.

COMMIT;
