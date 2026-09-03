-- =========================================================
-- 009_availability_engine.sql
-- Motor de disponibilidad:
--   HORARIO BARBERÍA + HORARIO BARBERO + SERVICIO + DURACIÓN
--   + DESCANSOS + BLOQUEOS + VACACIONES + CITAS EXISTENTES
--   = SLOTS DISPONIBLES
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- Helper 1: duración total de la cita (suma de servicios + buffer del barbero)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_appointment_duration(
  p_staff_id uuid,
  p_service_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_total  int;
  v_buffer int;
BEGIN
  SELECT buffer_minutes INTO v_buffer
  FROM staff_members WHERE id = p_staff_id;

  SELECT COALESCE(SUM(COALESCE(ss.duration_override_minutes, s.base_duration_minutes)), 0)
  INTO v_total
  FROM services s
  LEFT JOIN staff_services ss
    ON ss.service_id = s.id AND ss.staff_id = p_staff_id AND ss.is_active
  WHERE s.id = ANY(p_service_ids)
    AND s.deleted_at IS NULL;

  RETURN v_total + COALESCE(v_buffer, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────
-- Helper 2: ventanas de trabajo del barbero para una fecha dada
-- (staff_hours tiene prioridad; business_hours es fallback; time_off anula el día)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_working_windows(
  p_staff_id uuid,
  p_date date
) RETURNS TABLE(window_start timestamptz, window_end timestamptz) AS $$
DECLARE
  v_branch_id       uuid;
  v_tenant_tz       varchar;
  v_dow             day_of_week;
  v_has_staff_hours boolean;
  v_on_time_off     boolean;
BEGIN
  SELECT sm.branch_id, t.timezone
  INTO v_branch_id, v_tenant_tz
  FROM staff_members sm
  JOIN tenants t ON t.id = sm.tenant_id
  WHERE sm.id = p_staff_id AND sm.deleted_at IS NULL;

  IF v_branch_id IS NULL THEN
    RETURN; -- barbero inexistente o eliminado
  END IF;

  v_dow := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM p_date)::int + 1]::day_of_week;

  -- vacaciones/licencia: anulan el día completo
  SELECT EXISTS (
    SELECT 1 FROM time_off
    WHERE staff_id = p_staff_id AND p_date BETWEEN starts_on AND ends_on
  ) INTO v_on_time_off;

  IF v_on_time_off THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM staff_hours WHERE staff_id = p_staff_id AND day_of_week = v_dow
  ) INTO v_has_staff_hours;

  IF v_has_staff_hours THEN
    RETURN QUERY
    SELECT (p_date + sh.starts_at) AT TIME ZONE v_tenant_tz,
           (p_date + sh.ends_at)   AT TIME ZONE v_tenant_tz
    FROM staff_hours sh
    WHERE sh.staff_id = p_staff_id AND sh.day_of_week = v_dow
    ORDER BY sh.starts_at;
  ELSE
    RETURN QUERY
    SELECT (p_date + bh.opens_at)  AT TIME ZONE v_tenant_tz,
           (p_date + bh.closes_at) AT TIME ZONE v_tenant_tz
    FROM business_hours bh
    WHERE bh.branch_id = v_branch_id AND bh.day_of_week = v_dow
    ORDER BY bh.opens_at;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────
-- Función principal: slots disponibles de UN barbero para UNA fecha
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_available_slots(
  p_staff_id uuid,
  p_service_ids uuid[],
  p_date date,
  p_slot_interval_minutes int DEFAULT 15,
  p_min_lead_minutes int DEFAULT 30
) RETURNS TABLE(slot_start timestamptz, slot_end timestamptz) AS $$
DECLARE
  v_duration        int;
  v_window          record;
  v_candidate       timestamptz;
  v_candidate_end   timestamptz;
  v_earliest_allowed timestamptz := now() + (p_min_lead_minutes || ' minutes')::interval;
  v_branch_id       uuid;
BEGIN
  v_duration := resolve_appointment_duration(p_staff_id, p_service_ids);
  IF v_duration IS NULL OR v_duration <= 0 THEN
    RETURN;
  END IF;

  SELECT branch_id INTO v_branch_id FROM staff_members WHERE id = p_staff_id;

  FOR v_window IN SELECT * FROM get_working_windows(p_staff_id, p_date) LOOP
    v_candidate := v_window.window_start;

    WHILE v_candidate + (v_duration || ' minutes')::interval <= v_window.window_end LOOP
      v_candidate_end := v_candidate + (v_duration || ' minutes')::interval;

      IF v_candidate >= v_earliest_allowed
        -- no pisa una cita activa del barbero
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.staff_id = p_staff_id
            AND a.status NOT IN ('cancelled', 'no_show')
            AND tstzrange(a.starts_at, a.ends_at) && tstzrange(v_candidate, v_candidate_end)
        )
        -- no pisa un bloqueo del barbero o de la sucursal completa
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

COMMENT ON FUNCTION get_available_slots IS
  'Slots libres de un barbero puntual. Uso: SELECT * FROM get_available_slots(''<staff_id>'', ARRAY[''<service_id>'']::uuid[], ''2026-09-01'');';

-- ─────────────────────────────────────────────────────────
-- Wrapper: "cualquiera disponible" — agrega slots de todos los barberos
-- de la sucursal que ofrecen TODOS los servicios pedidos
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_available_slots_any_staff(
  p_branch_id uuid,
  p_service_ids uuid[],
  p_date date,
  p_slot_interval_minutes int DEFAULT 15,
  p_min_lead_minutes int DEFAULT 30
) RETURNS TABLE(staff_id uuid, slot_start timestamptz, slot_end timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, gs.slot_start, gs.slot_end
  FROM staff_members sm
  CROSS JOIN LATERAL get_available_slots(
    sm.id, p_service_ids, p_date, p_slot_interval_minutes, p_min_lead_minutes
  ) gs
  WHERE sm.branch_id = p_branch_id
    AND sm.status = 'active'
    AND sm.deleted_at IS NULL
    AND (
      SELECT COUNT(DISTINCT ss.service_id)
      FROM staff_services ss
      WHERE ss.staff_id = sm.id
        AND ss.service_id = ANY(p_service_ids)
        AND ss.is_active
    ) = array_length(p_service_ids, 1)
  ORDER BY gs.slot_start, sm.id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_available_slots_any_staff IS
  'Uso para la opción "Cualquiera disponible" del flujo de reserva del cliente. Devuelve staff_id junto a cada slot para que el sistema asigne el barbero al confirmar.';
