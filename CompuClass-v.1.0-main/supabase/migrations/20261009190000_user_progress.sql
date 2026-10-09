-- Account progress. Not applied. Additive and idempotent.
--
-- One row per person per key. The value is jsonb and must stay under 100KB.
-- The signed-in user can read, insert, and update only their own rows.
-- There is no delete policy. Clearing progress writes a new value.
-- anon and public cannot use the table.
--
-- Preflight (read-only) is above BEGIN so it can be run on its own.

SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users';

SELECT a.attname, t.typname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
JOIN pg_type t ON t.oid = a.atttypid
WHERE n.nspname = 'public' AND c.relname = 'user_progress';

BEGIN;

DO $$
DECLARE
  v_type text;
  v_oversized boolean;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users is missing. Refusing to create user_progress.';
  END IF;

  IF to_regclass('public.user_progress') IS NULL THEN
    CREATE TABLE public.user_progress (
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      key text NOT NULL,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key),
      CONSTRAINT user_progress_key_length CHECK (char_length(key) BETWEEN 1 AND 128),
      CONSTRAINT user_progress_value_size CHECK (octet_length(value::text) < 102400)
    );
  ELSE
    SELECT t.typname INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relname = 'user_progress' AND a.attname = 'value' AND NOT a.attisdropped;

    IF v_type IS DISTINCT FROM 'jsonb' THEN
      RAISE EXCEPTION 'public.user_progress.value is not jsonb. Refusing to continue.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'user_id'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'key'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'updated_at'
    ) THEN
      RAISE EXCEPTION 'public.user_progress is missing user_id, key, or updated_at. Refusing to continue.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.user_progress WHERE octet_length(value::text) >= 102400
    ) INTO v_oversized;

    IF v_oversized THEN
      RAISE NOTICE 'public.user_progress already has a value of 100KB or more. The size check was not added.';
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_progress_value_size'
    ) THEN
      ALTER TABLE public.user_progress
        ADD CONSTRAINT user_progress_value_size CHECK (octet_length(value::text) < 102400);
    END IF;
  END IF;
END $$;

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users update own progress" ON public.user_progress;

CREATE POLICY "Users read own progress"
  ON public.user_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own progress"
  ON public.user_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own progress"
  ON public.user_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_progress FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_progress TO authenticated;

COMMIT;
