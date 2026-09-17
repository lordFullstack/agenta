-- =========================================================
-- 017_fix_buffer_column_reference.sql
-- FIX CRÍTICO encontrado por arranque real del servidor contra Postgres real
-- (nunca detectado por la suite de tests, que mockea `pg` y no ejecuta SQL real).
--
-- La migración 011 renombró staff_members.buffer_minutes -> buffer_after_minutes,
-- pero resolve_appointment_duration() (migraciones 009/010) seguía leyendo la
-- columna vieja. Esto rompía TODO lo que dependiera de esa función:
--   - GET /v1/availability (motor de disponibilidad completo)
--   - POST /v1/appointments (creación de citas de cliente)
--   - POST /v1/admin/walk-ins (creación de citas desde la barbería)
-- Es decir: la mitad del valor central del producto estaba rota en producción
-- real, aunque los 94 tests de backend (todos con pg mockeado) seguían en verde.
-- =========================================================

CREATE OR REPLACE FUNCTION resolve_appointment_duration(
  p_staff_id uuid,
  p_service_ids uuid[]
) RETURNS int AS $$
DECLARE
  v_total          int;
  v_buffer         int;
  v_services_count int;
BEGIN
  SELECT COUNT(DISTINCT ss.service_id)
  INTO v_services_count
  FROM staff_services ss
  JOIN services s ON s.id = ss.service_id AND s.deleted_at IS NULL
  WHERE ss.staff_id = p_staff_id
    AND ss.is_active
    AND ss.service_id = ANY(p_service_ids);

  IF v_services_count IS DISTINCT FROM array_length(p_service_ids, 1) THEN
    RETURN NULL;
  END IF;

  -- FIX: buffer_minutes -> buffer_after_minutes (columna real desde migración 011)
  SELECT buffer_after_minutes INTO v_buffer
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
  'Fix aplicado en migración 017: leía buffer_minutes (columna eliminada en 011), ahora lee buffer_after_minutes. Encontrado por arranque real del servidor, no por tests (que mockean pg). Ver KNOWN_ISSUES.md.';
