-- =========================================================
-- 003_staff_and_customers.sql
-- Staff (barberos/admins, scoped a tenant) y Customers (globales a la plataforma)
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- USERS (autenticación global — un login sirve para toda la plataforma)
-- ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           varchar(20) UNIQUE,
  email           varchar(255) UNIQUE,
  password_hash   varchar(255),              -- nullable: staff/admin usan password, customers usan OTP
  full_name       varchar(150) NOT NULL,
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_users_identity CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ahora sí, cerramos la FK diferida de tenants/branches -> users
ALTER TABLE tenants  ADD CONSTRAINT fk_tenants_created_by  FOREIGN KEY (created_by)  REFERENCES users(id);
ALTER TABLE tenants  ADD CONSTRAINT fk_tenants_updated_by  FOREIGN KEY (updated_by)  REFERENCES users(id);
ALTER TABLE tenants  ADD CONSTRAINT fk_tenants_deleted_by  FOREIGN KEY (deleted_by)  REFERENCES users(id);
ALTER TABLE branches ADD CONSTRAINT fk_branches_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE branches ADD CONSTRAINT fk_branches_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE branches ADD CONSTRAINT fk_branches_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

-- ─────────────────────────────────────────────────────────
-- TENANT MEMBERSHIPS (rol de un usuario dentro de un tenant: owner/branch_admin)
-- Separado de staff_members porque un dueño no necesariamente es un barbero operativo.
-- ─────────────────────────────────────────────────────────
CREATE TABLE tenant_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role            varchar(30) NOT NULL CHECK (role IN ('owner','branch_admin')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_tenant_membership UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships (tenant_id);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships (user_id);

CREATE TRIGGER trg_tenant_memberships_updated_at
  BEFORE UPDATE ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────
-- STAFF_MEMBERS (barberos — scoped a tenant/branch)
-- ─────────────────────────────────────────────────────────
CREATE TABLE staff_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  bio               text,
  status            staff_status NOT NULL DEFAULT 'active',
  buffer_minutes    int NOT NULL DEFAULT 5 CHECK (buffer_minutes >= 0),
  accepts_walk_ins  boolean NOT NULL DEFAULT true,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES users(id),
  updated_by        uuid REFERENCES users(id),

  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES users(id),

  -- Un mismo usuario no puede tener dos perfiles de barbero activos en el mismo tenant
  CONSTRAINT uq_staff_user_tenant_alive UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_staff_tenant  ON staff_members (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_branch ON staff_members (branch_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_staff ON staff_members
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─────────────────────────────────────────────────────────
-- CUSTOMERS (globales a la plataforma — un cliente puede reservar en cualquier tenant)
-- ─────────────────────────────────────────────────────────
CREATE TABLE customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES users(id)
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────
-- CUSTOMER_PROFILES (la relación cliente↔tenant: notas, no-shows, última visita)
-- Esto es lo que SÍ es por tenant, aunque el cliente sea global.
-- ─────────────────────────────────────────────────────────
CREATE TABLE customer_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  notes           text,                      -- notas internas del barbero sobre el cliente
  no_show_count   int NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  last_visit_at   timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_customer_profile_tenant UNIQUE (tenant_id, customer_id)
);

CREATE INDEX idx_customer_profiles_tenant ON customer_profiles (tenant_id);

CREATE TRIGGER trg_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_customer_profiles ON customer_profiles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
