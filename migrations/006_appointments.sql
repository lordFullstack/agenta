-- =========================================================
-- 006_appointments.sql
-- Núcleo del sistema: citas, ítems de servicio, historial y reprogramaciones
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_id            uuid NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  status              appointment_status NOT NULL DEFAULT 'pending',

  price_total         numeric(10,2) NOT NULL CHECK (price_total >= 0),  -- suma de snapshots de appointment_items
  customer_note       text,
  cancellation_reason text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid NOT NULL REFERENCES users(id),  -- cliente, o barbero/admin si fue walk-in
  updated_by          uuid REFERENCES users(id),

  CONSTRAINT chk_appointments_range CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_tenant          ON appointments (tenant_id);
CREATE INDEX idx_appointments_staff_starts_at ON appointments (staff_id, starts_at);
CREATE INDEX idx_appointments_customer        ON appointments (customer_id, starts_at DESC);
CREATE INDEX idx_appointments_branch_starts   ON appointments (branch_id, starts_at);

-- ── REGLA CRÍTICA #1: anti doble-booking a nivel de motor de base de datos ──
-- Dos citas activas del mismo barbero no pueden solaparse en el tiempo.
-- 'active' = no cancelada ni no-show; esas sí pueden solaparse con otra (el slot quedó libre).
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_appointments ON appointments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── REGLA CRÍTICA #2: cita no puede solaparse con un bloqueo o vacación del barbero ──
-- EXCLUDE no soporta validación cruzada entre tablas distintas, así que se resuelve con trigger.
CREATE OR REPLACE FUNCTION check_appointment_against_blocks()
RETURNS TRIGGER AS $$
BEGIN
  -- Contra blocked_slots (del barbero o de toda la sucursal)
  IF EXISTS (
    SELECT 1 FROM blocked_slots b
    WHERE (b.staff_id = NEW.staff_id OR (b.staff_id IS NULL AND b.branch_id = NEW.branch_id))
      AND tstzrange(b.starts_at, b.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
  ) THEN
    RAISE EXCEPTION 'El horario solicitado está bloqueado para este barbero/sucursal';
  END IF;

  -- Contra time_off (vacaciones/licencias, por día)
  IF EXISTS (
    SELECT 1 FROM time_off t
    WHERE t.staff_id = NEW.staff_id
      AND NEW.starts_at::date BETWEEN t.starts_on AND t.ends_on
  ) THEN
    RAISE EXCEPTION 'El barbero está de licencia/vacaciones en esa fecha';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_appointment_blocks
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, staff_id ON appointments
  FOR EACH ROW
  WHEN (NEW.status NOT IN ('cancelled', 'no_show'))
  EXECUTE FUNCTION check_appointment_against_blocks();

-- ── REGLA CRÍTICA #3: máquina de estados válida, forzada en base de datos ──
CREATE OR REPLACE FUNCTION validate_appointment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'pending'     AND NEW.status IN ('confirmed','cancelled')) OR
      (OLD.status = 'confirmed'   AND NEW.status IN ('in_progress','cancelled','no_show')) OR
      (OLD.status = 'in_progress' AND NEW.status IN ('completed','cancelled')) OR
      (OLD.status = 'completed'   AND FALSE) OR   -- estado terminal, sin salida
      (OLD.status = 'cancelled'   AND FALSE) OR   -- estado terminal
      (OLD.status = 'no_show'     AND FALSE)      -- estado terminal
    ) THEN
      RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_status_transition
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION validate_appointment_status_transition();

-- ─────────────────────────────────────────────────────────
-- APPOINTMENT_ITEMS (servicios incluidos en la cita, con snapshot de precio/duración)
-- ─────────────────────────────────────────────────────────
CREATE TABLE appointment_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,

  -- snapshot: congelado al momento de la reserva, inmune a cambios futuros del catálogo
  service_name_snapshot varchar(150) NOT NULL,
  unit_price        numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  duration_minutes  int NOT NULL CHECK (duration_minutes > 0),

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_items_appointment ON appointment_items (appointment_id);

-- ─────────────────────────────────────────────────────────
-- APPOINTMENT_STATUS_HISTORY (append-only — nunca se edita ni se borra)
-- ─────────────────────────────────────────────────────────
CREATE TABLE appointment_status_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status      appointment_status,
  to_status        appointment_status NOT NULL,
  changed_by       uuid NOT NULL REFERENCES users(id),
  note             text,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_appointment ON appointment_status_history (appointment_id, changed_at);

-- Trigger que registra automáticamente cada cambio de estado
CREATE OR REPLACE FUNCTION log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.updated_by, NEW.created_by));

    -- Incrementa no_show_count del cliente automáticamente
    IF NEW.status = 'no_show' THEN
      UPDATE customer_profiles
      SET no_show_count = no_show_count + 1
      WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id;
    END IF;

    -- Actualiza última visita cuando se completa
    IF NEW.status = 'completed' THEN
      UPDATE customer_profiles
      SET last_visit_at = NEW.ends_at
      WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_status_insert
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_status_change();

CREATE TRIGGER trg_log_status_update
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_status_change();

-- ─────────────────────────────────────────────────────────
-- APPOINTMENT_RESCHEDULES (append-only — reprogramar conserva el id original de la cita)
-- ─────────────────────────────────────────────────────────
CREATE TABLE appointment_reschedules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id     uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

  previous_starts_at timestamptz NOT NULL,
  previous_ends_at   timestamptz NOT NULL,
  new_starts_at      timestamptz NOT NULL,
  new_ends_at        timestamptz NOT NULL,

  reason             text,
  rescheduled_by     uuid NOT NULL REFERENCES users(id),
  rescheduled_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reschedules_appointment ON appointment_reschedules (appointment_id);

COMMENT ON TABLE appointment_reschedules IS
  'Reprogramar = UPDATE de starts_at/ends_at sobre la misma fila de appointments (respeta el EXCLUDE constraint), más un registro acá. No se crea una cita nueva.';
