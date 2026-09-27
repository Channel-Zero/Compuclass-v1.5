-- CompuClass Database Setup Script
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table (for organizing course content)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lecturer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (PDFs, PowerPoints, etc.)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz questions table
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lecturer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class students junction table
CREATE TABLE class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Quiz assignments table (assigns quizzes to classes)
CREATE TABLE quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quiz_id, class_id)
);

-- Quiz attempts table (tracks student quiz submissions)
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material views table (tracks document views)
CREATE TABLE material_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX idx_folders_lecturer ON folders(lecturer_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_lecturer ON documents(lecturer_id);
CREATE INDEX idx_quizzes_folder ON quizzes(folder_id);
CREATE INDEX idx_quizzes_lecturer ON quizzes(lecturer_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_classes_lecturer ON classes(lecturer_id);
CREATE INDEX idx_class_students_class ON class_students(class_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_quiz_assignments_quiz ON quiz_assignments(quiz_id);
CREATE INDEX idx_quiz_assignments_class ON quiz_assignments(class_id);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_material_views_user ON material_views(user_id);
CREATE INDEX idx_material_views_document ON material_views(document_id);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_views ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Lecturers can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
);

-- Folders policies
CREATE POLICY "Lecturers can manage own folders" ON folders FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Students can view folders" ON folders FOR SELECT USING (true);

-- Documents policies
CREATE POLICY "Everyone can view documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage own documents" ON documents FOR ALL USING (auth.uid() = lecturer_id);

-- Quizzes policies
CREATE POLICY "Everyone can view quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage own quizzes" ON quizzes FOR ALL USING (auth.uid() = lecturer_id);

-- Quiz questions policies
CREATE POLICY "Everyone can view quiz questions" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage quiz questions" ON quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM quizzes WHERE id = quiz_questions.quiz_id AND lecturer_id = auth.uid())
);

-- Classes policies
CREATE POLICY "Lecturers can manage own classes" ON classes FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Students can view classes they belong to" ON classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM class_students WHERE class_id = classes.id AND student_id = auth.uid())
);

-- Class students policies
CREATE POLICY "Lecturers can manage class students" ON class_students FOR ALL USING (
  EXISTS (SELECT 1 FROM classes WHERE id = class_students.class_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Students can view class memberships" ON class_students FOR SELECT USING (
  student_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM classes WHERE id = class_students.class_id AND lecturer_id = auth.uid())
);

-- Quiz assignments policies
CREATE POLICY "Lecturers can manage quiz assignments" ON quiz_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM classes WHERE id = quiz_assignments.class_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Students can view assigned quizzes" ON quiz_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM class_students WHERE class_id = quiz_assignments.class_id AND student_id = auth.uid())
);

-- Quiz attempts policies
CREATE POLICY "Students can view own attempts" ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can insert own attempts" ON quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Lecturers can view all attempts" ON quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
);

-- Material views policies
CREATE POLICY "Students can view own material views" ON material_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can insert own material views" ON material_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Lecturers can view all material views" ON material_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
);

-- ============================================
-- 5. CREATE STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. CREATE STORAGE POLICIES
-- ============================================

CREATE POLICY "Anyone can upload documents" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view documents" ON storage.objects 
FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Lecturers can delete own documents" ON storage.objects 
FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Lecturers can update own documents" ON storage.objects 
FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- ============================================
-- 7. CREATE FUNCTIONS
-- ============================================

-- Function to get students with emails
CREATE OR REPLACE FUNCTION get_students_with_emails()
RETURNS TABLE (
  id UUID, 
  full_name TEXT, 
  email VARCHAR(255), 
  role TEXT, 
  created_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.full_name, 
    u.email::VARCHAR(255), 
    p.role, 
    p.created_at
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.role = 'student'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.email = 'lecturer@compuclass.com' THEN 'lecturer'
      ELSE 'student'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- 9. GAMIFICATION
-- ============================================
-- XP, levels, daily streaks, badges, leaderboard, and per-question
-- timers/difficulty.
--
-- Design notes:
--
--  * Everything lives in its own `gamification` schema. public.quiz_attempts
--    keeps its original shape — extended per-attempt stats go in
--    gamification.quiz_attempt_stats, joined on attempt_id.
--
--  * quiz_attempt_stats and quiz_question_settings have RLS enabled with NO
--    policies. That is deliberate deny-all: clients never touch them directly,
--    only the SECURITY DEFINER functions below do.
--
--  * Grading happens server-side in submit_quiz_attempt. The client fetches
--    questions through get_quiz_questions_for_attempt, which omits
--    correct_answer, so answers cannot be read out of the network response.
--
--  * MANUAL STEP: public.custom_access_token_hook must also be registered in
--    the Supabase dashboard under Authentication > Hooks (Custom Access Token).
--    Creating the function here is not sufficient — that wiring lives in
--    project config, not SQL.

CREATE SCHEMA IF NOT EXISTS gamification;

-- --------------------------------------------
-- 9.1 Tables
-- --------------------------------------------

-- Per-user XP, level and streak counters
CREATE TABLE IF NOT EXISTS gamification.user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badge catalog (seeded below)
CREATE TABLE IF NOT EXISTS gamification.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'trophy',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Which user earned which badge
CREATE TABLE IF NOT EXISTS gamification.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES gamification.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

-- Optional per-question timer and difficulty, set by the lecturer
CREATE TABLE IF NOT EXISTS gamification.quiz_question_settings (
  question_id UUID PRIMARY KEY REFERENCES quiz_questions(id) ON DELETE CASCADE,
  time_limit_seconds INTEGER,
  difficulty TEXT DEFAULT 'medium'
    CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))
);

-- Extended stats for a quiz attempt, 1:1 with public.quiz_attempts
CREATE TABLE IF NOT EXISTS gamification.quiz_attempt_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID UNIQUE REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER,
  total_questions INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON gamification.user_badges USING btree (user_id);

-- --------------------------------------------
-- 9.2 Row Level Security
-- --------------------------------------------

ALTER TABLE gamification.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.quiz_question_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.quiz_attempt_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own stats" ON gamification.user_stats;
CREATE POLICY "Users can view own stats" ON gamification.user_stats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Everyone can view badge catalog" ON gamification.badges;
CREATE POLICY "Everyone can view badge catalog" ON gamification.badges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own badges" ON gamification.user_badges;
CREATE POLICY "Users can view own badges" ON gamification.user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- No policies on quiz_question_settings or quiz_attempt_stats by design.
-- RLS is on with nothing granted, so direct client access is denied and all
-- reads/writes must go through the SECURITY DEFINER functions below.

-- --------------------------------------------
-- 9.3 Badge catalog
-- --------------------------------------------

INSERT INTO gamification.badges (code, name, description, icon) VALUES
  ('first_quiz',    'First Steps',       'Complete your first quiz',  'flag'),
  ('perfect_score', 'Perfectionist',     'Score 100% on a quiz',      'star'),
  ('streak_3',      'Getting Warmed Up', 'Reach a 3-day streak',      'flame'),
  ('streak_7',      'On Fire',           'Reach a 7-day streak',      'flame'),
  ('combo_5',       'Combo Breaker',     'Hit a 5-question combo',    'flash'),
  ('quiz_master',   'Quiz Master',       'Complete 10 quizzes',       'trophy')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------
-- 9.4 Functions
-- --------------------------------------------

-- Level curve: level N requires 100 * N * (N+1) / 2 total XP.
-- Level 1 -> 100 XP, level 2 -> 300, level 3 -> 600, ...
CREATE OR REPLACE FUNCTION public.xp_to_level(p_xp integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  lvl INTEGER := 1;
BEGIN
  WHILE (100 * lvl * (lvl + 1) / 2) <= p_xp LOOP
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$function$;

-- Injects profiles.role into the JWT so the client can read it from claims.
-- Requires manual registration under Authentication > Hooks (see note above).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;
  claims := event->'claims';
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{role}', '"student"');
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;

-- Current user's XP, level, streaks, and the XP thresholds either side of
-- their current level (used to draw the progress bar on Profile).
CREATE OR REPLACE FUNCTION public.get_my_stats()
 RETURNS TABLE(xp integer, level integer, current_streak integer, longest_streak integer, xp_for_current_level integer, xp_for_next_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Covers users who existed before the backfill below, just in case
  INSERT INTO gamification.user_stats (user_id) VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    s.xp, s.level, s.current_streak, s.longest_streak,
    (100 * (s.level - 1) * s.level / 2) AS xp_for_current_level,
    (100 * s.level * (s.level + 1) / 2) AS xp_for_next_level
  FROM gamification.user_stats s
  WHERE s.user_id = v_user_id;
END;
$function$;

-- Full badge catalog with an `earned` flag for the current user, so the UI
-- can show locked badges alongside unlocked ones.
CREATE OR REPLACE FUNCTION public.get_my_badges()
 RETURNS TABLE(code text, name text, description text, icon text, earned boolean, earned_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT b.code, b.name, b.description, b.icon,
         (ub.id IS NOT NULL) AS earned, ub.earned_at
  FROM gamification.badges b
  LEFT JOIN gamification.user_badges ub ON ub.badge_id = b.id AND ub.user_id = auth.uid()
  ORDER BY earned DESC, b.name;
END;
$function$;

-- Top 100 students by XP. NULL p_class_id = global, otherwise scoped to a class.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_class_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, full_name text, xp integer, level integer, current_streak integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_class_id IS NULL THEN
    RETURN QUERY
    SELECT p.id, p.full_name, s.xp, s.level, s.current_streak
    FROM public.profiles p
    JOIN gamification.user_stats s ON s.user_id = p.id
    WHERE p.role = 'student'
    ORDER BY s.xp DESC
    LIMIT 100;
  ELSE
    RETURN QUERY
    SELECT p.id, p.full_name, s.xp, s.level, s.current_streak
    FROM public.profiles p
    JOIN gamification.user_stats s ON s.user_id = p.id
    JOIN public.class_students cs ON cs.student_id = p.id
    WHERE cs.class_id = p_class_id
    ORDER BY s.xp DESC
    LIMIT 100;
  END IF;
END;
$function$;

-- Questions for a quiz attempt. Deliberately omits correct_answer so the
-- client cannot read the answers out of the response.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_attempt(p_quiz_id uuid)
 RETURNS TABLE(id uuid, question text, options jsonb, order_index integer, time_limit_seconds integer, difficulty text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT q.id, q.question, q.options, q.order_index,
         qs.time_limit_seconds, COALESCE(qs.difficulty, 'medium')
  FROM public.quiz_questions q
  LEFT JOIN gamification.quiz_question_settings qs ON qs.question_id = q.id
  WHERE q.quiz_id = p_quiz_id
  ORDER BY q.order_index;
END;
$function$;

-- Lecturer-only: set the timer/difficulty for one question they own.
CREATE OR REPLACE FUNCTION public.set_question_gamification_settings(p_question_id uuid, p_time_limit_seconds integer, p_difficulty text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  SELECT qz.lecturer_id INTO v_owner
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

-- Grades an attempt and awards XP, combos, streaks and badges in one pass.
--
-- XP model:
--   * Base XP per correct answer by difficulty: easy 5, medium 10, hard 15.
--     Medium is the default, so content authored before difficulty existed is
--     unaffected.
--   * That base is multiplied by a combo bonus that rises 0.2x every 3
--     consecutive correct answers, capped at 2.0x
--   * +5 speed bonus if answered with more than half the time limit left
--   * +20 for completing the quiz, +50 more for scoring 90% or above
--
-- Retries: a quiz is worth its best-ever attempt, once. Each submission is
-- valued on its own merits, then only the improvement over the user's previous
-- best on that quiz is added to their total. Beating your best pays the
-- difference; matching or falling short pays nothing. Without this a student
-- could replay one quiz indefinitely and top the leaderboard by grinding.
--
-- Streaks: same-day replays don't change the streak, a next-day attempt
-- extends it, any longer gap resets it to 1. A zero-XP retake still counts as
-- activity for streak purposes — the student did show up.
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

-- --------------------------------------------
-- 9.5 Give every profile a stats row
-- --------------------------------------------
-- Signup chain: auth.users insert -> handle_new_user() creates the profile
-- -> this trigger creates the matching user_stats row.

CREATE OR REPLACE FUNCTION gamification.handle_new_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gamification'
AS $function$
BEGIN
  INSERT INTO gamification.user_stats (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_profile_created_init_stats ON public.profiles;
CREATE TRIGGER on_profile_created_init_stats
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION gamification.handle_new_profile();

-- Backfill for profiles that already exist
INSERT INTO gamification.user_stats (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- --------------------------------------------
-- 9.6 Grants
-- --------------------------------------------

GRANT EXECUTE ON FUNCTION public.xp_to_level(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_badges() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_attempt(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_question_gamification_settings(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO anon, authenticated;

-- The auth hook is called by GoTrue, not by clients. Keep it off anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin, service_role;

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- Your database is now ready!
-- Next steps:
-- 1. Update your .env file with Supabase credentials
-- 2. Create test accounts through your app
-- 3. Use lecturer@compuclass.com for lecturer access
-- 4. Register the custom access token hook:
--    Dashboard > Authentication > Hooks > Custom Access Token
--    -> select public.custom_access_token_hook
