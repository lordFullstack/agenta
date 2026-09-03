-- =========================================================
-- 002_tenancy_core.sql
-- Tenant raíz (empresa/barbería) y sucursales
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- TENANTS (empresas — el nivel raíz de multi-tenancy)
-- ─────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name      varchar(200) NOT NULL,
  trade_name      varchar(150) NOT NULL,     -- nombre comercial ("Barbería El Corte")
  slug            varchar(150) NOT NULL,     -- para URL pública
  tax_id          varchar(50),               -- CUIT/RFC/NIT, nullable
  timezone        varchar(50)  NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  is_active       boolean      NOT NULL DEFAULT true,

  -- audit fields
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  created_by      uuid,                      -- FK a users se agrega en 003 (evita ciclo de dependencias)
  updated_by      uuid,

  -- soft delete
  deleted_at      timestamptz,
  deleted_by      uuid
);

-- Unicidad solo entre registros vivos (soft-delete-safe)
CREATE UNIQUE INDEX uq_tenants_slug_alive ON tenants (slug) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tenants IS 'Tenant raíz de multi-tenancy. Toda tabla operativa cuelga de un tenant_id.';

-- ─────────────────────────────────────────────────────────
-- BRANCHES (sucursales)
-- ─────────────────────────────────────────────────────────
CREATE TABLE branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  name            varchar(150) NOT NULL,
  address         text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  phone           varchar(20),
  timezone        varchar(50),               -- override opcional del timezone del tenant (multi-región)
  is_active       boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,

  deleted_at      timestamptz,
  deleted_by      uuid
);

CREATE INDEX idx_branches_tenant ON branches (tenant_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: aislamiento a nivel de motor de base de datos
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_branches ON branches
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON POLICY tenant_isolation_branches ON branches IS
  'La app debe hacer SET app.tenant_id = ''<uuid>'' al abrir cada conexión/transacción.';
