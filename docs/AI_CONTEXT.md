# AI_CONTEXT.md

> Lectura obligatoria #1. Si sos una IA nueva en este proyecto: leé este archivo,
> después AI_HANDOFF.md, CURRENT_STATE.md y ROADMAP.md, en ese orden, antes de tocar código.

## PROJECT

PWA SaaS multi-tenant de agendamiento para barberías. Mobile-first. Dos superficies:
cliente (reserva citas) y barbería (gestiona agenda). Ver `PRODUCT_VISION.md`.

## PRODUCT

Ver `PRODUCT_VISION.md` para visión completa. Resumen: "ABRIR → ELEGIR → RESERVAR → LISTO"
para el cliente; "ABRIR → VER AGENDA → ATENDER → SIGUIENTE CLIENTE" para la barbería.

## CURRENT LOOP

**Loop 07 — Business / Barbershop** (numeración canónica). Loops 00-06, 09, 10 y 11
completos; 08, 15 y 17 en progreso parcial. Ver `ROADMAP.md`.

## STATUS

**Backend, modelo de datos, autenticación y frontend de cliente: sólidos, testeados y
conectados entre sí.** El flujo completo de reserva (búsqueda pública → login OTP inline →
confirmar → éxito) funciona de punta a punta contra el backend real. **Falta:** toda la
gestión del lado barbería (no existe ni diseño de código, aunque sí de UX).

## COMPLETED

- Modelo de datos multi-tenant completo (13 migraciones SQL, `/migrations`)
- Motor de disponibilidad (funciones PL/pgSQL: `get_available_slots`, `get_available_slots_any_staff`)
- Anti doble-booking a nivel de constraint de base de datos (`EXCLUDE USING gist`), incluye buffer
- Backend TypeScript: `CatalogService`, `AvailabilityService`, `BookingService` (create/cancel/reschedule)
- API REST (Express): catálogo, disponibilidad, crear/cancelar/reprogramar citas
- Idempotencia real (header `Idempotency-Key`) + retry con backoff en el cliente HTTP
- 31 tests de backend/cliente HTTP pasando (concurrencia, cancelación, reprogramación, validadores, timeout/retry)
- Prototipo HTML+Tailwind de las 14 pantallas del cliente, probado con jsdom (21 tests de humo)
- Design System completo (tokens Tailwind, tipografía, componentes)
- Arquitectura UX de las 22 pantallas (cliente + barbería)

## IN PROGRESS

- Ninguna tarea de código a medio terminar al cierre de este loop — todo lo listado en
  COMPLETED está en un estado consistente y testeado.

## NEXT

Ver `ROADMAP.md`. El bloqueador que queda antes de un despliegue real:
1. Rate limiting (Loop 16) — todavía no implementado

Todo lo demás pendiente (Loop 07/08/12 gestión de barbería, Loop 14 PWA/offline, Loop 15
worker de notificaciones) es alcance de producto, no seguridad — pueden avanzar en paralelo.

## STACK

- **DB:** PostgreSQL 16 (`pgcrypto`, `btree_gist`)
- **Backend:** Node.js + TypeScript, Express, `pg` (node-postgres)
- **Frontend:** React + TypeScript (servicios/hooks listos) + prototipo HTML/Tailwind standalone
- **Testing:** Jest + ts-jest (backend), jsdom (prototipo HTML)
- **Infra local:** Docker Compose (Postgres con migraciones auto-aplicadas)

No cambiar este stack sin registrar la decisión en `DECISIONS_LOG.md`.

## ARCHITECTURE

Ver `ARCHITECTURE.md`. Resumen: shared database multi-tenant, `tenant_id` en cada tabla +
Row-Level Security, motor de disponibilidad vive en SQL (no en la app), la app captura
errores de Postgres (`23P01`, `P0001`) y los traduce a errores de dominio.

## DATABASE

Ver `DATABASE.md` y `/migrations` (fuente de verdad real — el `.md` es un resumen, no la
autoridad). 21 tablas, `EXCLUDE` constraint anti doble-booking, buffer con snapshot y columnas
generadas, máquina de estados de citas forzada por trigger.

## BUSINESS RULES

Ver `BUSINESS_RULES.md`.

## UX RULES

Ver `UX_GUIDELINES.md` y `DESIGN_SYSTEM.md`.

## SECURITY RULES

Ver `SECURITY_RULES.md`. **Gap crítico activo: no hay autenticación ni autorización
implementadas.** No tratar este proyecto como deployable hasta resolverlo.

## KNOWN ISSUES

Ver `KNOWN_ISSUES.md` — no repetir bugs ya identificados ahí.

## IMPORTANT DECISIONS

Ver `DECISIONS_LOG.md` — no re-abrir decisiones ya tomadas sin registrar por qué se revierten.

## FILES

Ver estructura completa en `PROJECT_CONTEXT.md`.

## DO NOT CHANGE

- El constraint `EXCLUDE` de `appointments` (migración 011) — es la única garantía real
  anti doble-booking. No reemplazar por lógica de aplicación.
- El patrón de Idempotency-Key en `booking.service.ts` y `booking-api-client.ts` — reintentos
  sin esto duplican citas.
- Las políticas RLS ya definidas — no desactivarlas "para simplificar" sin registrar la decisión.
- El fix de la migración 010 (`resolve_appointment_duration` debe devolver `NULL`, no `0`, si el
  barbero no ofrece el servicio) — revertirlo reintroduce el bug ya corregido (ISSUE-000-A).
- La numeración canónica de loops establecida en este checkpoint (`ROADMAP.md`) — no
  volver a renumerar sin un nuevo checkpoint explícito de Loop 00.

## LAST UPDATE

Checkpoint de reconciliación de Loop 00 (segunda plantilla oficial recibida) — ver
`CHANGELOG.md` para el detalle.
