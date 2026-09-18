-- =========================================================
-- 021_tenants_description.sql
-- FIX: BusinessService.getTenantProfile/updateTenantProfile (business.service.ts)
-- leen y escriben tenants.description desde el Loop 07, pero la migración 002
-- nunca agregó esa columna — GET/PUT /v1/tenants/:id rompían con
-- "column \"description\" does not exist" en cualquier base real (nunca detectado
-- por los tests, que mockean `pg`). Encontrado al usar la pantalla de
-- Configuración del panel de barbería contra Supabase real.
-- =========================================================

ALTER TABLE tenants ADD COLUMN description text;
