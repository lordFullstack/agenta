-- =========================================================
-- 001_extensions_and_types.sql
-- Extensiones y tipos compartidos por todo el esquema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist; -- requerido por EXCLUDE USING gist con columnas escalares

CREATE TYPE appointment_status AS ENUM (
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'authorized', 'paid', 'refunded', 'partially_refunded', 'failed'
);

CREATE TYPE payment_method AS ENUM (
  'cash', 'card', 'deposit_online', 'wallet'
);

CREATE TYPE blocked_reason AS ENUM (
  'personal', 'sick_leave', 'holiday', 'maintenance', 'other'
);

CREATE TYPE time_off_reason AS ENUM (
  'vacation', 'sick_leave', 'personal', 'other'
);

CREATE TYPE day_of_week AS ENUM (
  'mon','tue','wed','thu','fri','sat','sun'
);

CREATE TYPE staff_status AS ENUM ('active', 'paused', 'terminated');

-- Función utilitaria: mantiene updated_at siempre vigente en cualquier tabla mutable
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
