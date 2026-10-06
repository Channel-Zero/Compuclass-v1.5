-- Fresh CompuClass database only.
-- Do NOT run this file on the live project Compu-ClassV1 (qdtbmdsssjmapodladcs).
-- That database already has these tables, plus RPC bodies that are not in git.
-- On the live project run only:
--   supabase/migrations/20261006140000_security_hardening.sql
--
-- This script creates the live table shape (public + gamification) with RLS
-- enabled and no policies yet, so a new database is closed until the migration
-- adds policies and the functions this repository owns.
--
-- No git branch contains the live gradebook, offline-quiz, maze, runner, or
-- gamification RPC source. Those functions stay on the live project only.
-- A new project will not have them until that code is committed.
--
-- After this file, run the security migration in the SQL editor.

CREATE SCHEMA IF NOT EXISTS gamification;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text DEFAULT 'student'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'lecturer'::text])))
);

CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  body text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.game_scores (
  user_id uuid NOT NULL,
  score integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_scores_pkey PRIMARY KEY (user_id),
  CONSTRAINT game_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.circuit_maze_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  host_id uuid,
  status text NOT NULL DEFAULT 'waiting'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT circuit_maze_rooms_code_key UNIQUE (code),
  CONSTRAINT circuit_maze_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT circuit_maze_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT circuit_maze_rooms_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'playing'::text, 'finished'::text])))
);

CREATE TABLE public.game_runner_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  host_id uuid,
  status text NOT NULL DEFAULT 'waiting'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_runner_rooms_code_key UNIQUE (code),
  CONSTRAINT game_runner_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT game_runner_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT game_runner_rooms_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'playing'::text, 'finished'::text])))
);

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  file_size integer,
  folder_id uuid,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT documents_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  passing_score integer DEFAULT 70,
  folder_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  type text NOT NULL DEFAULT 'class'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT quizzes_lecturer_id_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT quizzes_type_check CHECK ((type = ANY (ARRAY['class'::text, 'practice'::text])))
);

CREATE TABLE public.class_students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid,
  student_id uuid,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT class_students_class_id_student_id_key UNIQUE (class_id, student_id),
  CONSTRAINT class_students_pkey PRIMARY KEY (id),
  CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  type text NOT NULL DEFAULT 'mcq'::text,
  points numeric(6,2) NOT NULL DEFAULT 1,
  image_url text,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT quiz_questions_image_required CHECK (((type <> 'image_based'::text) OR (image_url IS NOT NULL))),
  CONSTRAINT quiz_questions_points_check CHECK (((points > (0)::numeric) AND (points <= (1000)::numeric))),
  CONSTRAINT quiz_questions_type_check CHECK ((type = ANY (ARRAY['mcq'::text, 'true_false'::text, 'short_answer'::text, 'image_based'::text])))
);

CREATE TABLE public.quiz_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  class_id uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  due_at timestamp with time zone,
  closes_at timestamp with time zone,
  attempt_limit integer NOT NULL DEFAULT 3,
  late_penalty_percent numeric(5,2) NOT NULL DEFAULT 10,
  time_limit_seconds integer,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  created_by uuid,
  CONSTRAINT quiz_assignments_quiz_id_class_id_key UNIQUE (quiz_id, class_id),
  CONSTRAINT quiz_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT quiz_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  CONSTRAINT quiz_assignments_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT quiz_assignments_attempt_limit_check CHECK (((attempt_limit >= 1) AND (attempt_limit <= 100))),
  CONSTRAINT quiz_assignments_closes_after_due CHECK (((closes_at IS NULL) OR (due_at IS NULL) OR (closes_at >= due_at))),
  CONSTRAINT quiz_assignments_late_penalty_check CHECK (((late_penalty_percent >= (0)::numeric) AND (late_penalty_percent <= (100)::numeric))),
  CONSTRAINT quiz_assignments_time_limit_check CHECK (((time_limit_seconds IS NULL) OR ((time_limit_seconds >= 10) AND (time_limit_seconds <= 86400))))
);

CREATE TABLE public.quiz_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_options_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  quiz_id uuid,
  score integer,
  completed_at timestamp with time zone DEFAULT now(),
  client_attempt_id uuid,
  assignment_id uuid,
  class_id uuid,
  attempt_number integer NOT NULL DEFAULT 1,
  question_order jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  raw_points numeric(8,2),
  max_points numeric(8,2),
  score_percent numeric(5,2),
  time_taken_seconds integer,
  is_late boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'graded'::text,
  synced_at timestamp with time zone,
  graded_at timestamp with time zone,
  rejected_reason text,
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES quiz_assignments(id),
  CONSTRAINT quiz_attempts_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT quiz_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'pending_manual_grade'::text, 'graded'::text, 'rejected'::text])))
);

CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_option_id uuid,
  short_answer_text text,
  is_correct boolean,
  points_awarded numeric(6,2),
  time_remaining_seconds integer,
  manual_grade_note text,
  graded_by uuid,
  graded_at timestamp with time zone,
  answered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_answers_attempt_id_question_id_key UNIQUE (attempt_id, question_id),
  CONSTRAINT quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  CONSTRAINT quiz_answers_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES profiles(id),
  CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  CONSTRAINT quiz_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL
);

CREATE TABLE public.grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  assignment_id uuid,
  best_attempt_id uuid,
  score numeric(5,2),
  recorded_at timestamp with time zone DEFAULT now(),
  is_overridden boolean NOT NULL DEFAULT false,
  override_score numeric(5,2),
  override_note text,
  overridden_by uuid,
  overridden_at timestamp with time zone,
  effective_score numeric(5,2) GENERATED ALWAYS AS (CASE WHEN is_overridden THEN override_score ELSE score END) STORED,
  CONSTRAINT grades_student_id_class_id_quiz_id_key UNIQUE (student_id, class_id, quiz_id),
  CONSTRAINT grades_pkey PRIMARY KEY (id),
  CONSTRAINT grades_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES quiz_assignments(id) ON DELETE SET NULL,
  CONSTRAINT grades_best_attempt_id_fkey FOREIGN KEY (best_attempt_id) REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  CONSTRAINT grades_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT grades_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES profiles(id),
  CONSTRAINT grades_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT grades_override_requires_note CHECK (((NOT is_overridden) OR ((override_score IS NOT NULL) AND (btrim(COALESCE(override_note, ''::text)) <> ''::text)))),
  CONSTRAINT grades_override_score_range CHECK (((override_score IS NULL) OR ((override_score >= (0)::numeric) AND (override_score <= (100)::numeric)))),
  CONSTRAINT grades_score_range CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric))))
);

CREATE TABLE public.material_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  document_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT material_views_pkey PRIMARY KEY (id),
  CONSTRAINT material_views_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT material_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  error text,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  dedupe_key text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))),
  CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['quiz_published'::text, 'quiz_due_soon'::text, 'attempt_graded'::text])))
);

CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_tokens_token_key UNIQUE (token),
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);

CREATE TABLE public.windows_simulation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_start timestamp with time zone DEFAULT now(),
  session_end timestamp with time zone,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT windows_simulation_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT windows_simulation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.circuit_maze_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  user_id uuid,
  full_name text,
  position integer NOT NULL DEFAULT 0,
  hearts integer NOT NULL DEFAULT 5,
  xp integer NOT NULL DEFAULT 0,
  finished boolean NOT NULL DEFAULT false,
  finish_rank integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT circuit_maze_players_room_id_user_id_key UNIQUE (room_id, user_id),
  CONSTRAINT circuit_maze_players_pkey PRIMARY KEY (id),
  CONSTRAINT circuit_maze_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES circuit_maze_rooms(id) ON DELETE CASCADE,
  CONSTRAINT circuit_maze_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.circuit_maze_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  xp_earned integer NOT NULL DEFAULT 0,
  finished boolean NOT NULL DEFAULT false,
  finish_bonus integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT circuit_maze_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT circuit_maze_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.game_runner_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  user_id uuid,
  full_name text,
  lane integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  lives integer NOT NULL DEFAULT 3,
  finished boolean NOT NULL DEFAULT false,
  finish_rank integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_runner_players_room_id_user_id_key UNIQUE (room_id, user_id),
  CONSTRAINT game_runner_players_pkey PRIMARY KEY (id),
  CONSTRAINT game_runner_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES game_runner_rooms(id) ON DELETE CASCADE,
  CONSTRAINT game_runner_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE gamification.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'trophy'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT badges_code_key UNIQUE (code),
  CONSTRAINT badges_pkey PRIMARY KEY (id)
);

CREATE TABLE gamification.user_stats (
  user_id uuid NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamp with time zone DEFAULT now(),
  legacy_xp_adjustment integer NOT NULL DEFAULT 0,
  xp_recomputed_at timestamp with time zone,
  CONSTRAINT user_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE gamification.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  badge_id uuid,
  earned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id),
  CONSTRAINT user_badges_pkey PRIMARY KEY (id),
  CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES gamification.badges(id) ON DELETE CASCADE,
  CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE gamification.quiz_attempt_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid,
  xp_earned integer NOT NULL DEFAULT 0,
  max_combo integer NOT NULL DEFAULT 0,
  correct_count integer,
  total_questions integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_attempt_stats_attempt_id_key UNIQUE (attempt_id),
  CONSTRAINT quiz_attempt_stats_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempt_stats_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
);

CREATE TABLE gamification.quiz_question_settings (
  question_id uuid NOT NULL,
  time_limit_seconds integer,
  difficulty text DEFAULT 'medium'::text,
  CONSTRAINT quiz_question_settings_pkey PRIMARY KEY (question_id),
  CONSTRAINT quiz_question_settings_question_id_fkey FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  CONSTRAINT quiz_question_settings_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))
);

CREATE TABLE gamification.snapshot_quiz_attempts_pre_v2 (
  id uuid,
  user_id uuid,
  quiz_id uuid,
  score integer,
  completed_at timestamp with time zone,
  snapshot_at timestamp with time zone
);

CREATE TABLE gamification.snapshot_quiz_questions_pre_v2 (
  id uuid,
  quiz_id uuid,
  options jsonb,
  correct_answer text,
  order_index integer,
  snapshot_at timestamp with time zone
);

CREATE TABLE gamification.snapshot_quizzes_pre_v2 (
  id uuid,
  title text,
  description text,
  passing_score integer,
  folder_id uuid,
  lecturer_id uuid,
  created_at timestamp with time zone,
  snapshot_at timestamp with time zone
);

CREATE TABLE gamification.snapshot_user_stats_pre_v2 (
  user_id uuid,
  xp integer,
  level integer,
  current_streak integer,
  longest_streak integer,
  last_activity_date date,
  updated_at timestamp with time zone,
  snapshot_at timestamp with time zone
);


DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.profiles','public.folders','public.classes','public.announcements','public.game_scores',
    'public.circuit_maze_rooms','public.game_runner_rooms','public.documents','public.quizzes',
    'public.class_students','public.quiz_questions','public.quiz_assignments','public.quiz_options',
    'public.quiz_attempts','public.quiz_answers','public.grades','public.material_views',
    'public.notifications','public.push_tokens','public.windows_simulation_sessions',
    'public.circuit_maze_players','public.circuit_maze_sessions','public.game_runner_players',
    'gamification.badges','gamification.user_stats','gamification.user_badges',
    'gamification.quiz_attempt_stats','gamification.quiz_question_settings',
    'gamification.snapshot_quiz_attempts_pre_v2','gamification.snapshot_quiz_questions_pre_v2',
    'gamification.snapshot_quizzes_pre_v2','gamification.snapshot_user_stats_pre_v2'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE UNIQUE INDEX badges_code_key ON gamification.badges USING btree (code);
CREATE UNIQUE INDEX quiz_attempt_stats_attempt_id_key ON gamification.quiz_attempt_stats USING btree (attempt_id);
CREATE INDEX idx_user_badges_user ON gamification.user_badges USING btree (user_id);
CREATE UNIQUE INDEX user_badges_user_id_badge_id_key ON gamification.user_badges USING btree (user_id, badge_id);
CREATE UNIQUE INDEX circuit_maze_players_room_id_user_id_key ON public.circuit_maze_players USING btree (room_id, user_id);
CREATE UNIQUE INDEX circuit_maze_rooms_code_key ON public.circuit_maze_rooms USING btree (code);
CREATE UNIQUE INDEX class_students_class_id_student_id_key ON public.class_students USING btree (class_id, student_id);
CREATE INDEX idx_class_students_class ON public.class_students USING btree (class_id);
CREATE INDEX idx_class_students_student ON public.class_students USING btree (student_id);
CREATE INDEX idx_classes_lecturer ON public.classes USING btree (lecturer_id);
CREATE INDEX idx_documents_folder ON public.documents USING btree (folder_id);
CREATE INDEX idx_documents_lecturer ON public.documents USING btree (lecturer_id);
CREATE INDEX idx_folders_lecturer ON public.folders USING btree (lecturer_id);
CREATE UNIQUE INDEX game_runner_players_room_id_user_id_key ON public.game_runner_players USING btree (room_id, user_id);
CREATE UNIQUE INDEX game_runner_rooms_code_key ON public.game_runner_rooms USING btree (code);
CREATE UNIQUE INDEX grades_student_id_class_id_quiz_id_key ON public.grades USING btree (student_id, class_id, quiz_id);
CREATE INDEX idx_grades_class_quiz ON public.grades USING btree (class_id, quiz_id);
CREATE INDEX idx_grades_student ON public.grades USING btree (student_id);
CREATE INDEX idx_material_views_document ON public.material_views USING btree (document_id);
CREATE INDEX idx_material_views_user ON public.material_views USING btree (user_id);
CREATE INDEX idx_notifications_pending ON public.notifications USING btree (created_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_key_uniq ON public.notifications USING btree (dedupe_key);
CREATE INDEX idx_push_tokens_user ON public.push_tokens USING btree (user_id);
CREATE UNIQUE INDEX push_tokens_token_key ON public.push_tokens USING btree (token);
CREATE INDEX idx_quiz_answers_attempt ON public.quiz_answers USING btree (attempt_id);
CREATE INDEX idx_quiz_answers_question ON public.quiz_answers USING btree (question_id);
CREATE UNIQUE INDEX quiz_answers_attempt_id_question_id_key ON public.quiz_answers USING btree (attempt_id, question_id);
CREATE INDEX idx_quiz_assignments_class ON public.quiz_assignments USING btree (class_id);
CREATE INDEX idx_quiz_assignments_published ON public.quiz_assignments USING btree (class_id, is_published);
CREATE INDEX idx_quiz_assignments_quiz ON public.quiz_assignments USING btree (quiz_id);
CREATE UNIQUE INDEX quiz_assignments_quiz_id_class_id_key ON public.quiz_assignments USING btree (quiz_id, class_id);
CREATE INDEX idx_quiz_attempts_assignment ON public.quiz_attempts USING btree (assignment_id);
CREATE INDEX idx_quiz_attempts_class ON public.quiz_attempts USING btree (class_id);
CREATE INDEX idx_quiz_attempts_pending_manual ON public.quiz_attempts USING btree (assignment_id, completed_at) WHERE (status = 'pending_manual_grade'::text);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts USING btree (quiz_id);
CREATE INDEX idx_quiz_attempts_status ON public.quiz_attempts USING btree (status);
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts USING btree (user_id);
CREATE INDEX idx_quiz_attempts_user_quiz ON public.quiz_attempts USING btree (user_id, quiz_id);
CREATE UNIQUE INDEX quiz_attempts_assignment_attempt_no_key ON public.quiz_attempts USING btree (assignment_id, user_id, attempt_number) WHERE ((assignment_id IS NOT NULL) AND (status <> 'rejected'::text));
CREATE UNIQUE INDEX quiz_attempts_client_attempt_id_key ON public.quiz_attempts USING btree (client_attempt_id) WHERE (client_attempt_id IS NOT NULL);
CREATE INDEX idx_quiz_options_question ON public.quiz_options USING btree (question_id);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions USING btree (quiz_id);
CREATE INDEX idx_quizzes_created_by ON public.quizzes USING btree (created_by);
CREATE INDEX idx_quizzes_folder ON public.quizzes USING btree (folder_id);
CREATE INDEX idx_quizzes_lecturer ON public.quizzes USING btree (created_by);
CREATE INDEX idx_quizzes_type ON public.quizzes USING btree (type);

