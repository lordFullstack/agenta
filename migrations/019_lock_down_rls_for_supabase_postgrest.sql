-- =========================================================
-- 019_lock_down_rls_for_supabase_postgrest.sql
-- Estas 12 tablas nunca tuvieron RLS porque en el diseño original (Postgres
-- autohospedado vía docker-compose) solo el backend Express, con la connection
-- string de confianza, podía llegar a Postgres. Al desplegar sobre Supabase, el
-- schema `public` queda expuesto por PostgREST vía la anon key (pensada para ser
-- pública, embebida en el frontend). Sin RLS, cualquiera con esa key podría leer
-- users.password_hash, otp_codes, refresh_tokens, etc. directo por HTTP, sin pasar
-- por el backend ni su lógica de autorización.
--
-- Fix: habilitar RLS sin policies (= deny-all para los roles anon/authenticated que
-- usa PostgREST). El backend sigue funcionando sin cambios: se conecta con un rol
-- propio (rolbypassrls = true) y por lo tanto ignora RLS por completo. En Postgres
-- autohospedado (docker-compose, sin PostgREST) esto no tiene efecto observable.
-- =========================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reschedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE users IS
  'RLS habilitado sin policies (deny-all vía PostgREST/anon) al desplegar sobre Supabase — el backend accede vía un rol propio con rolbypassrls. Ver migración 019.';
