-- =========================================================
-- 005_scheduling.sql
-- Horarios (sucursal y barbero), bloqueos puntuales y vacaciones
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- BUSINESS_HOURS (horario general de la sucursal — fallback)
-- Múltiples filas por día habilitan horario partido (mañana/tarde).
-- ─────────────────────────────────────────────────────────
CREATE TABLE business_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  day_of_week  day_of_week NOT NULL,
  opens_at     time NOT NULL,
  closes_at    time NOT NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_business_hours_range CHECK (closes_at > opens_at)
);

CREATE INDEX idx_business_hours_branch ON business_hours (branch_id, day_of_week);

CREATE TRIGGER trg_business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────
-- STAFF_HOURS (horario individual del barbero — si no existe, se hereda business_hours)
-- ─────────────────────────────────────────────────────────
CREATE TABLE staff_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
  day_of_week  day_of_week NOT NULL,
  starts_at    time NOT NULL,
  ends_at      time NOT NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_staff_hours_range CHECK (ends_at > starts_at)
);

CREATE INDEX idx_staff_hours_staff ON staff_hours (staff_id, day_of_week);

CREATE TRIGGER trg_staff_hours_updated_at
  BEFORE UPDATE ON staff_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────
-- TIME_OFF (vacaciones / licencias — rango de días, no horas puntuales)
-- ─────────────────────────────────────────────────────────
CREATE TABLE time_off (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,

  starts_on    date NOT NULL,
  ends_on      date NOT NULL,
  reason       time_off_reason NOT NULL DEFAULT 'vacation',
  note         text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id),

  CONSTRAINT chk_time_off_range CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_time_off_staff_range ON time_off (staff_id, starts_on, ends_on);

-- ─────────────────────────────────────────────────────────
-- BLOCKED_SLOTS (bloqueos puntuales de horas — urgencias, mantenimiento, etc.)
-- A diferencia de time_off (días completos), esto es rango de timestamp exacto.
-- ─────────────────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id    uuid REFERENCES branches(id) ON DELETE RESTRICT,   -- bloquea toda la sucursal si staff_id es NULL
  staff_id     uuid REFERENCES staff_members(id) ON DELETE RESTRICT,

  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  reason       blocked_reason NOT NULL DEFAULT 'other',
  note         text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id),

  CONSTRAINT chk_blocked_slots_range CHECK (ends_at > starts_at),
  CONSTRAINT chk_blocked_slots_scope CHECK (branch_id IS NOT NULL OR staff_id IS NOT NULL)
);

CREATE INDEX idx_blocked_slots_staff_range
  ON blocked_slots USING gist (staff_id, tstzrange(starts_at, ends_at))
  WHERE staff_id IS NOT NULL;

CREATE INDEX idx_blocked_slots_branch_range
  ON blocked_slots USING gist (branch_id, tstzrange(starts_at, ends_at))
  WHERE branch_id IS NOT NULL;

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_blocked_slots ON blocked_slots
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
