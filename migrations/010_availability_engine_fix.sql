-- =========================================================
-- 010_availability_engine_fix.sql
-- Patch sobre 009: la disponibilidad no es solo "el barbero está libre".
-- Agrega 3 validaciones que faltaban:
--   1) el barbero debe OFRECER el servicio pedido (no solo estar libre)
--   2) el tenant/branch deben estar activos (no pausados)
--   3) el barbero debe estar 'active' (no pausado/dado de baja)
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- FIX 1: resolve_appointment_duration ahora exige que TODOS los
-- servicios pedidos tengan un staff_services activo para ese barbero.
-- Si falta uno solo, devuelve NULL (= "este barbero no puede hacer esta combinación").
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_appointment_duration(
  p_staff_id uuid,
  p_service_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_total          int;
  v_buffer         int;
  v_services_count int;
BEGIN
  -- ¿el barbero ofrece TODOS los servicios pedidos? (no solo alguno)
  SELECT COUNT(DISTINCT ss.service_id)
  INTO v_services_count
  FROM staff_services ss
  JOIN services s ON s.id = ss.service_id AND s.deleted_at IS NULL
  WHERE ss.staff_id = p_staff_id
    AND ss.is_active
    AND ss.service_id = ANY(p_service_ids);

  IF v_services_count IS DISTINCT FROM array_length(p_service_ids, 1) THEN
    RETURN NULL; -- el barbero no puede realizar esta combinación de servicios
  END IF;

  SELECT buffer_minutes INTO v_buffer
  FROM staff_members WHERE id = p_staff_id;

  SELECT SUM(COALESCE(ss.duration_override_minutes, s.base_duration_minutes))
  INTO v_total
  FROM services s
  JOIN staff_services ss
    ON ss.service_id = s.id AND ss.staff_id = p_staff_id AND ss.is_active
  WHERE s.id = ANY(p_service_ids)
    AND s.deleted_at IS NULL;

  RETURN v_total + COALESCE(v_buffer, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_appointment_duration IS
  'Devuelve NULL si el barbero no ofrece alguno de los servicios pedidos — esto es lo que hace que get_available_slots devuelva vacío en vez de horarios inválidos.';

-- ─────────────────────────────────────────────────────────
-- FIX 2: get_working_windows ahora exige tenant/branch/staff activos.
-- Antes solo chequeaba deleted_at (soft delete), no is_active/status (pausa operativa).
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
  v_is_operational  boolean;
BEGIN
  SELECT sm.branch_id, t.timezone,
         (t.is_active AND b.is_active AND sm.status = 'active')
  INTO v_branch_id, v_tenant_tz, v_is_operational
  FROM staff_members sm
  JOIN tenants t  ON t.id = sm.tenant_id
  JOIN branches b ON b.id = sm.branch_id
  WHERE sm.id = p_staff_id AND sm.deleted_at IS NULL;

  -- barbero inexistente/eliminado, o tenant/branch/staff no operativos:
  -- no hay ventanas de trabajo, sin excepción ni mensaje de error — simplemente no hay slots.
  IF v_branch_id IS NULL OR NOT v_is_operational THEN
    RETURN;
  END IF;

  v_dow := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM p_date)::int + 1]::day_of_week;

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
-- FIX 3: get_available_slots ahora corta temprano si resolve_appointment_duration
-- devuelve NULL (barbero no apto para el servicio) — antes ese caso devolvía 0
-- y el chequeo "<= 0" lo dejaba pasar como si la duración fuera simplemente inválida,
-- sin distinguir "no hay duración cargada" de "este barbero no puede hacer esto".
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_available_slots(
  p_staff_id uuid,
  p_service_ids uuid[],
  p_date date,
  p_slot_interval_minutes int DEFAULT 15,
  p_min_lead_minutes int DEFAULT 30
) RETURNS TABLE(slot_start timestamptz, slot_end timestamptz) AS $$
DECLARE
  v_duration         int;
  v_window           record;
  v_candidate        timestamptz;
  v_candidate_end    timestamptz;
  v_earliest_allowed timestamptz := now() + (p_min_lead_minutes || ' minutes')::interval;
  v_branch_id        uuid;
BEGIN
  v_duration := resolve_appointment_duration(p_staff_id, p_service_ids);

  -- NULL = el barbero no ofrece uno o más de los servicios pedidos → sin slots, sin ambigüedad
  IF v_duration IS NULL OR v_duration <= 0 THEN
    RETURN;
  END IF;

  SELECT branch_id INTO v_branch_id FROM staff_members WHERE id = p_staff_id;

  FOR v_window IN SELECT * FROM get_working_windows(p_staff_id, p_date) LOOP
    v_candidate := v_window.window_start;

    WHILE v_candidate + (v_duration || ' minutes')::interval <= v_window.window_end LOOP
      v_candidate_end := v_candidate + (v_duration || ' minutes')::interval;

      IF v_candidate >= v_earliest_allowed
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.staff_id = p_staff_id
            AND a.status NOT IN ('cancelled', 'no_show')
            AND tstzrange(a.starts_at, a.ends_at) && tstzrange(v_candidate, v_candidate_end)
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
