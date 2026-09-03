-- =========================================================
-- 008_audit_log.sql
-- Auditoría transversal — inmutable por diseño (no UPDATE, no DELETE)
-- =========================================================

CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),   -- nullable: eventos de plataforma (ej. super_admin) no tienen tenant
  actor_id      uuid REFERENCES users(id),

  entity_type   varchar(50) NOT NULL,          -- 'tenant' | 'branch' | 'service' | 'appointment' | ...
  entity_id     uuid NOT NULL,
  action        varchar(30) NOT NULL CHECK (action IN ('create','update','delete','soft_delete','status_change')),

  diff          jsonb,                          -- snapshot { before, after }
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant  ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity  ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor   ON audit_logs (actor_id);

-- Inmutabilidad forzada a nivel de motor: nadie puede editar ni borrar un registro de auditoría,
-- ni siquiera con acceso directo a la base de datos por fuera del backend.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es append-only: % no está permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE audit_logs IS
  'Registro transversal de acciones sensibles sobre cualquier entidad. Se complementa con appointment_status_history, que es específico del ciclo de vida de una cita.';
