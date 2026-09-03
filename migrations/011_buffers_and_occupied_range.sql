-- =========================================================
-- 011_buffers_and_occupied_range.sql
-- El buffer antes/después pasa a estar enforced por el MISMO constraint
-- que previene el doble-booking, no por una capa de cálculo aparte.
-- =========================================================

-- staff_members: separar buffer en antes/después (antes solo existía "después")
ALTER TABLE staff_members RENAME COLUMN buffer_minutes TO buffer_after_minutes;
ALTER TABLE staff_members ADD COLUMN buffer_before_minutes int NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0);

-- appointments: snapshot del buffer vigente al momento de la reserva
-- (igual que price/duración snapshot en appointment_items — inmune a cambios futuros de config del barbero)
ALTER TABLE appointments ADD COLUMN buffer_before_minutes int NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0);
ALTER TABLE appointments ADD COLUMN buffer_after_minutes  int NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0);

-- Columnas generadas: el rango REAL ocupado por la cita, incluyendo buffer
ALTER TABLE appointments ADD COLUMN occupied_starts_at timestamptz
  GENERATED ALWAYS AS (starts_at - (buffer_before_minutes * INTERVAL '1 minute')) STORED;
ALTER TABLE appointments ADD COLUMN occupied_ends_at timestamptz
  GENERATED ALWAYS AS (ends_at + (buffer_after_minutes * INTERVAL '1 minute')) STORED;

-- Reemplazar el constraint: ahora excluye por rango OCUPADO (con buffer), no por rango de servicio puro
ALTER TABLE appointments DROP CONSTRAINT no_overlapping_appointments;

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));

-- Índice de apoyo para el motor de disponibilidad (lee por rango ocupado, no por rango de servicio)
CREATE INDEX idx_appointments_occupied_range
  ON appointments USING gist (staff_id, tstzrange(occupied_starts_at, occupied_ends_at));

COMMENT ON COLUMN appointments.occupied_starts_at IS
  'Rango real bloqueado para el barbero, incluye buffer. Es lo que usa el constraint anti doble-booking y el motor de disponibilidad — nunca comparar contra starts_at/ends_at "pelados" al chequear solapamiento.';

-- ─────────────────────────────────────────────────────────
-- Actualizar get_available_slots para chequear contra occupied_starts_at/ends_at
-- en vez de starts_at/ends_at, y para snapshotear el buffer al insertar.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_available_slots(
  p_staff_id uuid,
  p_service_ids uuid[],
  p_date date,
  p_slot_interval_minutes int DEFAULT 15,
  p_min_lead_minutes int DEFAULT 30,
  p_max_window_days int DEFAULT 60
) RETURNS TABLE(slot_start timestamptz, slot_end timestamptz) AS $$
DECLARE
  v_duration         int;
  v_window           record;
  v_candidate        timestamptz;
  v_candidate_end    timestamptz;
  v_earliest_allowed timestamptz := now() + (p_min_lead_minutes || ' minutes')::interval;
  v_branch_id        uuid;
  v_tenant_tz        varchar;
  v_today_local      date;
BEGIN
  SELECT sm.branch_id, t.timezone
  INTO v_branch_id, v_tenant_tz
  FROM staff_members sm JOIN tenants t ON t.id = sm.tenant_id
  WHERE sm.id = p_staff_id;

  IF v_branch_id IS NULL THEN
    RETURN;
  END IF;

  v_today_local := (now() AT TIME ZONE v_tenant_tz)::date;

  -- ventana máxima/mínima de reserva, resuelta en el timezone del tenant, no del servidor
  IF p_date < v_today_local OR p_date > v_today_local + p_max_window_days THEN
    RETURN;
  END IF;

  v_duration := resolve_appointment_duration(p_staff_id, p_service_ids);
  IF v_duration IS NULL OR v_duration <= 0 THEN
    RETURN;
  END IF;

  FOR v_window IN SELECT * FROM get_working_windows(p_staff_id, p_date) LOOP
    v_candidate := v_window.window_start;

    WHILE v_candidate + (v_duration || ' minutes')::interval <= v_window.window_end LOOP
      v_candidate_end := v_candidate + (v_duration || ' minutes')::interval;

      IF v_candidate >= v_earliest_allowed
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.staff_id = p_staff_id
            AND a.status NOT IN ('cancelled', 'no_show')
            -- clave del fix: se compara contra el rango OCUPADO (con buffer), no starts_at/ends_at puros
            AND tstzrange(a.occupied_starts_at, a.occupied_ends_at) && tstzrange(v_candidate, v_candidate_end)
        )
        AND NOT EXISTS (
          SELECT 1 FROM blocked_slots b
          WHERE (b.staff_id = p_staff_id OR (b.staff_id IS NULL AND b.branch_id = v_branch_id))
            AND tstzrange(b.starts_at, b.ends_at) && tstzrange(v_candidate, v_candidate_end)
        )
      THEN
        slot_start := v_candidate;
        slot_end   := v_candidate_end;
        RETURN NEXT;
      END IF;

      v_candidate := v_candidate + (p_slot_interval_minutes || ' minutes')::interval;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────
-- Trigger: snapshotea el buffer vigente del barbero en la cita al crearla
-- (mismo patrón que el snapshot de precio en appointment_items)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION snapshot_staff_buffer()
RETURNS TRIGGER AS $$
BEGIN
  SELECT buffer_before_minutes, buffer_after_minutes
  INTO NEW.buffer_before_minutes, NEW.buffer_after_minutes
  FROM staff_members WHERE id = NEW.staff_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_staff_buffer
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION snapshot_staff_buffer();
