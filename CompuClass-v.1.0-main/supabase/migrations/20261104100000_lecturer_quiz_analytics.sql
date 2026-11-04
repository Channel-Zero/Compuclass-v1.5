-- Lecturer quiz analytics. Not applied to the live database.
-- Apply this file in the Supabase SQL editor or with supabase db push.
-- Do not apply it twice by hand if it is already recorded in
-- supabase_migrations.schema_migrations.
--
-- Adds a question topic, stores each submitted answer, and limits lecturers
-- to students in their own classes. Students still only read their own rows.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_lecturer()') IS NULL THEN
    RAISE EXCEPTION 'public.is_lecturer() is missing. Refusing to add quiz analytics.';
  END IF;
  IF to_regclass('public.quiz_attempts') IS NULL OR to_regclass('public.quiz_questions') IS NULL THEN
    RAISE EXCEPTION 'quiz tables are missing. Refusing to add quiz analytics.';
  END IF;
END $$;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS topic text;

ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_topic_length;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_topic_length
  CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 80);

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS class_id uuid;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.quiz_attempts
SET status = 'graded'
WHERE status IS NULL;

ALTER TABLE public.quiz_attempts
  ALTER COLUMN status SET DEFAULT 'graded';

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_class ON public.quiz_attempts(class_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_topic ON public.quiz_questions(topic);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'quiz_options'
      AND pol.polname = 'Quiz owner manages options'
  ) THEN
    CREATE POLICY "Quiz owner manages options"
      ON public.quiz_options
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.quiz_questions qq
          JOIN public.quizzes q ON q.id = qq.quiz_id
          WHERE qq.id = quiz_options.question_id
            AND q.created_by = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.quiz_questions qq
          JOIN public.quizzes q ON q.id = qq.quiz_id
          WHERE qq.id = quiz_options.question_id
            AND q.created_by = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id uuid REFERENCES public.quiz_options(id) ON DELETE SET NULL,
  short_answer_text text,
  is_correct boolean,
  points_awarded numeric,
  time_remaining_seconds integer,
  manual_grade_note text,
  graded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  answered_at timestamptz DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON public.quiz_answers(question_id);

ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Class lecturer reads answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Readers of an attempt can read its answers" ON public.quiz_answers;
CREATE POLICY "Readers of an attempt can read its answers"
  ON public.quiz_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempts a
      WHERE a.id = quiz_answers.attempt_id
    )
  );

REVOKE ALL ON TABLE public.quiz_answers FROM anon;
GRANT SELECT ON TABLE public.quiz_answers TO authenticated;

-- The previous lecturer policy let every lecturer read every attempt.
DROP POLICY IF EXISTS "Lecturers can view all attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Lecturers view attempts in their classes" ON public.quiz_attempts;
CREATE POLICY "Lecturers view attempts in their classes"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    public.is_lecturer()
    AND EXISTS (
      SELECT 1
      FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = quiz_attempts.user_id
        AND c.lecturer_id = (SELECT auth.uid())
        AND (
          quiz_attempts.class_id = c.id
          OR EXISTS (
            SELECT 1
            FROM public.quiz_assignments asg
            WHERE asg.quiz_id = quiz_attempts.quiz_id
              AND asg.class_id = c.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.quizzes q
            WHERE q.id = quiz_attempts.quiz_id
              AND q.created_by = (SELECT auth.uid())
          )
        )
    )
  );

-- Practice quizzes used to 400 when the app sent type "multiple-choice".
-- Accept that label here as well, in case an older client is still open.
CREATE OR REPLACE FUNCTION public.save_quiz(p_quiz_id uuid, p_title text, p_type text, p_questions jsonb, p_folder_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_role    text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF btrim(COALESCE(p_title, '')) = '' THEN RAISE EXCEPTION 'A title is required'; END IF;
  IF char_length(btrim(p_title)) > 200 THEN RAISE EXCEPTION 'Title is too long (200 characters max)'; END IF;
  IF p_type NOT IN ('class','practice') THEN RAISE EXCEPTION 'Unknown quiz type'; END IF;
  IF jsonb_array_length(COALESCE(p_questions, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Add at least one question';
  END IF;
  IF jsonb_array_length(p_questions) > 100 THEN
    RAISE EXCEPTION 'A quiz can have at most 100 questions';
  END IF;

  IF p_type = 'class' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS DISTINCT FROM 'lecturer' THEN
      RAISE EXCEPTION 'Only lecturers can create class quizzes';
    END IF;
  END IF;

  IF p_type = 'practice' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_questions) q
    WHERE CASE lower(btrim(COALESCE(q ->> 'type', 'mcq')))
            WHEN '' THEN 'mcq'
            WHEN 'multiple-choice' THEN 'mcq'
            WHEN 'multiple_choice' THEN 'mcq'
            WHEN 'true/false' THEN 'true_false'
            WHEN 'true-false' THEN 'true_false'
            WHEN 'boolean' THEN 'true_false'
            ELSE lower(btrim(COALESCE(q ->> 'type', 'mcq')))
          END NOT IN ('mcq','true_false')
  ) THEN
    RAISE EXCEPTION 'Practice quizzes can only use multiple-choice and true/false questions';
  END IF;

  IF p_quiz_id IS NULL THEN
    INSERT INTO public.quizzes (title, type, created_by, folder_id, passing_score)
    VALUES (btrim(p_title), p_type, v_user_id, p_folder_id, 70)
    RETURNING id INTO v_quiz_id;
  ELSE
    UPDATE public.quizzes
    SET title = btrim(p_title), updated_at = now()
    WHERE id = p_quiz_id AND created_by = v_user_id AND type = p_type
    RETURNING id INTO v_quiz_id;
    IF v_quiz_id IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  END IF;

  PERFORM public.replace_quiz_questions(v_quiz_id, p_questions);
  RETURN v_quiz_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.replace_quiz_questions(p_quiz_id uuid, p_questions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner   uuid;
  v_item    jsonb;
  v_idx     integer := 0;
  v_qid     uuid;
  v_type    text;
  v_opt     jsonb;
  v_oidx    integer;
  v_correct integer;
  v_topic   text;
BEGIN
  SELECT created_by INTO v_owner FROM public.quizzes WHERE id = p_quiz_id;
  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Not authorized to edit this quiz';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = p_quiz_id AND status IS DISTINCT FROM 'rejected'
  ) THEN
    RAISE EXCEPTION 'This quiz already has attempts and its questions can no longer be changed';
  END IF;

  DELETE FROM public.quiz_questions WHERE quiz_id = p_quiz_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    v_type := CASE lower(btrim(COALESCE(v_item ->> 'type', 'mcq')))
                WHEN '' THEN 'mcq'
                WHEN 'multiple-choice' THEN 'mcq'
                WHEN 'multiple_choice' THEN 'mcq'
                WHEN 'true/false' THEN 'true_false'
                WHEN 'true-false' THEN 'true_false'
                WHEN 'boolean' THEN 'true_false'
                ELSE lower(btrim(COALESCE(v_item ->> 'type', 'mcq')))
              END;
    v_topic := NULLIF(left(btrim(COALESCE(v_item ->> 'topic', '')), 80), '');

    -- Older clients send a string array plus correct_answer. The grader
    -- reads option objects with option_text and is_correct.
    IF jsonb_typeof(v_item -> 'options') = 'array' AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_item -> 'options', '[]'::jsonb)) opt
      WHERE jsonb_typeof(opt) <> 'object'
    ) THEN
      v_item := jsonb_set(
        v_item,
        '{options}',
        COALESCE((
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(opt) = 'object' THEN opt
              ELSE jsonb_build_object(
                'option_text', opt #>> '{}',
                'is_correct', (opt #>> '{}') IS NOT DISTINCT FROM NULLIF(btrim(v_item ->> 'correct_answer'), '')
                  AND NULLIF(btrim(v_item ->> 'correct_answer'), '') IS NOT NULL
              )
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(v_item -> 'options') WITH ORDINALITY AS listed(opt, ord)
        ), '[]'::jsonb)
      );
    END IF;

    IF btrim(COALESCE(v_item ->> 'question', '')) = '' THEN
      RAISE EXCEPTION 'Question %: text is required', v_idx + 1;
    END IF;
    IF v_type = 'image_based' AND NULLIF(v_item ->> 'image_url', '') IS NULL THEN
      RAISE EXCEPTION 'Question %: an image is required for an image-based question', v_idx + 1;
    END IF;

    INSERT INTO public.quiz_questions (
      quiz_id, question, type, points, image_url, order_index, topic,
      options, correct_answer
    ) VALUES (
      p_quiz_id,
      btrim(v_item ->> 'question'),
      v_type,
      COALESCE(NULLIF(v_item ->> 'points', '')::numeric, 1),
      NULLIF(v_item ->> 'image_url', ''),
      v_idx,
      v_topic,
      COALESCE((SELECT jsonb_agg(o ->> 'option_text')
                FROM jsonb_array_elements(COALESCE(v_item -> 'options', '[]'::jsonb)) o),
               '[]'::jsonb),
      COALESCE((SELECT o ->> 'option_text'
                FROM jsonb_array_elements(COALESCE(v_item -> 'options', '[]'::jsonb)) o
                WHERE (o ->> 'is_correct')::boolean LIMIT 1), '')
    )
    RETURNING id INTO v_qid;

    IF v_type IN ('mcq','true_false') THEN
      v_oidx := 0;
      v_correct := 0;
      FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_item -> 'options', '[]'::jsonb))
      LOOP
        INSERT INTO public.quiz_options (question_id, option_text, is_correct, order_index)
        VALUES (
          v_qid,
          COALESCE(v_opt ->> 'option_text', ''),
          COALESCE((v_opt ->> 'is_correct')::boolean, false),
          v_oidx
        );
        IF COALESCE((v_opt ->> 'is_correct')::boolean, false) THEN
          v_correct := v_correct + 1;
        END IF;
        v_oidx := v_oidx + 1;
      END LOOP;

      IF v_oidx < 2 THEN
        RAISE EXCEPTION 'Question %: needs at least two options', v_idx + 1;
      END IF;
      IF v_correct <> 1 THEN
        RAISE EXCEPTION 'Question %: mark exactly one correct option (found %)', v_idx + 1, v_correct;
      END IF;
    END IF;

    IF (v_item ? 'difficulty') OR (v_item ? 'time_limit_seconds') THEN
      INSERT INTO gamification.quiz_question_settings (question_id, time_limit_seconds, difficulty)
      VALUES (
        v_qid,
        NULLIF(v_item ->> 'time_limit_seconds', '')::integer,
        COALESCE(NULLIF(v_item ->> 'difficulty', ''), 'medium')
      )
      ON CONFLICT (question_id) DO UPDATE
        SET time_limit_seconds = EXCLUDED.time_limit_seconds,
            difficulty = EXCLUDED.difficulty;
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.quizzes SET updated_at = now() WHERE id = p_quiz_id;
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

  -- class_id lets a lecturer read this attempt through the class policy.
  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, class_id)
  VALUES (
    v_user_id,
    p_quiz_id,
    v_percentage,
    (
      SELECT cs.class_id
      FROM public.quiz_assignments asg
      JOIN public.class_students cs
        ON cs.class_id = asg.class_id
       AND cs.student_id = v_user_id
      WHERE asg.quiz_id = p_quiz_id
      ORDER BY cs.joined_at NULLS LAST, cs.class_id
      LIMIT 1
    )
  )
  RETURNING id INTO v_attempt_id;

  -- One stored row per question. The label the student sent is matched to an
  -- option when quiz_options has that text, otherwise to correct_answer.
  INSERT INTO public.quiz_answers (
    attempt_id, question_id, selected_option_id, short_answer_text,
    is_correct, points_awarded, time_remaining_seconds, answered_at, graded_at
  )
  SELECT
    v_attempt_id,
    qq.id,
    opt.id,
    CASE WHEN opt.id IS NULL THEN NULLIF(ans.elem ->> 'selected_answer', '') END,
    CASE
      WHEN ans.elem IS NULL THEN false
      WHEN opt.id IS NOT NULL THEN opt.is_correct
      WHEN NULLIF(ans.elem ->> 'selected_answer', '') IS NOT DISTINCT FROM NULLIF(qq.correct_answer, '')
        AND NULLIF(qq.correct_answer, '') IS NOT NULL THEN true
      ELSE false
    END,
    CASE
      WHEN ans.elem IS NOT NULL AND opt.id IS NOT NULL AND opt.is_correct THEN qq.points
      WHEN ans.elem IS NOT NULL
        AND opt.id IS NULL
        AND NULLIF(ans.elem ->> 'selected_answer', '') IS NOT DISTINCT FROM NULLIF(qq.correct_answer, '')
        AND NULLIF(qq.correct_answer, '') IS NOT NULL THEN qq.points
      ELSE 0
    END,
    CASE
      WHEN ans.elem IS NULL THEN NULL
      WHEN COALESCE(ans.elem ->> 'time_remaining_seconds', '') ~ '^-?[0-9]+

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
        THEN (ans.elem ->> 'time_remaining_seconds')::integer
      ELSE NULL
    END,
    now(),
    now()
  FROM public.quiz_questions qq
  LEFT JOIN LATERAL (
    SELECT elem
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) elem
    WHERE elem ->> 'question_id' = qq.id::text
    LIMIT 1
  ) ans ON true
  LEFT JOIN LATERAL (
    SELECT o.id, o.is_correct
    FROM public.quiz_options o
    WHERE ans.elem IS NOT NULL
      AND o.question_id = qq.id
      AND o.option_text = ans.elem ->> 'selected_answer'
    ORDER BY o.order_index
    LIMIT 1
  ) opt ON true
  WHERE qq.quiz_id = p_quiz_id
  ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET selected_option_id = EXCLUDED.selected_option_id,
        short_answer_text = EXCLUDED.short_answer_text,
        is_correct = EXCLUDED.is_correct,
        points_awarded = EXCLUDED.points_awarded,
        time_remaining_seconds = EXCLUDED.time_remaining_seconds,
        answered_at = EXCLUDED.answered_at,
        graded_at = EXCLUDED.graded_at;

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
CREATE OR REPLACE FUNCTION public.get_lecturer_quiz_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_lecturer() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'quizzes', COALESCE(jsonb_agg(quiz_row ORDER BY quiz_row ->> 'title'), '[]'::jsonb)
    )
    FROM (
      SELECT jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'passing_score', q.passing_score,
        'questions', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', qq.id,
            'question', qq.question,
            'topic', NULLIF(btrim(qq.topic), ''),
            'order_index', qq.order_index
          ) ORDER BY qq.order_index), '[]'::jsonb)
          FROM public.quiz_questions qq
          WHERE qq.quiz_id = q.id
        ),
        'attempts', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', a.id,
            'user_id', a.user_id,
            'full_name', COALESCE(NULLIF(btrim(p.full_name), ''), 'Student'),
            'score', a.score,
            'completed_at', a.completed_at,
            'answers', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'question_id', ans.question_id,
                'is_correct', ans.is_correct,
                'selected', COALESCE(o.option_text, ans.short_answer_text),
                'correct', COALESCE(
                  (
                    SELECT co.option_text
                    FROM public.quiz_options co
                    WHERE co.question_id = ans.question_id
                      AND co.is_correct
                    ORDER BY co.order_index
                    LIMIT 1
                  ),
                  NULLIF(qq.correct_answer, '')
                )
              )), '[]'::jsonb)
              FROM public.quiz_answers ans
              JOIN public.quiz_questions qq ON qq.id = ans.question_id
              LEFT JOIN public.quiz_options o ON o.id = ans.selected_option_id
              WHERE ans.attempt_id = a.id
            )
          ) ORDER BY a.completed_at), '[]'::jsonb)
          FROM public.quiz_attempts a
          JOIN public.profiles p ON p.id = a.user_id
          WHERE a.quiz_id = q.id
            AND a.score IS NOT NULL
            AND a.status IS DISTINCT FROM 'rejected'
            AND EXISTS (
              SELECT 1
              FROM public.class_students cs
              JOIN public.classes c ON c.id = cs.class_id
              WHERE cs.student_id = a.user_id
                AND c.lecturer_id = v_user
                AND (
                  a.class_id = c.id
                  OR EXISTS (
                    SELECT 1 FROM public.quiz_assignments asg
                    WHERE asg.quiz_id = a.quiz_id AND asg.class_id = c.id
                  )
                  OR q.created_by = v_user
                )
            )
        )
      ) AS quiz_row
      FROM public.quizzes q
      WHERE q.created_by = v_user
         OR EXISTS (
           SELECT 1
           FROM public.quiz_assignments asg
           JOIN public.classes c ON c.id = asg.class_id
           WHERE asg.quiz_id = q.id
             AND c.lecturer_id = v_user
         )
    ) listed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_lecturer_quiz_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lecturer_quiz_analytics() TO authenticated;

COMMIT;
