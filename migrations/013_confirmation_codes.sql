-- =========================================================
-- 013_confirmation_codes.sql
-- Número de confirmación: se genera y se verifica que sea único
-- DENTRO del mismo INSERT (trigger BEFORE), sin una segunda ida a la base
-- desde la aplicación y sin depender de un retry de la app ante colisión.
-- =========================================================

ALTER TABLE appointments ADD COLUMN confirmation_code varchar(8);

CREATE UNIQUE INDEX uq_appointments_confirmation_code ON appointments (confirmation_code);

CREATE OR REPLACE FUNCTION generate_confirmation_code()
RETURNS TRIGGER AS $$
DECLARE
  -- se excluyen caracteres ambiguos (0/O, 1/I/L) para que sea legible cuando el cliente
  -- lo lee en voz alta o lo tipea desde un SMS
  v_alphabet   text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code       text;
  v_exists     boolean;
  v_attempts   int := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1);
    END LOOP;

    SELECT EXISTS (SELECT 1 FROM appointments WHERE confirmation_code = v_code) INTO v_exists;
    v_attempts := v_attempts + 1;

    EXIT WHEN NOT v_exists OR v_attempts > 10;
  END LOOP;

  IF v_attempts > 10 THEN
    RAISE EXCEPTION 'No se pudo generar un código de confirmación único tras 10 intentos';
  END IF;

  NEW.confirmation_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_confirmation_code
  BEFORE INSERT ON appointments
  FOR EACH ROW
  WHEN (NEW.confirmation_code IS NULL)
  EXECUTE FUNCTION generate_confirmation_code();

COMMENT ON COLUMN appointments.confirmation_code IS
  '6 caracteres alfanuméricos sin ambigüedad visual (sin 0/O/1/I/L). Generado en DB, nunca en la app.';

-- ─────────────────────────────────────────────────────────
-- NOTIFICATIONS (mínima, para encolar la confirmación en la misma transacción)
-- ─────────────────────────────────────────────────────────
CREATE TYPE notification_type AS ENUM ('confirmation', 'cancellation', 'reschedule', 'reminder');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

CREATE INDEX idx_notifications_pending ON notifications (status) WHERE status = 'pending';

COMMENT ON TABLE notifications IS
  'Se inserta en la MISMA transacción que crea/cancela/reprograma la cita. El envío real (push/SMS) lo hace un worker async que lee status=pending — si el envío falla, no revierte la reserva.';
