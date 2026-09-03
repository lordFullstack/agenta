# CURRENT_STATE.md

> Este documento debe reflejar el estado real, no el estado deseado.

## CURRENT LOOP

07 — Business / Barbershop (numeración canónica, ver `ROADMAP.md`)

## STATUS

TODO — no iniciado. Loop 11 (Customer Experience) se completó en este checkpoint, con la
salvedad de que el prototipo HTML standalone quedó fuera del alcance (ver `KNOWN_ISSUES.md`
ISSUE-004).

## LAST UPDATE

Cierre de Loop 11 (continuación) — frontend real conectado al backend autenticado.

---

## COMPLETED

| Ítem | Evidencia |
|---|---|
| Product Vision, Personas, JTBD, MVP/V2/Futuro | `PRODUCT_VISION.md` |
| Arquitectura UX (22 pantallas cliente + barbería) | `UX_GUIDELINES.md` |
| Design System (tokens, componentes, breakpoints) | `DESIGN_SYSTEM.md` |
| Modelo de datos multi-tenant (13 migraciones) | `/migrations/001` a `013`, `DATABASE.md` |
| Motor de disponibilidad (PL/pgSQL) + fix de validación | migración 009, 010 |
| Anti doble-booking + buffer a nivel de constraint | migración 011, verificado por test mockeado |
| Número de confirmación generado en DB | migración 013 |
| `CatalogService`, `AvailabilityService`, `BookingService` | `/backend/src`, 25 tests pasando |
| API REST de catálogo, disponibilidad, crear/cancelar/reprogramar | `availability.routes.ts` |
| Cliente HTTP con timeout, retry, idempotencia | `booking-api-client.ts`, 6 tests pasando |
| Hook de orquestación del flujo de 14 pasos (React) | `useBookingFlow.ts` |
| Componente React del flujo de reserva | `BookingFlow.tsx` (no testeado con RTL — ver Known Issues) |
| Prototipo HTML+Tailwind de 14 pantallas, interactivo | `booking-flow.html`, 21 tests de humo (jsdom) pasando |
| `docker-compose` + scripts de setup local | `docker-compose.yml`, `/scripts` |

| Autenticación (OTP clientes, password staff), JWT + refresh rotable | `backend/src/auth/`, migración 014, 38 tests backend en verde |
| Wiring real de `app.tenant_id` (RLS activo en runtime) | `backend/src/db/tenant-context.ts`, aplicado en `BookingService`/`AvailabilityService` |
| Split de RLS público (catálogo)/privado (operativo) | Migración 014, DEC-015 |
| Frontend React conectado al backend real, con login OTP inline | `frontend/src/api/booking-api-client.ts`, `useBookingFlow.ts`, `BookingFlow.tsx`, 13 tests en verde |

**Total de tests automatizados verificados en verde: 72** (38 backend + 13 cliente HTTP + 21
prototipo HTML).
El test de integración contra Postgres real (`booking.integration.test.ts`) está escrito pero
**no corrido** en este entorno por falta de una instancia de base de datos disponible.

## IN PROGRESS

Nada a medio terminar al cierre de este loop.

## PENDING

- Pantallas de gestión del lado barbería (Dashboard, Agenda, Clientes, Servicios, Barberos,
  Horarios, Configuración) — diseñadas en `UX_GUIDELINES.md`, no implementadas en código
- Manifest + Service Worker (instalabilidad PWA real) — no iniciado
- Notificaciones: se encolan en DB (tabla `notifications`) pero no hay worker que las envíe
- Rate limiting — no iniciado
- Payments (tabla existe, sin lógica de negocio ni integración con pasarela)
- Integración real de envío de OTP (hoy es un mock que loguea el código a consola)
- Conectar el prototipo HTML standalone (`booking-flow.html`) al backend — quedó
  deliberadamente fuera del alcance de Loop 11, ver `KNOWN_ISSUES.md` ISSUE-004

## BLOCKED

Nada bloqueado por dependencias externas al día de hoy.

## BUGS

Ninguno abierto conocido en el código entregado. (Ver `KNOWN_ISSUES.md` para gaps de alcance,
que no son lo mismo que bugs — un gap es algo no construido; un bug es algo construido que
funciona mal.)

## TECHNICAL DEBT

- `min_cancellation_lead_minutes` está hardcodeado con default de 120 min en el código de
  `BookingService`, no leído de una configuración por tenant (`tenants` no tiene todavía una
  columna de política de cancelación).
- `BookingFlow.tsx` no tiene tests (Jest+RTL) — solo el cliente HTTP que usa (`booking-api-client.ts`)
  está testeado. El prototipo HTML standalone sí tiene tests de humo, pero es un artefacto
  paralelo, no el mismo código que corre en producción.
- Confirmar que ningún documento viejo siga refiriendo al diseño de un solo esquema (el
  esquema vigente es el multi-tenant de `/migrations`, no la primera versión de la conversación).

## NEXT LOOP

Ver `ROADMAP.md`, primer ítem en estado `TODO`. Recomendado: Loop 7 — Autenticación y Autorización.
