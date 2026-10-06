-- Security hardening for the LIVE Compu-ClassV1 database
-- (project qdtbmdsssjmapodladcs) and for a database created from supabase-setup.sql.
--
-- Run this in the Supabase SQL editor. Do not re-run supabase-setup.sql on the
-- live project. Do not apply this from the app.
--
-- What this script does:
--   * New signups are students. raw_user_meta_data.role and the
--     lecturer@compuclass.com shortcut are ignored. A later invite-code check
--     belongs inside handle_new_user (see the comment there). Promote today with
--     UPDATE public.profiles SET role = 'lecturer' WHERE id = '<uuid>';
--     run as postgres in the SQL editor.
--   * profiles.role can no longer be edited from the client (the old UPDATE
--     policy had no WITH CHECK).
--   * The access-token hook writes user_role, not the reserved role claim, and
--     supabase_auth_admin can read profiles. Policies that trusted
--     auth.jwt()->>'role' now call is_lecturer().
--   * Quiz owner column is created_by. This script does not replace the live
--     gradebook RPCs except where a body was unsafe or broken.
--   * Grants are per function. anon loses EXECUTE. RLS helpers stay executable
--     by authenticated. Internal trigger functions lose anon/authenticated
--     except where a trigger must fire for a signed-in user.
--
-- Gradebook / offline / maze RPCs that already check auth.uid() or
-- is_class_lecturer() are not rewritten. Their EXECUTE grants are tightened.

-- ============================================
-- 1. Safe additive constraints
-- ============================================

DELETE FROM public.material_views a
USING public.material_views b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.document_id = b.document_id
  AND a.ctid > b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'material_views_user_document_unique'
  ) THEN
    ALTER TABLE public.material_views
      ADD CONSTRAINT material_views_user_document_unique UNIQUE (user_id, document_id);
  END IF;
END $$;

UPDATE public.quiz_attempts
SET score = LEAST(100, GREATEST(0, score))
WHERE score IS NOT NULL AND (score < 0 OR score > 100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_score_range'
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_score_range
      CHECK (score IS NULL OR (score >= 0 AND score <= 100));
  END IF;
END $$;

-- ============================================
-- 2. Role assignment. Invite codes are not built yet.
-- ============================================

CREATE OR REPLACE FUNCTION public.profile_role_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- True for the SQL editor and for service_role.
  -- SECURITY DEFINER functions run as their owner (postgres), so
  -- handle_new_user — and a future consume_lecturer_invite() definer — can
  -- set profiles.role. A normal authenticated session cannot.
  SELECT current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR COALESCE(auth.jwt()->>'role', '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role)
     AND NOT public.profile_role_write_allowed() THEN
    RAISE EXCEPTION 'Profile role cannot be changed from the client';
  ELSIF TG_OP = 'INSERT'
     AND NEW.role IS DISTINCT FROM 'student'
     AND NOT public.profile_role_write_allowed() THEN
    RAISE EXCEPTION 'New profiles are students';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_change ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_change
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_change();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'student';
BEGIN
  -- Everyone is a student unless a server-side check below says otherwise.
  -- Never trust raw_user_meta_data->>'role' or a magic email address.
  --
  -- Lecturer invite codes are not implemented. When they are, resolve them
  -- here, before the INSERT, with a SECURITY DEFINER helper, for example:
  --   v_role := public.consume_lecturer_invite(NEW.raw_user_meta_data->>'invite_code');
  -- That helper must read only a hashed code from a table granted solely to
  -- service_role, and it must enforce expiry and a use limit. Because this
  -- function is SECURITY DEFINER, the role-protection trigger allows the
  -- role it writes. Clients still cannot update profiles.role themselves.
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_to_lecturer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not allowed to promote lecturers';
  END IF;
  UPDATE public.profiles SET role = 'lecturer' WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'lecturer'
  );
$$;

-- Same bodies as the live helpers. Replaced so a new database has them and so
-- search_path stays pinned. Policies and caller_may_take_quiz depend on these.
CREATE OR REPLACE FUNCTION public.is_class_lecturer(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND lecturer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students
    WHERE class_id = p_class_id AND student_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_see_quiz(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    JOIN public.class_students cs ON cs.class_id = qa.class_id
    WHERE qa.quiz_id = p_quiz_id
      AND qa.is_published
      AND cs.student_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.xp_to_level(p_xp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  lvl integer := 1;
BEGIN
  WHILE (100 * lvl * (lvl + 1) / 2) <= p_xp LOOP
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$$;

-- Used by the hardened quiz RPCs. Not granted to authenticated; definers call it.
CREATE OR REPLACE FUNCTION public.caller_may_take_quiz(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.student_can_see_quiz(p_quiz_id)
      OR EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = p_quiz_id AND q.created_by = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_students_with_emails()
RETURNS TABLE(id uuid, full_name text, email character varying, role text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_lecturer() THEN
    RAISE EXCEPTION 'Only lecturers can list student emails';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, u.email::varchar(255), p.role, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.role = 'student'
  ORDER BY p.created_at DESC;
END;
$$;

-- Writes a custom claim. The reserved "role" claim must stay "authenticated"
-- or PostgREST will try to SET ROLE student.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = (event->>'user_id')::uuid;

  claims := COALESCE(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'student')), true);
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;


-- ============================================
-- Hardened copies of live functions whose bodies were unsafe or broken.
-- submit_quiz_attempt keeps its XP / badge behaviour and gains an access check.
-- It is NOT replaced with a different quiz grader.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_attempt(p_quiz_id uuid)
 RETURNS TABLE(id uuid, question text, options jsonb, order_index integer, time_limit_seconds integer, difficulty text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.caller_may_take_quiz(p_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized to view this quiz';
  END IF;
  RETURN QUERY
  SELECT q.id, q.question, q.options, q.order_index,
         qs.time_limit_seconds, COALESCE(qs.difficulty, 'medium')
  FROM public.quiz_questions q
  LEFT JOIN gamification.quiz_question_settings qs ON qs.question_id = q.id
  WHERE q.quiz_id = p_quiz_id
  ORDER BY q.order_index;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_question_gamification_settings(p_question_id uuid, p_time_limit_seconds integer, p_difficulty text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  SELECT qz.created_by INTO v_owner
  FROM public.quiz_questions qq
  JOIN public.quizzes qz ON qz.id = qq.quiz_id
  WHERE qq.id = p_question_id;

  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to edit this question';
  END IF;

  INSERT INTO gamification.quiz_question_settings (question_id, time_limit_seconds, difficulty)
  VALUES (p_question_id, p_time_limit_seconds, COALESCE(p_difficulty, 'medium'))
  ON CONFLICT (question_id) DO UPDATE
    SET time_limit_seconds = EXCLUDED.time_limit_seconds,
        difficulty = EXCLUDED.difficulty;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_maze_xp(p_xp integer, p_finished boolean DEFAULT false, p_finish_bonus integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  MAX_MAZE_XP CONSTANT integer := 500;
  v_user_id UUID := auth.uid();
  v_xp      integer;
  v_old_level integer;
  v_new_xp  integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_xp IS NULL OR p_xp <= 0 THEN
    RETURN jsonb_build_object('xp_awarded', 0);
  END IF;

  v_xp := LEAST(p_xp, MAX_MAZE_XP);

  -- award_maze_xp is the only insert path after the direct write policy is
  -- dropped. A short cooldown and a daily cap stop a tight farming loop.
  IF EXISTS (
    SELECT 1 FROM public.circuit_maze_sessions
    WHERE user_id = v_user_id
      AND completed_at > now() - interval '20 seconds'
  ) THEN
    RAISE EXCEPTION 'Maze XP was just awarded. Wait a moment before claiming again.';
  END IF;
  IF COALESCE((
    SELECT SUM(xp_earned) FROM public.circuit_maze_sessions
    WHERE user_id = v_user_id
      AND completed_at > now() - interval '1 day'
  ), 0) + v_xp > 2000 THEN
    RAISE EXCEPTION 'Daily maze XP limit reached';
  END IF;

  SELECT level INTO v_old_level FROM gamification.user_stats WHERE user_id = v_user_id;

  INSERT INTO public.circuit_maze_sessions (user_id, xp_earned, finished, finish_bonus)
  VALUES (v_user_id, v_xp, COALESCE(p_finished, false),
          LEAST(GREATEST(COALESCE(p_finish_bonus, 0), 0), MAX_MAZE_XP));

  v_new_xp := gamification.refresh_user_xp(v_user_id);

  UPDATE gamification.user_stats
  SET last_activity_date = CURRENT_DATE
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'xp_awarded', v_xp,
    'capped',     p_xp > MAX_MAZE_XP,
    'new_xp',     v_new_xp,
    'old_level',  v_old_level,
    'new_level',  public.xp_to_level(v_new_xp),
    'leveled_up', public.xp_to_level(v_new_xp) > COALESCE(v_old_level, 1)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_question RECORD;
  v_answer JSONB;
  v_is_correct BOOLEAN;
  v_combo INTEGER := 0;
  v_max_combo INTEGER := 0;
  v_correct_count INTEGER := 0;
  v_total INTEGER := 0;
  v_xp_earned INTEGER := 0;
  v_multiplier NUMERIC;
  v_speed_bonus INTEGER;
  v_question_xp INTEGER;
  v_passing_score INTEGER;
  v_percentage INTEGER;
  v_passed BOOLEAN;
  v_attempt_id UUID;
  v_old_xp INTEGER;
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_today DATE := CURRENT_DATE;
  v_last_activity DATE;
  v_new_streak INTEGER;
  v_new_longest INTEGER;
  v_new_badges JSONB := '[]'::JSONB;
  v_badge RECORD;
  v_inserted_badge_id UUID;
  v_review JSONB := '[]'::JSONB;
  v_quiz_count INTEGER;
  v_previous_best INTEGER;
  v_xp_awarded INTEGER;
  v_base_xp INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT passing_score INTO v_passing_score FROM public.quizzes WHERE id = p_quiz_id;
  IF v_passing_score IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;

  -- Do not grade or return the answer key unless this student can see the quiz
  -- (published assignment + enrolment) or they authored it (practice / preview).
  IF NOT public.caller_may_take_quiz(p_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized to take this quiz';
  END IF;

  -- Join the per-question settings once here rather than looking them up
  -- again inside the loop. Questions the lecturer never customised have no
  -- settings row at all, hence the COALESCE to 'medium'.
  FOR v_question IN
    SELECT q.*,
           qs.time_limit_seconds,
           COALESCE(qs.difficulty, 'medium') AS difficulty
    FROM public.quiz_questions q
    LEFT JOIN gamification.quiz_question_settings qs ON qs.question_id = q.id
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.order_index
  LOOP
    v_total := v_total + 1;

    SELECT elem INTO v_answer
    FROM jsonb_array_elements(p_answers) elem
    WHERE (elem->>'question_id')::UUID = v_question.id
    LIMIT 1;

    v_is_correct := (v_answer IS NOT NULL AND (v_answer->>'selected_answer') = v_question.correct_answer);

    IF v_is_correct THEN
      v_combo := v_combo + 1;
      v_max_combo := GREATEST(v_max_combo, v_combo);
      v_multiplier := LEAST(1 + (FLOOR((v_combo - 1) / 3.0) * 0.2), 2.0);

      v_speed_bonus := 0;
      IF v_answer ? 'time_remaining_seconds'
         AND v_question.time_limit_seconds IS NOT NULL
         AND (v_answer->>'time_remaining_seconds')::NUMERIC > (v_question.time_limit_seconds * 0.5) THEN
        v_speed_bonus := 5;
      END IF;

      -- Harder questions are worth more. Medium is the default, so quizzes
      -- authored before difficulty existed keep paying exactly what they did.
      v_base_xp := CASE v_question.difficulty
                     WHEN 'easy' THEN 5
                     WHEN 'hard' THEN 15
                     ELSE 10
                   END;

      v_question_xp := ROUND(v_base_xp * v_multiplier) + v_speed_bonus;
      v_xp_earned := v_xp_earned + v_question_xp;
      v_correct_count := v_correct_count + 1;
    ELSE
      v_combo := 0;
    END IF;

    v_review := v_review || jsonb_build_object(
      'question_id', v_question.id,
      'question', v_question.question,
      'correct_answer', v_question.correct_answer,
      'selected_answer', (v_answer->>'selected_answer'),
      'is_correct', v_is_correct,
      'difficulty', v_question.difficulty
    );
  END LOOP;

  IF v_total = 0 THEN RAISE EXCEPTION 'Quiz has no questions'; END IF;

  v_percentage := ROUND((v_correct_count::NUMERIC / v_total) * 100);
  v_passed := v_percentage >= v_passing_score;

  v_xp_earned := v_xp_earned + 20;
  IF v_percentage >= 90 THEN v_xp_earned := v_xp_earned + 50; END IF;

  -- v_xp_earned is now what THIS attempt is worth on its own merits.
  --
  -- A quiz is worth its best-ever attempt, once. Look up the high-water mark
  -- for this user/quiz pair and award only the improvement on it, so replaying
  -- a quiz cannot farm XP while genuinely doing better still pays.
  -- This must run BEFORE the insert below, or it would count the current row.
  SELECT COALESCE(MAX(qas.xp_earned), 0) INTO v_previous_best
  FROM public.quiz_attempts qa
  JOIN gamification.quiz_attempt_stats qas ON qas.attempt_id = qa.id
  WHERE qa.user_id = v_user_id AND qa.quiz_id = p_quiz_id;

  v_xp_awarded := GREATEST(0, v_xp_earned - v_previous_best);

  -- Base attempt row — same shape as before, no new columns
  INSERT INTO public.quiz_attempts (user_id, quiz_id, score)
  VALUES (v_user_id, p_quiz_id, v_percentage)
  RETURNING id INTO v_attempt_id;

  -- Extended stats live in the new schema. Store the attempt's own value, not
  -- the awarded amount — that is what makes the high-water mark work.
  INSERT INTO gamification.quiz_attempt_stats (attempt_id, xp_earned, max_combo, correct_count, total_questions)
  VALUES (v_attempt_id, v_xp_earned, v_max_combo, v_correct_count, v_total);

  -- Ensure a stats row exists (covers users created before this migration)
  INSERT INTO gamification.user_stats (user_id) VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT xp, level, last_activity_date, current_streak, longest_streak
    INTO v_old_xp, v_old_level, v_last_activity, v_new_streak, v_new_longest
    FROM gamification.user_stats WHERE user_id = v_user_id;

  v_new_xp := v_old_xp + v_xp_awarded;
  v_new_level := public.xp_to_level(v_new_xp);

  IF v_last_activity = v_today THEN
    NULL;
  ELSIF v_last_activity = v_today - 1 THEN
    v_new_streak := v_new_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;
  v_new_longest := GREATEST(v_new_longest, v_new_streak);

  UPDATE gamification.user_stats
  SET xp = v_new_xp, level = v_new_level,
      current_streak = v_new_streak, longest_streak = v_new_longest,
      last_activity_date = v_today, updated_at = NOW()
  WHERE user_id = v_user_id;

  -- DISTINCT: badges count quizzes completed, not attempts made, so retaking
  -- one quiz ten times no longer unlocks quiz_master.
  SELECT COUNT(DISTINCT quiz_id) INTO v_quiz_count
  FROM public.quiz_attempts WHERE user_id = v_user_id;

  FOR v_badge IN
    SELECT * FROM gamification.badges WHERE code IN (
      CASE WHEN v_quiz_count = 1 THEN 'first_quiz' END,
      CASE WHEN v_percentage = 100 THEN 'perfect_score' END,
      CASE WHEN v_new_streak >= 3 THEN 'streak_3' END,
      CASE WHEN v_new_streak >= 7 THEN 'streak_7' END,
      CASE WHEN v_max_combo >= 5 THEN 'combo_5' END,
      CASE WHEN v_quiz_count >= 10 THEN 'quiz_master' END
    )
  LOOP
    INSERT INTO gamification.user_badges (user_id, badge_id)
    VALUES (v_user_id, v_badge.id)
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id INTO v_inserted_badge_id;

    IF FOUND THEN
      v_new_badges := v_new_badges || jsonb_build_object(
        'code', v_badge.code, 'name', v_badge.name, 'icon', v_badge.icon
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'score', v_percentage,
    'passed', v_passed,
    'correct_count', v_correct_count,
    'total_questions', v_total,
    -- xp_earned is what actually landed on the user's total. When a retake
    -- fails to beat the previous best that is 0, and attempt_value / previous
    -- best let the UI explain why.
    'xp_earned', v_xp_awarded,
    'xp_attempt_value', v_xp_earned,
    'xp_previous_best', v_previous_best,
    'is_personal_best', v_xp_earned > v_previous_best,
    'new_xp', v_new_xp,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'leveled_up', v_new_level > v_old_level,
    'max_combo', v_max_combo,
    'current_streak', v_new_streak,
    'new_badges', v_new_badges,
    'review', v_review
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_attempt(p_client_attempt_id uuid, p_answers jsonb, p_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_time_taken_seconds integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_user_id      uuid := auth.uid();
  v_attempt      RECORD;
  v_assignment   RECORD;
  v_completed    timestamptz;
  v_has_manual   boolean;
  v_raw          numeric;
  v_max          numeric;
  v_raw_percent  numeric;
  v_penalty      numeric := 0;
  v_is_late      boolean := false;
  v_final        numeric;
  v_status       text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT a.* INTO v_attempt FROM public.quiz_attempts a
  WHERE a.client_attempt_id = p_client_attempt_id
  -- Serialises concurrent submits of the same attempt, which is the
  -- timer-expiry-versus-tap race. The loser waits, then sees a finalized
  -- attempt and returns the stored result.
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No attempt found for that key — call start_quiz_attempt first';
  END IF;
  IF v_attempt.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Attempt belongs to another user';
  END IF;

  -- Already finalized (or rejected): return what is stored, grade nothing.
  IF v_attempt.status IN ('graded','pending_manual_grade','rejected') THEN
    RETURN public.get_attempt_result(v_attempt.id);
  END IF;

  -- The server clock is authoritative. A client-supplied p_completed_at can
  -- back-date the attempt and skip the late penalty or the closes_at check.
  -- Offline sync after closes_at is therefore rejected, even if the device
  -- clock says the quiz was finished earlier.
  v_completed := now();

  -- --- Offline conflict check: the server is authoritative on attempt_limit ---
  -- Two devices offline can both produce a "valid" attempt. Whichever syncs
  -- second is rejected HERE, kept, and surfaced to the student.
  IF v_attempt.assignment_id IS NOT NULL THEN
    SELECT * INTO v_assignment FROM public.quiz_assignments
    WHERE id = v_attempt.assignment_id;

    IF (SELECT count(*) FROM public.quiz_attempts
        WHERE assignment_id = v_attempt.assignment_id
          AND user_id = v_user_id
          AND id <> v_attempt.id
          AND status <> 'rejected') >= v_assignment.attempt_limit THEN

      UPDATE public.quiz_attempts
      SET status = 'rejected',
          completed_at = v_completed,
          synced_at = now(),
          rejected_reason = format(
            'This attempt was completed offline but you had already used all %s attempts on another device, so it could not be recorded.',
            v_assignment.attempt_limit)
      WHERE id = v_attempt.id;

      RETURN public.get_attempt_result(v_attempt.id);
    END IF;

    IF v_assignment.closes_at IS NOT NULL AND v_completed > v_assignment.closes_at THEN
      UPDATE public.quiz_attempts
      SET status = 'rejected',
          completed_at = v_completed,
          synced_at = now(),
          rejected_reason = 'Submitted after this quiz closed, so it could not be recorded.'
      WHERE id = v_attempt.id;

      RETURN public.get_attempt_result(v_attempt.id);
    END IF;
  END IF;

  -- --- Persist answers (upsert => replaying a sync cannot duplicate them) ---
  INSERT INTO public.quiz_answers (
    attempt_id, question_id, selected_option_id, short_answer_text,
    time_remaining_seconds, answered_at
  )
  SELECT v_attempt.id,
         (e ->> 'question_id')::uuid,
         NULLIF(e ->> 'selected_option_id', '')::uuid,
         NULLIF(e ->> 'short_answer_text', ''),
         NULLIF(e ->> 'time_remaining_seconds', '')::integer,
         v_completed
  FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) AS e
  -- Ignore anything not actually in this quiz.
  WHERE EXISTS (SELECT 1 FROM public.quiz_questions qq
                WHERE qq.id = (e ->> 'question_id')::uuid
                  AND qq.quiz_id = v_attempt.quiz_id)
  ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET selected_option_id      = EXCLUDED.selected_option_id,
        short_answer_text       = EXCLUDED.short_answer_text,
        time_remaining_seconds  = EXCLUDED.time_remaining_seconds,
        answered_at             = EXCLUDED.answered_at;

  -- Unanswered questions still need a row, so max_points is the whole quiz and
  -- the manual-grading queue shows every open-ended question.
  INSERT INTO public.quiz_answers (attempt_id, question_id, answered_at)
  SELECT v_attempt.id, qq.id, v_completed
  FROM public.quiz_questions qq
  WHERE qq.quiz_id = v_attempt.quiz_id
  ON CONFLICT (attempt_id, question_id) DO NOTHING;

  -- --- Auto-grade the objective questions, by OPTION ID not string ---
  -- Correlated subqueries rather than a LEFT JOIN in FROM: an UPDATE ... FROM
  -- cannot reference the target table (ans) inside a join condition, and
  -- filtering the join in WHERE would skip unanswered questions entirely,
  -- leaving them ungraded and the attempt stuck as pending forever.
  --
  -- `o.question_id = ans.question_id` matters: without it a student could send
  -- the id of a correct option belonging to a DIFFERENT question and be marked
  -- right. An unanswered question yields NULL -> false -> 0 points.
  UPDATE public.quiz_answers ans
  SET is_correct = COALESCE((
        SELECT o.is_correct FROM public.quiz_options o
        WHERE o.id = ans.selected_option_id AND o.question_id = ans.question_id
      ), false),
      points_awarded = CASE WHEN COALESCE((
        SELECT o.is_correct FROM public.quiz_options o
        WHERE o.id = ans.selected_option_id AND o.question_id = ans.question_id
      ), false) THEN qq.points ELSE 0 END,
      graded_at = v_completed
  FROM public.quiz_questions qq
  WHERE ans.question_id = qq.id
    AND ans.attempt_id = v_attempt.id
    AND qq.type IN ('mcq','true_false');

  -- Open-ended questions stay ungraded (is_correct / points_awarded NULL).
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_questions
    WHERE quiz_id = v_attempt.quiz_id
      AND type IN ('short_answer','image_based')
  ) INTO v_has_manual;

  -- --- Scores. points drive the grade. ---
  SELECT COALESCE(SUM(ans.points_awarded), 0), COALESCE(SUM(qq.points), 0)
  INTO v_raw, v_max
  FROM public.quiz_answers ans
  JOIN public.quiz_questions qq ON qq.id = ans.question_id
  WHERE ans.attempt_id = v_attempt.id;

  v_raw_percent := CASE WHEN v_max > 0 THEN (v_raw / v_max) * 100 ELSE 0 END;

  -- --- Late penalty applies to the GRADE only, never to XP ---
  -- Nested rather than a single AND: v_assignment is only populated for class
  -- attempts, and PL/pgSQL does not guarantee short-circuit evaluation, so
  -- touching v_assignment.due_at on a practice attempt would raise
  -- "record is not assigned yet".
  IF v_attempt.assignment_id IS NOT NULL THEN
    IF v_assignment.due_at IS NOT NULL AND v_completed > v_assignment.due_at THEN
      v_is_late := true;
      v_penalty := v_assignment.late_penalty_percent;
    END IF;
  END IF;

  -- 90 raw with a 10% penalty records as 81, per the spec.
  v_final  := ROUND(v_raw_percent * (1 - v_penalty / 100.0), 2);
  v_status := CASE WHEN v_has_manual THEN 'pending_manual_grade' ELSE 'graded' END;

  UPDATE public.quiz_attempts
  SET raw_points         = v_raw,
      max_points         = v_max,
      score_percent      = v_final,
      score              = ROUND(v_final),      -- legacy mirror
      is_late            = v_is_late,
      completed_at       = v_completed,
      time_taken_seconds = COALESCE(p_time_taken_seconds,
                                    GREATEST(0, EXTRACT(EPOCH FROM (v_completed - started_at))::integer)),
      status             = v_status,
      synced_at          = now(),
      graded_at          = CASE WHEN v_status = 'graded' THEN now() END
  WHERE id = v_attempt.id;

  -- XP and the grade book are only finalized for a fully-graded attempt.
  -- A pending_manual_grade attempt gets neither until the lecturer finishes,
  -- which is exactly why the leaderboard excludes it.
  IF v_status = 'graded' THEN
    PERFORM public.finalize_attempt(v_attempt.id);
  END IF;

  RETURN public.get_attempt_result(v_attempt.id);
END;
$function$;


-- ============================================
-- 3. Policies. Drop the LIVE names, then recreate the ones that change.
--    Policies that already use created_by / is_class_lecturer and are sound
--    are left in place (grades, quiz_answers, quiz_options, assignments,
--    class rosters, maze rooms, notifications, push tokens).
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Lecturers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Auth admin reads profiles for JWT hook" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Lecturers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_lecturer());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Auth admin reads profiles for JWT hook" ON public.profiles
  FOR SELECT TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS "Lecturers can manage own classes" ON public.classes;
CREATE POLICY "Lecturers can manage own classes" ON public.classes
  FOR ALL TO authenticated
  USING (public.is_lecturer() AND lecturer_id = auth.uid())
  WITH CHECK (public.is_lecturer() AND lecturer_id = auth.uid());

DROP POLICY IF EXISTS "Lecturers can manage own folders" ON public.folders;
DROP POLICY IF EXISTS "Students can view folders" ON public.folders;
CREATE POLICY "Lecturers can manage own folders" ON public.folders
  FOR ALL TO authenticated
  USING (public.is_lecturer() AND lecturer_id = auth.uid())
  WITH CHECK (public.is_lecturer() AND lecturer_id = auth.uid());
CREATE POLICY "Students read folders of their lecturers" ON public.folders
  FOR SELECT TO authenticated
  USING (
    lecturer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = auth.uid()
        AND c.lecturer_id = folders.lecturer_id
    )
  );

DROP POLICY IF EXISTS "Everyone can view documents" ON public.documents;
DROP POLICY IF EXISTS "Lecturers can manage own documents" ON public.documents;
CREATE POLICY "Lecturers can manage own documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_lecturer() AND lecturer_id = auth.uid())
  WITH CHECK (public.is_lecturer() AND lecturer_id = auth.uid());
CREATE POLICY "Students read documents of their lecturers" ON public.documents
  FOR SELECT TO authenticated
  USING (
    lecturer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = auth.uid()
        AND c.lecturer_id = documents.lecturer_id
    )
  );

DROP POLICY IF EXISTS "Students can insert own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Lecturers can view all attempts" ON public.quiz_attempts;
CREATE POLICY "Lecturers can view all attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (public.is_lecturer());

DROP POLICY IF EXISTS "Lecturers can view all material views" ON public.material_views;
CREATE POLICY "Lecturers can view all material views" ON public.material_views
  FOR SELECT TO authenticated
  USING (public.is_lecturer());

DROP POLICY IF EXISTS "Lecturers can view all sessions" ON public.windows_simulation_sessions;
CREATE POLICY "Lecturers can view all sessions" ON public.windows_simulation_sessions
  FOR SELECT TO authenticated
  USING (public.is_lecturer());

-- Direct writes let a student set xp_earned, which compute_user_xp sums.
DROP POLICY IF EXISTS "Users manage own maze sessions" ON public.circuit_maze_sessions;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Lecturers manage announcements" ON public.announcements;
CREATE POLICY "Authenticated read announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Lecturers manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_lecturer())
  WITH CHECK (public.is_lecturer());

DROP POLICY IF EXISTS "Users read own game score" ON public.game_scores;
DROP POLICY IF EXISTS "Users insert own game score" ON public.game_scores;
DROP POLICY IF EXISTS "Users update own game score" ON public.game_scores;
CREATE POLICY "Users read own game score" ON public.game_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users insert own game score" ON public.game_scores
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own game score" ON public.game_scores
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. Private documents bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets
SET
  public = false,
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
  ]
WHERE id = 'documents';

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = ANY (ARRAY[
        'Anyone can upload documents',
        'Anyone can view documents',
        'Lecturers can delete own documents',
        'Lecturers can update own documents',
        'Lecturers upload own documents',
        'Lecturers update own documents',
        'Lecturers delete own documents',
        'Enrolled users read class documents'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Lecturers upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_lecturer()
      OR name LIKE (auth.uid()::text || '/avatar_%')
    )
  );

CREATE POLICY "Lecturers update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_lecturer()
      OR name LIKE (auth.uid()::text || '/avatar_%')
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_lecturer()
      OR name LIKE (auth.uid()::text || '/avatar_%')
    )
  );

CREATE POLICY "Lecturers delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_lecturer()
      OR name LIKE (auth.uid()::text || '/avatar_%')
    )
  );

CREATE POLICY "Enrolled users read class documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.class_students cs
        JOIN public.classes c ON c.id = cs.class_id
        WHERE cs.student_id = auth.uid()
          AND (storage.foldername(name))[1] = c.lecturer_id::text
      )
    )
  );

-- ============================================
-- 5. Search path on the three advisor warnings, plus per-function grants.
--    TRUNCATE ignores RLS, so it is revoked from anon and authenticated.
--    anon loses table DML. authenticated keeps its existing table grants
--    (grades, notifications, maze, and the rest stay reachable under RLS).
-- ============================================

DO $paths$
BEGIN
  IF to_regprocedure('public.xp_to_level(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.xp_to_level(integer) SET search_path = public';
  END IF;
  IF to_regprocedure('gamification.score_xp(text[],numeric[],integer[],integer[],numeric)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION gamification.score_xp(text[],numeric[],integer[],integer[],numeric) SET search_path = public, gamification';
  END IF;
END
$paths$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $defaults$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'supabase_admin default privileges were not changed: %', SQLERRM;
END
$defaults$;

-- Extra GRANTs do not remove the live grants on grades, notifications, maze, or
-- the other tables. They make a brand-new database usable by signed-in users.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.material_views TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.windows_simulation_sessions TO authenticated;
GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.game_scores TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;

GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;

DO $revoke$
DECLARE
  fn text;
  app_fns text[] := ARRAY[
    'public.assign_quiz_to_classes(uuid,uuid[],timestamptz,timestamptz,integer,numeric,integer)',
    'public.award_maze_xp(integer,boolean,integer)',
    'public.clear_grade_override(uuid)',
    'public.get_attempt_for_resume(uuid)',
    'public.get_attempt_result(uuid)',
    'public.get_gradebook_by_quiz(uuid)',
    'public.get_gradebook_by_student(uuid,uuid)',
    'public.get_leaderboard(uuid,text)',
    'public.get_manual_grading_queue(uuid)',
    'public.get_my_badges()',
    'public.get_my_class_quizzes()',
    'public.get_my_practice_quizzes()',
    'public.get_my_stats()',
    'public.get_quiz_for_offline(uuid,uuid)',
    'public.get_quiz_questions_for_attempt(uuid)',
    'public.get_students_with_emails()',
    'public.grade_attempt_answers(uuid,jsonb)',
    'public.is_class_lecturer(uuid)',
    'public.is_enrolled_in_class(uuid)',
    'public.is_lecturer()',
    'public.override_grade(uuid,numeric,text)',
    'public.register_push_token(text,text)',
    'public.replace_quiz_questions(uuid,jsonb)',
    'public.save_quiz(uuid,text,text,jsonb,uuid)',
    'public.set_assignment_published(uuid,boolean)',
    'public.set_question_gamification_settings(uuid,integer,text)',
    'public.start_quiz_attempt(uuid,uuid,uuid,jsonb,timestamptz,boolean)',
    'public.student_can_see_quiz(uuid)',
    'public.submit_attempt(uuid,jsonb,timestamptz,integer)',
    'public.submit_quiz_attempt(uuid,jsonb)',
    'public.sync_offline_attempts(jsonb)',
    'public.xp_to_level(integer)'
  ];
  internal_fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.caller_may_take_quiz(uuid)',
    'public.promote_to_lecturer(uuid)',
    'public.award_badges(uuid,uuid)',
    'public.enqueue_notification(uuid,text,text,text,jsonb,text)',
    'public.finalize_attempt(uuid)',
    'public.recompute_attempt_score(uuid)',
    'public.prevent_profile_privilege_change()',
    'public.profile_role_write_allowed()',
    'gamification.handle_new_profile()',
    'gamification.compute_attempt_xp(uuid)',
    'gamification.compute_user_xp(uuid)',
    'gamification.refresh_user_xp(uuid)',
    'gamification.score_xp(text[],numeric[],integer[],integer[],numeric)'
  ];
BEGIN
  FOREACH fn IN ARRAY app_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    ELSE
      RAISE NOTICE 'app function not on this database (left for the live project): %', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY internal_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;

  -- The auth trigger and the JWT hook run as supabase_auth_admin.
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin';
  END IF;
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin, service_role';
  END IF;
  IF to_regprocedure('public.promote_to_lecturer(uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.promote_to_lecturer(uuid) TO service_role';
  END IF;
  -- Signed-in profile updates fire these. They are not useful as RPCs
  -- (trigger / boolean helper) but EXECUTE is required to fire the trigger.
  IF to_regprocedure('public.prevent_profile_privilege_change()') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.prevent_profile_privilege_change() TO authenticated, service_role';
  END IF;
  IF to_regprocedure('public.profile_role_write_allowed()') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.profile_role_write_allowed() TO authenticated, service_role';
  END IF;
END
$revoke$;
