# DATABASE.md

> **Este documento es un resumen de navegación. La fuente de verdad real son los archivos
> en `/migrations` — si hay una discrepancia, el SQL manda.**

## Migraciones (orden de ejecución)

| # | Archivo | Contenido |
|---|---|---|
| 001 | `extensions_and_types.sql` | Extensiones (`pgcrypto`, `btree_gist`), enums compartidos, `set_updated_at()` |
| 002 | `tenancy_core.sql` | `tenants`, `branches` — soft delete, audit fields, RLS |
| 003 | `staff_and_customers.sql` | `users`, `tenant_memberships`, `staff_members`, `customers`, `customer_profiles` |
| 004 | `services.sql` | `services`, `staff_services` |
| 005 | `scheduling.sql` | `business_hours`, `staff_hours`, `time_off`, `blocked_slots` |
| 006 | `appointments.sql` | `appointments` (+ `EXCLUDE` constraint), triggers de bloqueos y máquina de estados, `appointment_items`, `appointment_status_history`, `appointment_reschedules` |
| 007 | `payments.sql` | `payments` (modelado para V2, sin lógica de negocio aún) |
| 008 | `audit_log.sql` | `audit_logs` — inmutable (triggers rechazan `UPDATE`/`DELETE`) |
| 009 | `availability_engine.sql` | Funciones PL/pgSQL del motor de disponibilidad (versión inicial) |
| 010 | `availability_engine_fix.sql` | Fix: valida que el barbero ofrezca el servicio; valida tenant/branch/staff activos |
| 011 | `buffers_and_occupied_range.sql` | Buffer antes/después enforced por el `EXCLUDE` (columnas generadas + snapshot) |
| 012 | `idempotency_keys.sql` | Tabla de deduplicación de requests |
| 013 | `confirmation_codes.sql` | Código de confirmación generado en trigger, tabla `notifications` |

## Entidades por dominio

**Tenancy:** `tenants`, `branches`, `tenant_memberships`
**Identidad:** `users`, `staff_members`, `customers`, `customer_profiles`
**Catálogo:** `services`, `staff_services`
**Scheduling:** `business_hours`, `staff_hours`, `time_off`, `blocked_slots`
**Core transaccional:** `appointments`, `appointment_items`, `appointment_status_history`,
`appointment_reschedules`
**Soporte:** `payments`, `notifications`, `idempotency_keys`, `audit_logs`

## Constraints/mecanismos no obvios (leer antes de tocar el schema)

- **`appointments.no_overlapping_appointments`** (`EXCLUDE USING gist`): previene
  double-booking incluyendo buffer. Usa `occupied_starts_at`/`occupied_ends_at` (columnas
  generadas), no `starts_at`/`ends_at` directamente.
- **`uq_appointments_confirmation_code`**: único, generado por trigger con retry interno
  (hasta 10 intentos) ante colisión — nunca se genera en la aplicación.
- **Índices únicos parciales** (`WHERE deleted_at IS NULL`) en tablas con soft delete —
  la unicidad de `slug`, nombre de servicio, etc. solo aplica entre registros vivos.
- **RLS habilitado** en `branches`, `staff_members`, `customer_profiles`, `services`,
  `blocked_slots`, `appointments`, `payments`, `audit_logs` — requiere `app.tenant_id`
  seteado por sesión (no wireado en runtime todavía, ver `SECURITY_RULES.md`).
- **Triggers de auditoría de estado**: `appointment_status_history` se llena automáticamente
  vía trigger en cada `INSERT`/`UPDATE` de `appointments.status` — nunca escribir ahí manualmente.

## Ver también

- `ARCHITECTURE.md` — cómo estas tablas se conectan con el motor de disponibilidad y la API.
- `BUSINESS_RULES.md` — el "por qué" de cada constraint.
- `../docs/modelo-de-datos-pwa-barberias.md` — documento narrativo original del modelo
  (Loop 1, pre-refinamiento multi-tenant) — histórico, mantenido por trazabilidad pero **no
  es la versión vigente del schema**.
