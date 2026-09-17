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

**MVP v1.0 — cierre de proyecto.** Todos los loops planeados (00-12, 16) completos. Ver
`ROADMAP.md` y la sección "Resumen de cierre" al final de `CURRENT_STATE.md`.

## STATUS

**MVP completo y auditado: backend + frontend de cliente, backend + frontend de barbería,
autenticación/RBAC/RLS reales, seguridad auditada formalmente (0 CRITICAL, 0 HIGH abiertos).
136 tests automatizados en verde.** Lo que queda pendiente es V2 por diseño (pagos,
notificaciones reales, PWA, dashboard de KPIs) — no son bugs, son alcance explícitamente
diferido desde `PRODUCT_VISION.md`.

## COMPLETED

- Modelo de datos multi-tenant completo (16 migraciones SQL, `/migrations`)
- Motor de disponibilidad (funciones PL/pgSQL: `get_available_slots`, `get_available_slots_any_staff`)
- Anti doble-booking a nivel de constraint de base de datos (`EXCLUDE USING gist`), incluye buffer
- Backend TypeScript: `CatalogService`, `AvailabilityService`, `BookingService`,
  `BusinessService`, `CatalogManagementService`, `AgendaService` (create/cancel/reschedule +
  onboarding/config de negocio + CRUD de servicios/barberos/horarios/vacaciones + agenda)
- Autenticación y autorización completas: OTP, password, JWT + refresh, RBAC, RLS wireado
- Rate limiting + validación de parámetros de ruta (Loop 16)
- API REST (Express): catálogo, disponibilidad, crear/cancelar/reprogramar citas, agenda,
  gestión de negocio/servicios/barberos
- Idempotencia real (header `Idempotency-Key`) + retry con backoff en el cliente HTTP
- Frontend de cliente (`BookingFlow.tsx`) y de barbería (`BarbershopApp.tsx`) completos,
  conectados al backend real
- Prototipo HTML+Tailwind de las 14 pantallas del cliente, probado con jsdom (referencia
  visual, no conectado al backend)
- Design System completo (tokens Tailwind, tipografía, componentes)
- Arquitectura UX de las 22 pantallas (cliente + barbería)
- 136 tests automatizados en verde (94 backend + 21 cliente HTTP + 21 prototipo HTML)

## IN PROGRESS

Ninguna tarea a medio terminar. **MVP v1.0 cerrado.**

## NEXT

No hay bloqueadores pendientes para el MVP definido. Los próximos pasos son todos V2 por
diseño — ver "Explícitamente fuera de alcance" en `CURRENT_STATE.md` para la lista completa
(pagos, notificaciones/OTP reales, PWA/offline, dashboard de KPIs, `audit_logs`
instrumentado, invitación de barberos por token).

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

Ver `SECURITY_RULES.md`. **0 CRITICAL, 0 HIGH abiertos** al cierre de Loop 16. 2 MEDIUM
diferidos con decisión documentada (DEC-018, DEC-024) — no son gaps sin dueño.

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
