-- Circuit Maze topic stats. Not applied to the live database.
--
-- The app called GET /rest/v1/gamification.topic_performance. PostgREST treats
-- that as a table in public whose name contains a dot, and answers 404
-- (PGRST205) because that table is not in the schema cache. The client now
-- calls public.get_topic_performance() and public.record_answer_result().
-- Apply this file in the Supabase SQL editor or with supabase db push.
-- Do not apply it twice by hand if you have already recorded it in
-- supabase_migrations.schema_migrations; the statements themselves are safe to re-run.

BEGIN;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users is missing. Refusing to create topic performance.';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS gamification;

CREATE TABLE IF NOT EXISTS gamification.topic_performance (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  difficulty text NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic, difficulty),
  CONSTRAINT topic_performance_topic_length CHECK (char_length(topic) BETWEEN 1 AND 64),
  CONSTRAINT topic_performance_difficulty_known CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT topic_performance_counts_nonneg CHECK (correct_count >= 0 AND wrong_count >= 0)
);

ALTER TABLE gamification.topic_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own topic performance" ON gamification.topic_performance;
CREATE POLICY "Users read own topic performance"
  ON gamification.topic_performance
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own topic performance" ON gamification.topic_performance;
CREATE POLICY "Users insert own topic performance"
  ON gamification.topic_performance
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own topic performance" ON gamification.topic_performance;
CREATE POLICY "Users update own topic performance"
  ON gamification.topic_performance
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- The Data API does not expose the gamification schema. These functions are
-- the public API. They run as the owner so they can write the table, and they
-- only touch the signed-in user's rows.
CREATE OR REPLACE FUNCTION public.record_answer_result(p_topic text, p_difficulty text, p_correct boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gamification
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_topic text := btrim(COALESCE(p_topic, ''));
  v_difficulty text := btrim(COALESCE(p_difficulty, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_topic = '' OR char_length(v_topic) > 64 THEN
    RAISE EXCEPTION 'Invalid topic';
  END IF;
  IF v_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'Invalid difficulty';
  END IF;
  IF p_correct IS NULL THEN
    RAISE EXCEPTION 'Invalid result';
  END IF;

  INSERT INTO gamification.topic_performance (user_id, topic, difficulty, correct_count, wrong_count)
  VALUES (
    v_user,
    v_topic,
    v_difficulty,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    CASE WHEN p_correct THEN 0 ELSE 1 END
  )
  ON CONFLICT (user_id, topic, difficulty) DO UPDATE
  SET correct_count = gamification.topic_performance.correct_count + EXCLUDED.correct_count,
      wrong_count = gamification.topic_performance.wrong_count + EXCLUDED.wrong_count,
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_topic_performance()
RETURNS TABLE (
  topic text,
  difficulty text,
  correct_count integer,
  wrong_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, gamification
AS $$
  SELECT tp.topic, tp.difficulty, tp.correct_count, tp.wrong_count
  FROM gamification.topic_performance tp
  WHERE tp.user_id = (select auth.uid());
$$;

REVOKE ALL ON FUNCTION public.record_answer_result(text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_topic_performance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_answer_result(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_topic_performance() TO authenticated;

REVOKE ALL ON TABLE gamification.topic_performance FROM PUBLIC, anon;

COMMIT;
