-- =========================================================
-- 007_payments.sql
-- Pagos asociados a una cita (soporta reintentos: 1 cita puede tener N intentos de pago)
-- =========================================================

CREATE TABLE payments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  appointment_id             uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,

  amount                     numeric(10,2) NOT NULL CHECK (amount >= 0),
  refunded_amount            numeric(10,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  method                     payment_method NOT NULL,
  status                     payment_status NOT NULL DEFAULT 'pending',

  provider                   varchar(50),
  provider_transaction_id    varchar(150),

  paid_at                    timestamptz,
  refunded_at                timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_refund_not_exceed_amount CHECK (refunded_amount <= amount)
);

CREATE INDEX idx_payments_appointment ON payments (appointment_id);
CREATE INDEX idx_payments_tenant      ON payments (tenant_id);

-- Evita registrar dos veces la misma transacción de la pasarela de pago
CREATE UNIQUE INDEX uq_payments_provider_txn
  ON payments (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payments ON payments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
