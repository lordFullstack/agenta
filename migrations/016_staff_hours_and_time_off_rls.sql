-- =========================================================
-- 016_staff_hours_and_time_off_rls.sql
-- Resuelve ISSUE-013: staff_hours y time_off no tenían RLS.
-- Mismo patrón que business_hours (migración 015) — sin tenant_id propio,
-- se resuelve vía subquery a staff_members.tenant_id.
-- =========================================================

ALTER TABLE staff_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_staff_hours ON staff_hours
  FOR SELECT USING (true); -- el horario de un barbero es información pública (para reservar)

CREATE POLICY tenant_write_staff_hours ON staff_hours
  FOR INSERT WITH CHECK (
    staff_id IN (SELECT id FROM staff_members WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );
CREATE POLICY tenant_update_staff_hours ON staff_hours
  FOR UPDATE USING (
    staff_id IN (SELECT id FROM staff_members WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );
CREATE POLICY tenant_delete_staff_hours ON staff_hours
  FOR DELETE USING (
    staff_id IN (SELECT id FROM staff_members WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );

-- time_off: NO es público — a diferencia del horario general, cuándo se toma vacaciones
-- un barbero es información operativa interna, no algo que un cliente necesite ver
-- (el motor de disponibilidad la consulta, pero eso corre con contexto de tenant igual).
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_all_time_off ON time_off
  USING (staff_id IN (SELECT id FROM staff_members WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (staff_id IN (SELECT id FROM staff_members WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));

COMMENT ON POLICY tenant_all_time_off ON time_off IS
  'A diferencia de staff_hours/business_hours, time_off no tiene policy de SELECT público — el motor de disponibilidad y el propio staff la consultan siempre con contexto de tenant activo, nunca anónimamente.';
