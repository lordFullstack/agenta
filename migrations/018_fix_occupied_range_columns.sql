-- =========================================================
-- 018_fix_occupied_range_columns.sql
-- FIX CRÍTICO encontrado por arranque real del servidor contra Postgres real.
--
-- La migración 011 intentaba crear `occupied_starts_at`/`occupied_ends_at` como
-- columnas GENERATED ALWAYS AS ... STORED, usando `starts_at - (buffer * interval)`.
-- Postgres RECHAZA esto: los operadores de aritmética timestamptz ± interval están
-- marcados STABLE, no IMMUTABLE (el resultado puede depender de reglas de timezone/DST),
-- y las columnas generadas exigen expresiones IMMUTABLE. La migración 011 falló en ese
-- punto — pero como `psql -f` sin ON_ERROR_STOP sigue ejecutando el resto del archivo,
-- el DROP CONSTRAINT del constraint viejo SÍ se ejecutó, y el ADD CONSTRAINT del nuevo
-- (que dependía de las columnas nunca creadas) también falló.
--
-- Resultado real en producción hasta este fix: LA TABLA appointments QUEDÓ SIN NINGÚN
-- CONSTRAINT ANTI DOUBLE-BOOKING. La garantía central de todo el proyecto estaba rota,
-- silenciosamente, desde que se aplicó la migración 011 — invisible para la suite de
-- tests porque esos tests mockean `pg` y nunca ejecutan SQL real contra un schema real.
-- Se encontró recién al levantar el servidor de verdad contra Postgres real.
--
-- Fix: reemplazar las columnas generadas por columnas normales mantenidas por trigger
-- (los triggers SÍ pueden usar operadores STABLE sin problema — la restricción de
-- IMMUTABLE es específica de GENERATED, no de triggers).
-- =========================================================

-- 1. Agregar las columnas como columnas normales (no generadas)
ALTER TABLE appointments ADD COLUMN occupied_starts_at timestamptz;
ALTER TABLE appointments ADD COLUMN occupied_ends_at timestamptz;

-- 2. Backfill de filas existentes (si hay alguna cita ya creada antes de este fix)
UPDATE appointments
SET occupied_starts_at = starts_at - (buffer_before_minutes * INTERVAL '1 minute'),
    occupied_ends_at   = ends_at + (buffer_after_minutes * INTERVAL '1 minute')
WHERE occupied_starts_at IS NULL;

ALTER TABLE appointments ALTER COLUMN occupied_starts_at SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN occupied_ends_at SET NOT NULL;

-- 3. Reemplazar el trigger de INSERT: ahora setea buffer Y rango ocupado en un solo paso
--    (fusionado para evitar depender del orden alfabético de ejecución entre dos triggers
--    BEFORE INSERT distintos, que es el orden que Postgres usa por defecto y es frágil).
DROP TRIGGER IF EXISTS trg_snapshot_staff_buffer ON appointments;
DROP FUNCTION IF EXISTS snapshot_staff_buffer();

CREATE OR REPLACE FUNCTION snapshot_buffer_and_occupied_range()
RETURNS TRIGGER AS $$
BEGIN
  SELECT buffer_before_minutes, buffer_after_minutes
  INTO NEW.buffer_before_minutes, NEW.buffer_after_minutes
  FROM staff_members WHERE id = NEW.staff_id;

  NEW.occupied_starts_at := NEW.starts_at - (COALESCE(NEW.buffer_before_minutes, 0) * INTERVAL '1 minute');
  NEW.occupied_ends_at   := NEW.ends_at + (COALESCE(NEW.buffer_after_minutes, 0) * INTERVAL '1 minute');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_buffer_and_occupied_range
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION snapshot_buffer_and_occupied_range();

-- 4. Trigger de UPDATE: cuando se reprograma (cambia starts_at/ends_at), el rango ocupado
--    debe recalcularse — usando el buffer YA snapshoteado en la fila, sin re-consultar
--    staff_members (el buffer no cambia retroactivamente por una reprogramación).
CREATE OR REPLACE FUNCTION recompute_occupied_range_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  NEW.occupied_starts_at := NEW.starts_at - (COALESCE(NEW.buffer_before_minutes, 0) * INTERVAL '1 minute');
  NEW.occupied_ends_at   := NEW.ends_at + (COALESCE(NEW.buffer_after_minutes, 0) * INTERVAL '1 minute');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recompute_occupied_range
  BEFORE UPDATE OF starts_at, ends_at ON appointments
  FOR EACH ROW EXECUTE FUNCTION recompute_occupied_range_on_reschedule();

-- 5. Re-crear el índice GIST y el constraint EXCLUDE — la pieza que en verdad
--    garantiza "no double booking", y que había quedado completamente ausente.
DROP INDEX IF EXISTS idx_appointments_occupied_range;
CREATE INDEX idx_appointments_occupied_range
  ON appointments USING gist (staff_id, tstzrange(occupied_starts_at, occupied_ends_at));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments;

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));

COMMENT ON CONSTRAINT no_overlapping_appointments ON appointments IS
  'Re-creado en migración 018 tras un fallo silencioso en la migración 011 (columnas generadas con expresión no-IMMUTABLE). Ver el comentario completo al inicio de 018_fix_occupied_range_columns.sql — este constraint es la garantía central anti double-booking de todo el proyecto, verificar SIEMPRE con \\d appointments que exista tras cualquier cambio futuro a este área.';
