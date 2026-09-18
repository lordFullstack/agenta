-- =========================================================
-- 023_media_and_trust_signals.sql
-- Perfil público de la barbería: logo, portada, foto de barbero.
-- Los archivos se guardan en Supabase Storage (bucket "tenant-media",
-- público); estas columnas guardan la URL pública resultante, no el binario.
-- =========================================================

ALTER TABLE tenants ADD COLUMN logo_url text;
ALTER TABLE tenants ADD COLUMN cover_url text;
ALTER TABLE staff_members ADD COLUMN photo_url text;
