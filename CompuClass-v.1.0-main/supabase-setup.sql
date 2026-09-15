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
      WHEN NEW.raw_user_meta_data->>'role' = 'lecturer' THEN 'lecturer'
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
-- SETUP COMPLETE
-- ============================================

-- Your database is now ready!
-- Next steps:
-- 1. Update your .env file with Supabase credentials
-- 2. Create test accounts through your app
-- 3. Use lecturer@compuclass.com for lecturer access
