-- =========================================================
-- 014_auth_and_rls_split.sql
-- Loop 06 — Authentication & RBAC
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- OTP (login de clientes — sin password)
-- ─────────────────────────────────────────────────────────
CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       varchar(20) NOT NULL,
  code_hash   varchar(128) NOT NULL,   -- sha256 con pepper de servidor, no el código en claro
  attempts    int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone_active ON otp_codes (phone, expires_at) WHERE consumed_at IS NULL;

COMMENT ON TABLE otp_codes IS
  'Un código por fila. attempts >= 5 o expires_at pasado invalida el código sin necesidad de borrar la fila (permite auditar intentos de fuerza bruta).';

-- ─────────────────────────────────────────────────────────
-- REFRESH TOKENS (login de staff/admin con password, y sesión post-OTP de clientes)
-- ─────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(128) NOT NULL,   -- sha256 del token — el token en claro nunca se persiste
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS
  'Rotación: cada refresh revoca el token usado y emite uno nuevo. Permite revocar sesiones (logout, cambio de password) sin esperar expiración.';

-- ─────────────────────────────────────────────────────────
-- DEC-015: split de RLS entre catálogo público y datos operativos privados.
-- Ver DECISIONS_LOG.md para el razonamiento completo.
-- ─────────────────────────────────────────────────────────

-- branches: SELECT público (discovery), mutación tenant-scoped
DROP POLICY IF EXISTS tenant_isolation_branches ON branches;
CREATE POLICY public_read_branches ON branches
  FOR SELECT USING (is_active AND deleted_at IS NULL);
CREATE POLICY tenant_write_branches ON branches
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_update_branches ON branches
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_delete_branches ON branches
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- staff_members: SELECT público (para elegir barbero), mutación tenant-scoped
DROP POLICY IF EXISTS tenant_isolation_staff ON staff_members;
CREATE POLICY public_read_staff ON staff_members
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY tenant_write_staff ON staff_members
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_update_staff ON staff_members
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_delete_staff ON staff_members
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- services: SELECT público (catálogo), mutación tenant-scoped
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read_services ON services
  FOR SELECT USING (is_active AND deleted_at IS NULL);
CREATE POLICY tenant_write_services ON services
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_update_services ON services
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_delete_services ON services
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- appointments, customer_profiles, blocked_slots, payments, audit_logs:
-- SIN cambios — siguen exigiendo app.tenant_id para TODA operación, incluyendo SELECT.
-- Son datos operativos privados, no catálogo público. No relajar esto nunca.

COMMENT ON POLICY public_read_services ON services IS
  'DEC-015: el catálogo es intencionalmente público para la búsqueda de clientes. La escritura sigue aislada por tenant.';
