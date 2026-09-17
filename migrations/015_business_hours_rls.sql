-- =========================================================
-- 015_business_hours_rls.sql
-- Loop 07 — gap encontrado: business_hours no tenía RLS.
-- No tiene tenant_id propio, así que la policy resuelve el tenant vía subquery a branches.
-- =========================================================

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- Lectura pública (igual que branches/services — el horario general es información
-- que la barbería quiere que cualquiera vea, ver DEC-015).
CREATE POLICY public_read_business_hours ON business_hours
  FOR SELECT USING (true);

CREATE POLICY tenant_write_business_hours ON business_hours
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );

CREATE POLICY tenant_update_business_hours ON business_hours
  FOR UPDATE USING (
    branch_id IN (SELECT id FROM branches WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );

CREATE POLICY tenant_delete_business_hours ON business_hours
  FOR DELETE USING (
    branch_id IN (SELECT id FROM branches WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );

COMMENT ON POLICY tenant_write_business_hours ON business_hours IS
  'Sin tenant_id propio en la tabla — el aislamiento se resuelve vía subquery a branches.tenant_id. Ver DECISIONS_LOG.md DEC-019.';
