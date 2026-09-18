-- =========================================================
-- 020_fix_function_search_path.sql
-- Endurecimiento estándar contra hijacking de search_path: fija el search_path
-- de cada función a `public` explícitamente, en vez de heredar el de la sesión
-- que la invoca. Sin efecto funcional — es una buena práctica de seguridad
-- recomendada por Supabase (y por Postgres en general) para funciones SECURITY
-- DEFINER o expuestas indirectamente vía API.
-- =========================================================

ALTER FUNCTION set_updated_at() SET search_path = public;
ALTER FUNCTION check_appointment_against_blocks() SET search_path = public;
ALTER FUNCTION validate_appointment_status_transition() SET search_path = public;
ALTER FUNCTION log_appointment_status_change() SET search_path = public;
ALTER FUNCTION reject_audit_log_mutation() SET search_path = public;
ALTER FUNCTION resolve_appointment_duration(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION get_working_windows(uuid, date) SET search_path = public;
ALTER FUNCTION get_available_slots(uuid, uuid[], date, int, int) SET search_path = public;
ALTER FUNCTION get_available_slots(uuid, uuid[], date, int, int, int) SET search_path = public;
ALTER FUNCTION get_available_slots_any_staff(uuid, uuid[], date, int, int) SET search_path = public;
ALTER FUNCTION generate_confirmation_code() SET search_path = public;
ALTER FUNCTION snapshot_buffer_and_occupied_range() SET search_path = public;
ALTER FUNCTION recompute_occupied_range_on_reschedule() SET search_path = public;
