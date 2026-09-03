-- =========================================================
-- 012_idempotency_keys.sql
-- Evita citas duplicadas por reintentos de UI (doble-tap), distinto del
-- problema de concurrencia real que resuelve el constraint EXCLUDE.
-- =========================================================

CREATE TABLE idempotency_keys (
  key             varchar(100) PRIMARY KEY,   -- generado por el cliente (uuid v4)
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Limpieza: las keys solo importan durante la ventana en que el cliente podría reintentar (ej. 24h)
CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys (created_at);

COMMENT ON TABLE idempotency_keys IS
  'Un job periódico puede purgar filas con created_at < now() - interval ''24 hours'' sin riesgo, ya el POST solo necesita deduplicar reintentos cercanos en el tiempo.';
