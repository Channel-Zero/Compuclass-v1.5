-- Documents bucket INSERT. Not applied. Additive and idempotent.
--
-- Lecturer document uploads are ${userId}/${timestamp}_${fileName}. This
-- replaces a bucket-wide upload policy with two INSERT policies:
--   * a lecturer may insert only when the first folder is their own uid
--   * any signed-in user may insert only ${uid}/avatar_* (profile photos)
-- Update and delete policies are not changed.
--
-- If is_lecturer() or storage.foldername(text) is missing, or an INSERT
-- policy is not one of the known loose policies, nothing is dropped. A
-- tighter policy is not added beside a policy that still lets every
-- signed-in user upload.
--
-- Preflight (read-only) is above BEGIN so it can be run on its own.

SELECT pol.polname, pol.polcmd,
       pg_get_expr(pol.polqual, pol.polrelid) AS qual,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relname = 'objects';

SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname = 'is_lecturer')
   OR (n.nspname = 'storage' AND p.proname = 'foldername');

BEGIN;

DO $$
DECLARE
  r record;
  v_blob text;
  v_norm text;
  v_loose text[] := ARRAY[]::text[];
  v_unknown integer := 0;
  v_name text;
  v_lecturer text := 'Lecturers can upload their own document files';
  v_avatar text := 'Users can upload their own avatar';
  v_known_loose text[] := ARRAY['Anyone can upload documents', 'Users can upload own documents'];
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage.objects is missing. No upload policy was changed.';
    RETURN;
  END IF;

  IF to_regprocedure('public.is_lecturer()') IS NULL
     OR to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE NOTICE 'public.is_lecturer() or storage.foldername(text) is missing. The loose documents upload policy was not dropped.';
    RETURN;
  END IF;

  FOR r IN
    SELECT pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND pol.polcmd IN ('a', '*')
  LOOP
    IF r.polname = ANY (ARRAY[v_lecturer, v_avatar]) THEN
      CONTINUE;
    END IF;

    v_blob := coalesce(r.qual, '') || ' ' || coalesce(r.chk, '');
    v_norm := lower(replace(v_blob, ' ', ''));

    IF v_norm LIKE '%is_lecturer%' THEN
      RAISE NOTICE 'storage.objects policy % already requires is_lecturer(). Leaving it.', r.polname;
      CONTINUE;
    END IF;

    IF r.polcmd = '*' THEN
      IF v_norm LIKE '%documents%' OR r.polname ILIKE '%upload%' OR r.polname ILIKE '%document%' THEN
        v_unknown := v_unknown + 1;
        RAISE NOTICE 'storage.objects policy % is FOR ALL and is not a known upload policy. It was left in place. Lecturer-only INSERT was not added beside it.', r.polname;
      END IF;
      CONTINUE;
    END IF;

    IF r.polname = ANY (v_known_loose) THEN
      v_loose := v_loose || r.polname;
      CONTINUE;
    END IF;

    IF v_norm LIKE '%documents%' OR r.polname ILIKE '%upload%' OR r.polname ILIKE '%document%' THEN
      v_unknown := v_unknown + 1;
      RAISE NOTICE 'storage.objects INSERT policy % is not a known documents upload policy. It was left in place. Lecturer-only INSERT was not added beside it. Expression: %',
        r.polname, coalesce(r.chk, r.qual, '(none)');
    END IF;
  END LOOP;

  IF v_unknown > 0 THEN
    RETURN;
  END IF;

  IF cardinality(v_loose) = 0 THEN
    RAISE NOTICE 'No known loose documents upload policy was found. Lecturer-only INSERT was not added.';
    RETURN;
  END IF;

  FOREACH v_name IN ARRAY v_loose LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_name);
  END LOOP;
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_lecturer);
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_avatar);

  CREATE POLICY "Lecturers can upload their own document files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND public.is_lecturer()
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Profile photos use the same bucket: ${userId}/avatar_${timestamp}.jpg
  -- Students are not lecturers, so the lecturer policy does not cover them.
  CREATE POLICY "Users can upload their own avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND split_part(name, '/', 2) LIKE 'avatar\_%' ESCAPE '\'
      AND split_part(name, '/', 3) = ''
    );
END $$;

COMMIT;
