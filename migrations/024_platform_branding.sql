-- =========================================================
-- 024_platform_branding.sql
-- Fotos de fondo de la plataforma (no de una barbería): la pantalla de inicio
-- ("hero") y la de búsqueda ("search_bg") del lado cliente. Las sube únicamente el
-- administrador de la plataforma desde Configuración (ver PLATFORM_ADMIN_PHONES en
-- .env.example). El archivo vive en Supabase Storage; acá solo va la URL pública.
-- Sin fila para un slot = la app usa la imagen por defecto de frontend/public/img.
-- =========================================================

CREATE TABLE platform_branding (
  slot        text PRIMARY KEY CHECK (slot IN ('hero', 'search_bg')),
  image_url   text NOT NULL,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Igual que las tablas de la migración 019: RLS sin policies = deny-all para PostgREST/anon.
-- El backend se conecta con un rol que ignora RLS, así que la lectura pública pasa por
-- GET /v1/platform/branding, no por la anon key.
ALTER TABLE platform_branding ENABLE ROW LEVEL SECURITY;
