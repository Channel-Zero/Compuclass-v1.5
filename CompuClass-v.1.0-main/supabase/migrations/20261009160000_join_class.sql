-- Join-class codes. Not applied. Additive and idempotent.
-- classes.join_code is a 6-character code a student types. Lecturers already
-- read their own class rows, so the code is visible to them without a new
-- classes policy. Students join through join_class_by_code, which does not
-- list other classes.
--
-- Preflight (read-only) is above BEGIN so it can be run on its own.

SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('classes', 'class_students', 'profiles');

SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_lecturer', 'is_class_lecturer', 'is_enrolled_in_class');

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.classes') IS NULL OR to_regclass('public.class_students') IS NULL THEN
    RAISE EXCEPTION 'public.classes or public.class_students is missing. Refusing to add join codes.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'lecturer_id'
  ) THEN
    RAISE EXCEPTION 'public.classes is missing id or lecturer_id. Refusing to add join codes.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'class_students' AND column_name = 'class_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'class_students' AND column_name = 'student_id'
  ) THEN
    RAISE EXCEPTION 'public.class_students is missing class_id or student_id. Refusing to add join codes.';
  END IF;
END $$;

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS join_code text;

-- SECURITY DEFINER so the uniqueness check sees every class, not only the
-- rows the inserting lecturer can read. authenticated cannot call this
-- directly (revoked below). The insert trigger is the caller.
CREATE OR REPLACE FUNCTION public.generate_class_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
  attempt integer;
BEGIN
  FOR attempt IN 1..30 LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE join_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a class code';
END;
$$;

REVOKE ALL ON FUNCTION public.generate_class_join_code() FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER so a lecturer insert can call generate_class_join_code
-- after that function is revoked from authenticated. Without this, creating
-- a class fails with permission denied for function generate_class_join_code.
-- authenticated still cannot call this function directly.
CREATE OR REPLACE FUNCTION public.classes_set_join_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.join_code IS NULL OR btrim(NEW.join_code) = '' THEN
    NEW.join_code := public.generate_class_join_code();
  ELSE
    NEW.join_code := upper(regexp_replace(btrim(NEW.join_code), '\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.classes_set_join_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS classes_set_join_code ON public.classes;
CREATE TRIGGER classes_set_join_code
  BEFORE INSERT ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.classes_set_join_code();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.classes WHERE join_code IS NULL OR btrim(join_code) = '' LOOP
    UPDATE public.classes
    SET join_code = public.generate_class_join_code()
    WHERE id = r.id;
  END LOOP;

  UPDATE public.classes
  SET join_code = upper(regexp_replace(btrim(join_code), '\s+', '', 'g'))
  WHERE join_code IS DISTINCT FROM upper(regexp_replace(btrim(join_code), '\s+', '', 'g'));

  IF EXISTS (SELECT 1 FROM public.classes WHERE join_code IS NULL) THEN
    RAISE EXCEPTION 'A class still has no join code. Refusing to require the column.';
  END IF;
END $$;

ALTER TABLE public.classes ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS classes_join_code_key ON public.classes (join_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.class_students
    GROUP BY class_id, student_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS class_students_class_id_student_id_key
      ON public.class_students (class_id, student_id);
  ELSE
    RAISE NOTICE 'public.class_students has duplicate (class_id, student_id) rows. No unique index was added. join_class_by_code still skips a student who is already enrolled.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_code text;
  v_class public.classes;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can join a class';
  END IF;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  IF v_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;

  SELECT * INTO v_class FROM public.classes WHERE join_code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;

  INSERT INTO public.class_students (class_id, student_id, joined_at)
  SELECT v_class.id, v_uid, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.class_students
    WHERE class_id = v_class.id AND student_id = v_uid
  );

  RETURN jsonb_build_object('class_id', v_class.id, 'name', v_class.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_class(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL OR p_class_id IS NULL THEN
    RETURN jsonb_build_object('left', false);
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can leave a class';
  END IF;

  DELETE FROM public.class_students
  WHERE class_id = p_class_id AND student_id = v_uid;

  RETURN jsonb_build_object('left', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_class_code(p_class_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;
  IF to_regprocedure('public.is_class_lecturer(uuid)') IS NULL
     OR NOT public.is_class_lecturer(p_class_id) THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;

  v_code := public.generate_class_join_code();
  UPDATE public.classes SET join_code = v_code WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class code not found';
  END IF;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_class(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_class_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_class_code(uuid) TO authenticated;

COMMIT;
