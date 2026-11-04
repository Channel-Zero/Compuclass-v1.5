-- Allow lecturers to remove only classes they own.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_class_lecturer(p_class_id) THEN
    RAISE EXCEPTION 'Not authorized to delete this class';
  END IF;

  DELETE FROM public.quiz_assignments WHERE class_id = p_class_id;
  DELETE FROM public.class_students WHERE class_id = p_class_id;
  DELETE FROM public.classes
  WHERE id = p_class_id AND lecturer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_class(uuid) TO authenticated;

COMMIT;
