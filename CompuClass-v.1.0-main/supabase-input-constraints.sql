-- =============================================================================
-- OPTIONAL: server-side input limits (NOT yet applied to any database)
-- =============================================================================
-- The app validates input in utils/inputValidation.js, but that runs on the
-- client, so anyone calling the Supabase REST API directly with their own
-- login can skip it. These CHECK constraints enforce the same limits inside
-- Postgres, where they cannot be bypassed.
--
-- These are data-shape constraints only. They do NOT change any RLS policy,
-- grant, role, or auth setting.
--
-- NOT VALID means existing rows are left alone (nothing already stored can
-- make this migration fail); only new INSERTs/UPDATEs are checked. After
-- cleaning up any old rows you can run `ALTER TABLE ... VALIDATE CONSTRAINT`.
--
-- Apply via Supabase Dashboard -> SQL Editor, after testing on a branch/staging
-- project. To undo: ALTER TABLE <table> DROP CONSTRAINT <name>;
-- =============================================================================

BEGIN;

-- Short name/title fields: length limits, and no HTML/script markup.
ALTER TABLE profiles  ADD CONSTRAINT profiles_full_name_input
  CHECK (full_name IS NULL OR (char_length(full_name) <= 100 AND full_name !~* '<\s*/?\s*[a-z!?][^>]*>|javascript\s*:')) NOT VALID;

ALTER TABLE folders   ADD CONSTRAINT folders_name_input
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 100 AND name !~* '<\s*/?\s*[a-z!?][^>]*>|javascript\s*:') NOT VALID;
ALTER TABLE folders   ADD CONSTRAINT folders_description_length
  CHECK (description IS NULL OR char_length(description) <= 1000) NOT VALID;

ALTER TABLE classes   ADD CONSTRAINT classes_name_input
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 100 AND name !~* '<\s*/?\s*[a-z!?][^>]*>|javascript\s*:') NOT VALID;
ALTER TABLE classes   ADD CONSTRAINT classes_description_length
  CHECK (description IS NULL OR char_length(description) <= 1000) NOT VALID;

ALTER TABLE documents ADD CONSTRAINT documents_title_input
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200 AND title !~* '<\s*/?\s*[a-z!?][^>]*>|javascript\s*:') NOT VALID;
ALTER TABLE documents ADD CONSTRAINT documents_file_name_safe
  CHECK (file_name IS NULL OR (char_length(file_name) <= 120 AND file_name !~ '[/\\]' AND file_name NOT LIKE '..%')) NOT VALID;

ALTER TABLE quizzes   ADD CONSTRAINT quizzes_title_input
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200 AND title !~* '<\s*/?\s*[a-z!?][^>]*>|javascript\s*:') NOT VALID;

-- Question text may contain code (e.g. "<p>"), so only length is limited.
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_question_length
  CHECK (char_length(btrim(question)) BETWEEN 1 AND 1000) NOT VALID;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_options_shape
  CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 10) NOT VALID;

COMMIT;
