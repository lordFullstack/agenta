-- =========================================================
-- 025_tenant_profile_links.sql
-- Perfil público de la barbería: redes sociales.
-- La dirección ya existe (branches.address, migración 002) y la descripción también
-- (tenants.description, migración 021): lo nuevo es que ahora se pueden editar desde el
-- panel y se muestran en el perfil. Guardan la URL ya normalizada (https://...); el
-- backend valida que sea de instagram.com / facebook.com antes de escribirla.
-- =========================================================

ALTER TABLE tenants ADD COLUMN instagram_url text;
ALTER TABLE tenants ADD COLUMN facebook_url text;
