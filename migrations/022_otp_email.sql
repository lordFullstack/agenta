-- =========================================================
-- 022_otp_email.sql
-- Cambio de canal de verificación de clientes: de SMS a email (decisión de
-- producto — evita el costo por SMS y la integración de un proveedor de SMS).
-- `phone` sigue siendo la clave de identidad del cliente (se usa para contacto
-- y como FK lógica hacia users.phone); `email` es el canal donde se manda el
-- código.
-- =========================================================

ALTER TABLE otp_codes ADD COLUMN email varchar(255);
