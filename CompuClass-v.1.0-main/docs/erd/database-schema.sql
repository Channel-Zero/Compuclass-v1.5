-- CompuClass Database Schema
-- Full ERD for Supabase (PostgreSQL)

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'student' CHECK (role = ANY (ARRAY['student', 'teacher', 'admin', 'lecturer'])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  content text,
  category text NOT NULL,
  difficulty text CHECK (difficulty = ANY (ARRAY['beginner', 'intermediate', 'advanced'])),
  order_index integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  lesson_id uuid,
  score integer,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);

CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  lesson_id uuid,
  folder_id uuid,
  passing_score integer DEFAULT 70,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT quizzes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id)
);

CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  order_index integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);

CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  quiz_id uuid,
  score integer NOT NULL,
  answers jsonb,
  passed boolean,
  completed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);

CREATE TABLE public.pc_lab_simulations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  simulation_type text NOT NULL,
  difficulty text CHECK (difficulty = ANY (ARRAY['beginner', 'intermediate', 'advanced'])),
  instructions text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pc_lab_simulations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_lab_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  simulation_id uuid,
  completed boolean DEFAULT false,
  time_spent integer,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_lab_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_lab_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_lab_progress_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.pc_lab_simulations(id)
);

CREATE TABLE public.troubleshooting_scenarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  problem text NOT NULL,
  solution text NOT NULL,
  hints jsonb,
  difficulty text CHECK (difficulty = ANY (ARRAY['beginner', 'intermediate', 'advanced'])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT troubleshooting_scenarios_pkey PRIMARY KEY (id)
);

CREATE TABLE public.troubleshooting_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  scenario_id uuid,
  solved boolean DEFAULT false,
  attempts integer DEFAULT 0,
  time_spent integer,
  solved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT troubleshooting_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT troubleshooting_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT troubleshooting_attempts_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.troubleshooting_scenarios(id)
);

CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  requirement_type text NOT NULL,
  requirement_value integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  achievement_id uuid,
  earned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id)
);

CREATE TABLE public.windows_simulation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_start timestamp with time zone DEFAULT now(),
  session_end timestamp with time zone,
  duration_seconds integer,
  activities jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT windows_simulation_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT windows_simulation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  folder_id uuid,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.profiles(id),
  CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id)
);

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES auth.users(id)
);

CREATE TABLE public.class_students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid,
  student_id uuid,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT class_students_pkey PRIMARY KEY (id),
  CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id)
);

CREATE TABLE public.quiz_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  class_id uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_assignments_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

CREATE TABLE public.material_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  document_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT material_views_pkey PRIMARY KEY (id),
  CONSTRAINT material_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT material_views_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id)
);
