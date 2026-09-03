-- =========================================================
-- 004_services.sql
-- Catálogo de servicios (por tenant) + precio/duración por barbero
-- =========================================================

CREATE TABLE services (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  name               varchar(150) NOT NULL,
  description        text,
  category           varchar(100),
  base_price         numeric(10,2) NOT NULL CHECK (base_price >= 0),
  base_duration_minutes int NOT NULL CHECK (base_duration_minutes > 0),
  is_active          boolean NOT NULL DEFAULT true,
  sort_order         int NOT NULL DEFAULT 0,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users(id),
  updated_by         uuid REFERENCES users(id),

  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES users(id)
);

CREATE INDEX idx_services_tenant ON services (tenant_id) WHERE deleted_at IS NULL;

-- Unicidad de nombre por tenant, solo entre servicios vivos
CREATE UNIQUE INDEX uq_services_name_tenant_alive
  ON services (tenant_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_services ON services
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─────────────────────────────────────────────────────────
-- STAFF_SERVICES (qué barbero ofrece qué servicio, con overrides opcionales)
-- ─────────────────────────────────────────────────────────
CREATE TABLE staff_services (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                 uuid NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
  service_id               uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,

  price_override           numeric(10,2) CHECK (price_override >= 0),
  duration_override_minutes int CHECK (duration_override_minutes > 0),
  is_active                boolean NOT NULL DEFAULT true,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_staff_service UNIQUE (staff_id, service_id)
);

CREATE INDEX idx_staff_services_staff   ON staff_services (staff_id);
CREATE INDEX idx_staff_services_service ON staff_services (service_id);

CREATE TRIGGER trg_staff_services_updated_at
  BEFORE UPDATE ON staff_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN staff_services.price_override IS
  'Si es NULL, se usa services.base_price. Permite que un barbero senior cobre distinto por el mismo servicio.';
