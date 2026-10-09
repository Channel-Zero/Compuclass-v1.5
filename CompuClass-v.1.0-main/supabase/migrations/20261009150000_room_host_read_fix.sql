-- Already applied to the live database. This file records that change.
-- A room SELECT policy that calls only is_*_member(id) hides the room from
-- the host who just created it, because that function reads the same table.
-- The policy below names the host directly as well as the member check.

BEGIN;
DROP POLICY IF EXISTS "Members can read maze rooms" ON public.circuit_maze_rooms;
CREATE POLICY "Members can read maze rooms" ON public.circuit_maze_rooms FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.is_circuit_maze_member(id));
DROP POLICY IF EXISTS "Members can read runner rooms" ON public.game_runner_rooms;
CREATE POLICY "Members can read runner rooms" ON public.game_runner_rooms FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.is_game_runner_member(id));
COMMIT;
