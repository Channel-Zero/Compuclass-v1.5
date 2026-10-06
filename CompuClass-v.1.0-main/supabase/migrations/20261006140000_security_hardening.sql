-- Idempotent security hardening for an EXISTING CompuClass project.
-- Run this once in the Supabase SQL Editor (or `supabase db query`).
-- Do not re-run supabase-setup.sql on a database that already has tables.
--
-- After this script:
--   * New signups are always students. Promote a lecturer from the SQL editor:
--       UPDATE public.profiles SET role = 'lecturer' WHERE id = '<user-uuid>';
--   * Quiz answers are not readable by students. Grading goes through
--     public.submit_quiz_attempt.
--   * The documents bucket is private (20 MB, limited MIME types).

-- ============================================
-- 1. SCHEMA ADDITIONS
-- ============================================

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS question_count integer NOT NULL DEFAULT 0;

UPDATE public.quiz_attempts
SET score = LEAST(100, GREATEST(0, score))
WHERE score < 0 OR score > 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_score_range'
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_score_range CHECK (score BETWEEN 0 AND 100);
  END IF;
END $$;

DELETE FROM public.material_views a
USING public.material_views b
WHERE a.user_id = b.user_id
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

CREATE TABLE IF NOT EXISTS public.windows_simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.windows_simulation_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_windows_sessions_user ON public.windows_simulation_sessions(user_id);

-- ============================================
-- 2. HELPER / TRIGGER FUNCTIONS
-- ============================================

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

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
       AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
      RAISE EXCEPTION 'profile id and role cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_change ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_change();

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
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_quiz_question_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz uuid;
BEGIN
  v_quiz := COALESCE(NEW.quiz_id, OLD.quiz_id);
  UPDATE public.quizzes
  SET question_count = (
    SELECT count(*) FROM public.quiz_questions WHERE quiz_id = v_quiz
  )
  WHERE id = v_quiz;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_quiz_question_count ON public.quiz_questions;
CREATE TRIGGER sync_quiz_question_count
  AFTER INSERT OR DELETE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.sync_quiz_question_count();

UPDATE public.quizzes q
SET question_count = (
  SELECT count(*) FROM public.quiz_questions qq WHERE qq.quiz_id = q.id
);

-- ============================================
-- 3. QUIZ + STUDENT RPCS
-- ============================================

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
  IF NOT public.is_lecturer() THEN
    RAISE EXCEPTION 'not authorized';
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

CREATE OR REPLACE FUNCTION public.get_quiz_for_student(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_quiz public.quizzes%ROWTYPE;
  v_questions jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    JOIN public.class_students cs ON cs.class_id = qa.class_id
    WHERE qa.quiz_id = p_quiz_id AND cs.student_id = v_user
  ) THEN
    RAISE EXCEPTION 'quiz is not assigned to you';
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz not found';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', qq.id,
    'question', qq.question,
    'options', qq.options,
    'order_index', qq.order_index
  ) ORDER BY qq.order_index), '[]'::jsonb)
  INTO v_questions
  FROM public.quiz_questions qq
  WHERE qq.quiz_id = p_quiz_id;

  RETURN jsonb_build_object(
    'id', v_quiz.id,
    'title', v_quiz.title,
    'description', v_quiz.description,
    'passing_score', v_quiz.passing_score,
    'question_count', v_quiz.question_count,
    'questions', v_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_total integer;
  v_correct integer := 0;
  v_score integer;
  v_passing integer;
  v_review jsonb := '[]'::jsonb;
  r record;
  v_selected text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    JOIN public.class_students cs ON cs.class_id = qa.class_id
    WHERE qa.quiz_id = p_quiz_id AND cs.student_id = v_user
  ) THEN
    RAISE EXCEPTION 'quiz is not assigned to you';
  END IF;

  SELECT passing_score INTO v_passing FROM public.quizzes WHERE id = p_quiz_id;
  IF v_passing IS NULL THEN
    RAISE EXCEPTION 'quiz not found';
  END IF;

  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE quiz_id = p_quiz_id;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'quiz has no questions';
  END IF;

  FOR r IN
    SELECT id, question, options, correct_answer, order_index
    FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id
    ORDER BY order_index
  LOOP
    SELECT a.value ->> 'selected' INTO v_selected
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) AS a(value)
    WHERE a.value ->> 'questionId' = r.id::text
    LIMIT 1;

    IF v_selected IS NOT NULL AND v_selected = r.correct_answer THEN
      v_correct := v_correct + 1;
    END IF;

    v_review := v_review || jsonb_build_array(jsonb_build_object(
      'questionId', r.id,
      'question', r.question,
      'selected', v_selected,
      'correctAnswer', r.correct_answer,
      'isCorrect', v_selected IS NOT NULL AND v_selected = r.correct_answer
    ));
  END LOOP;

  v_score := round((v_correct::numeric / v_total) * 100);

  INSERT INTO public.quiz_attempts (user_id, quiz_id, score)
  VALUES (v_user, p_quiz_id, v_score);

  RETURN jsonb_build_object(
    'score', v_score,
    'passed', v_score >= v_passing,
    'passingScore', v_passing,
    'correct', v_correct,
    'total', v_total,
    'review', v_review
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_to_lecturer(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles SET role = 'lecturer' WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
END;
$$;

-- ============================================
-- 4. REPLACE RLS POLICIES
-- ============================================

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'folders', 'documents', 'quizzes', 'quiz_questions',
        'classes', 'class_students', 'quiz_assignments', 'quiz_attempts',
        'material_views', 'windows_simulation_sessions'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Lecturers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_lecturer());

CREATE POLICY "Users can insert own student profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Lecturers manage own folders" ON public.folders
  FOR ALL TO authenticated
  USING (lecturer_id = auth.uid() AND public.is_lecturer())
  WITH CHECK (lecturer_id = auth.uid() AND public.is_lecturer());

CREATE POLICY "Students read folders of their lecturers" ON public.folders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.class_students cs ON cs.class_id = c.id
      WHERE c.lecturer_id = folders.lecturer_id
        AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers manage own documents" ON public.documents
  FOR ALL TO authenticated
  USING (lecturer_id = auth.uid() AND public.is_lecturer())
  WITH CHECK (lecturer_id = auth.uid() AND public.is_lecturer());

CREATE POLICY "Students read documents of their lecturers" ON public.documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.class_students cs ON cs.class_id = c.id
      WHERE c.lecturer_id = documents.lecturer_id
        AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers manage own quizzes" ON public.quizzes
  FOR ALL TO authenticated
  USING (lecturer_id = auth.uid() AND public.is_lecturer())
  WITH CHECK (lecturer_id = auth.uid() AND public.is_lecturer());

CREATE POLICY "Students read assigned quizzes" ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_assignments qa
      JOIN public.class_students cs ON cs.class_id = qa.class_id
      WHERE qa.quiz_id = quizzes.id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers read own quiz questions" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id AND q.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers insert own quiz questions" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id AND q.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers update own quiz questions" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id AND q.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id AND q.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers delete own quiz questions" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id AND q.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers manage own classes" ON public.classes
  FOR ALL TO authenticated
  USING (lecturer_id = auth.uid() AND public.is_lecturer())
  WITH CHECK (lecturer_id = auth.uid() AND public.is_lecturer());

CREATE POLICY "Students read enrolled classes" ON public.classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = classes.id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers manage own class rosters" ON public.class_students
  FOR ALL TO authenticated
  USING (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students read own memberships" ON public.class_students
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Lecturers manage own quiz assignments" ON public.quiz_assignments
  FOR ALL TO authenticated
  USING (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = quiz_assignments.class_id AND c.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = quiz_assignments.class_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students read own quiz assignments" ON public.quiz_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = quiz_assignments.class_id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Students read own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Lecturers read attempts of their students" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = quiz_attempts.user_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students read own material views" ON public.material_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students insert own material views" ON public.material_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students update own material views" ON public.material_views
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Lecturers read material views of their students" ON public.material_views
  FOR SELECT TO authenticated
  USING (
    public.is_lecturer() AND EXISTS (
      SELECT 1 FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = material_views.user_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own windows sessions" ON public.windows_simulation_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. GRANTS (anon gets nothing)
-- ============================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assignments TO authenticated;
GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.material_views TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.windows_simulation_sessions TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_lecturer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_with_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_lecturer(uuid) TO service_role;

-- ============================================
-- 6. PRIVATE STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

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
      AND policyname IN (
        'Anyone can upload documents',
        'Anyone can view documents',
        'Lecturers can delete own documents',
        'Lecturers can update own documents',
        'Lecturers upload own documents',
        'Lecturers update own documents',
        'Lecturers delete own documents',
        'Enrolled users read class documents'
      )
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
