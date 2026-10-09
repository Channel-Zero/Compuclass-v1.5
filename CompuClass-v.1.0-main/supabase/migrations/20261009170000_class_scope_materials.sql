-- Class scoping for materials. Not applied. Additive and idempotent.
--
-- documents, folders, and announcements gain a nullable class_id. NULL stays
-- visible to every signed-in user, so the existing document and announcement
-- do not disappear. A row with a class_id is visible to students enrolled in
-- that class, the lecturer of that class, and the lecturer who owns the row.
-- Announcements have no owner column, so "owns it" is is_class_lecturer.
--
-- Deleting a class sets class_id back to NULL. Those rows become visible to
-- every signed-in user again. That matches the NULL rule. It is called out
-- because a deleted class does not hide its old materials.
--
-- Storage SELECT for the documents bucket is narrowed when storage.foldername
-- exists: the caller's own folder (avatars and their uploads) or a documents
-- row they are allowed to see whose file_url is that object. Old file_url
-- values are full public URLs, so the match is an exact path or a URL that
-- ends with /<object name>. If foldername is missing, the bucket-wide
-- signed-in SELECT is left in place and the app keeps using signed URLs.
--
-- Preflight (read-only) is above BEGIN so it can be run on its own.

SELECT c.relname, a.attname, t.typname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
JOIN pg_type t ON t.oid = a.atttypid
WHERE n.nspname = 'public'
  AND c.relname IN ('documents', 'folders', 'announcements', 'classes')
  AND a.attname IN ('id', 'class_id', 'lecturer_id', 'file_url');

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_lecturer', 'is_class_lecturer', 'is_enrolled_in_class');

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.classes') IS NULL THEN
    RAISE EXCEPTION 'public.classes is missing. Refusing to add class_id.';
  END IF;
  IF to_regclass('public.documents') IS NULL
     OR to_regclass('public.folders') IS NULL
     OR to_regclass('public.announcements') IS NULL THEN
    RAISE EXCEPTION 'documents, folders, or announcements is missing. Refusing to add class_id.';
  END IF;
  IF to_regprocedure('public.is_class_lecturer(uuid)') IS NULL
     OR to_regprocedure('public.is_enrolled_in_class(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_class_lecturer(uuid) or is_enrolled_in_class(uuid) is missing. Refusing to change who can read materials.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reject_foreign_class_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.class_id IS NOT NULL AND NOT public.is_class_lecturer(NEW.class_id) THEN
    RAISE EXCEPTION 'You can only share this with your own class';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_foreign_class_link() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_table text;
  v_type text;
  v_del "char";
BEGIN
  FOREACH v_table IN ARRAY ARRAY['documents', 'folders', 'announcements'] LOOP
    SELECT t.typname INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relname = v_table AND a.attname = 'class_id' AND NOT a.attisdropped;

    IF v_type IS NOT NULL AND v_type IS DISTINCT FROM 'uuid' THEN
      RAISE EXCEPTION 'public.% class_id is %, not uuid. Refusing to continue.', v_table, v_type;
    END IF;

    IF v_type IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN class_id uuid', v_table);
    END IF;

    SELECT c.confdeltype INTO v_del
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = v_table AND c.conname = v_table || '_class_id_fkey';

    IF v_del IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL',
        v_table, v_table || '_class_id_fkey'
      );
    ELSIF v_del IS DISTINCT FROM 'n' THEN
      RAISE NOTICE 'public.% class_id foreign key does not use ON DELETE SET NULL. Leaving that constraint as it is.', v_table;
    END IF;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (class_id)', v_table || '_class_id_idx', v_table);

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_table || '_reject_foreign_class', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF class_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_foreign_class_link()',
      v_table || '_reject_foreign_class', v_table
    );
  END LOOP;
END $$;

-- Replace an authenticated-wide SELECT. An open SELECT this script does not
-- recognise is left in place, and a second SELECT is not added beside it
-- (policies are OR'd, so the open one would still show every row).
DO $$
DECLARE
  v_table text;
  v_new text;
  v_known text[];
    v_has_owner boolean;
    r record;
    v_qual text;
    v_norm text;
    v_open_unknown integer;
    v_kept_known integer;
    v_drop text[] ;
    v_name text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['documents', 'folders', 'announcements'] LOOP
    v_new := CASE v_table
      WHEN 'documents' THEN 'Signed-in users can view class documents'
      WHEN 'folders' THEN 'Signed-in users can view class folders'
      ELSE 'Signed-in users can read class announcements'
    END;
    v_known := CASE v_table
      WHEN 'documents' THEN ARRAY['Signed-in users can view documents', 'Everyone can view documents']
      WHEN 'folders' THEN ARRAY['Signed-in users can view folders', 'Students can view folders', 'Everyone can view folders']
      ELSE ARRAY['Signed-in users can read announcements']
    END;
    v_open_unknown := 0;
    v_kept_known := 0;
    v_drop := ARRAY[]::text[];

    FOR r IN
      SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS qual
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table AND pol.polcmd = 'r'
    LOOP
      v_qual := r.qual;
      v_norm := lower(replace(coalesce(v_qual, ''), ' ', ''));
      IF r.polname = v_new THEN
        CONTINUE;
      END IF;
      IF v_norm IN ('true', '(true)') AND NOT (r.polname = ANY (v_known)) THEN
        v_open_unknown := v_open_unknown + 1;
        RAISE NOTICE 'public.% SELECT policy % is open and was not replaced. A class-scoped SELECT was not added beside it. Expression: %',
          v_table, r.polname, coalesce(v_qual, '(none)');
      END IF;
    END LOOP;

    IF v_open_unknown > 0 THEN
      CONTINUE;
    END IF;

    FOR r IN
      SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS qual
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table AND pol.polcmd = 'r'
        AND (pol.polname = v_new OR pol.polname = ANY (v_known))
    LOOP
      v_norm := lower(replace(coalesce(r.qual, ''), ' ', ''));
      IF r.polname = v_new OR v_norm IN ('true', '(true)') THEN
        v_drop := v_drop || r.polname;
      ELSE
        v_kept_known := v_kept_known + 1;
        RAISE NOTICE 'public.% policy % is a known name but its expression is not open. Leaving it, and not adding another SELECT beside it. Expression: %',
          v_table, r.polname, coalesce(r.qual, '(none)');
      END IF;
    END LOOP;

    IF v_kept_known > 0 THEN
      CONTINUE;
    END IF;

    FOREACH v_name IN ARRAY v_drop LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_name, v_table);
    END LOOP;

    v_has_owner := v_table <> 'announcements' AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'lecturer_id'
    );

    IF v_has_owner THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (class_id IS NULL OR public.is_enrolled_in_class(class_id) OR public.is_class_lecturer(class_id) OR lecturer_id = auth.uid())',
        v_new, v_table
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (class_id IS NULL OR public.is_enrolled_in_class(class_id) OR public.is_class_lecturer(class_id))',
        v_new, v_table
      );
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
  END LOOP;
END $$;

-- Storage reads. Own folder covers avatars, which have no documents row.
-- A class file is readable when the documents row is visible to this user.
DO $$
DECLARE
  r record;
  v_qual text;
  v_norm text;
  v_open_unknown integer := 0;
  v_new text := 'Signed-in users can read class document files';
  v_known text[] := ARRAY['Signed-in users can read document files', 'Anyone can view documents'];
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage.objects is missing. Document file reads stay on signed URLs under the existing policy.';
    RETURN;
  END IF;
  IF to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE NOTICE 'storage.foldername(text) is missing. The documents bucket SELECT was not changed. The app still opens files with signed URLs, and any signed-in user who can call createSignedUrl can still read any object in the bucket.';
    RETURN;
  END IF;

  FOR r IN
    SELECT pol.polname, pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid) AS qual
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects' AND pol.polcmd = 'r'
  LOOP
    v_qual := coalesce(r.qual, '');
    v_norm := lower(replace(v_qual, ' ', ''));
    IF r.polname = v_new THEN
      CONTINUE;
    END IF;
    IF v_norm LIKE '%documents%'
       AND v_norm NOT LIKE '%auth.uid%'
       AND v_norm NOT LIKE '%is_enrolled_in_class%'
       AND v_norm NOT LIKE '%is_class_lecturer%'
       AND v_norm NOT LIKE '%lecturer_id%'
       AND NOT (r.polname = ANY (v_known)) THEN
      v_open_unknown := v_open_unknown + 1;
      RAISE NOTICE 'storage.objects SELECT policy % still allows a broad documents read. It was left in place, so class scoping of file bytes was not applied. The app keeps using signed URLs. Expression: %',
        r.polname, r.qual;
    END IF;
  END LOOP;

  IF v_open_unknown > 0 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT pol.polname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND pol.polname = ANY (v_known || ARRAY[v_new])
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.polname);
  END LOOP;

  CREATE POLICY "Signed-in users can read class document files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1
          FROM public.documents d
          WHERE d.file_url IS NOT NULL
            AND (
              d.file_url = name
              OR right(d.file_url, char_length(name) + 1) = '/' || name
            )
            AND (
              d.class_id IS NULL
              OR public.is_enrolled_in_class(d.class_id)
              OR public.is_class_lecturer(d.class_id)
              OR d.lecturer_id = auth.uid()
            )
        )
      )
    );
END $$;

COMMIT;
