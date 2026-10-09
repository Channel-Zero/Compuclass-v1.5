-- Already applied to the live database. This file records that change.
-- "Lecturers can manage own classes" used to allow any signed-in user who
-- matched lecturer_id. It now also requires public.is_lecturer().

BEGIN;
DROP POLICY IF EXISTS "Lecturers can manage own classes" ON public.classes;
CREATE POLICY "Lecturers can manage own classes" ON public.classes FOR ALL TO authenticated USING ((select auth.uid()) = lecturer_id AND public.is_lecturer()) WITH CHECK ((select auth.uid()) = lecturer_id AND public.is_lecturer());
COMMIT;
