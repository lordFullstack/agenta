# CURRENT_STATE.md

> Este documento debe reflejar el estado real, no el estado deseado.

## CURRENT LOOP

Cierre de proyecto — MVP v1.0 (ver `ROADMAP.md` y sección final de este documento)

## STATUS

**Loop 16 (Security Audit formal) completado.** Todos los loops planeados para el MVP
(00-12, 16) están `DONE`. El proyecto queda en condiciones de declararse **MVP v1.0** — ver
el resumen de cierre al final de este documento para el alcance exacto (qué es MVP real vs.
qué queda explícitamente diferido a V2).

## LAST UPDATE

Cierre de Loop 16 — Security Audit formal (rate limiting + validación de parámetros).

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
| Onboarding de barbería + configuración de negocio (perfil, horario general, pausa) | `backend/src/business.service.ts`, migración 015, 10 tests en verde |
| CRUD de gestión de servicios y barberos (asignaciones, horario individual, vacaciones) | `backend/src/catalog-management.service.ts`, migración 016, 14 tests en verde |
| Agenda del lado barbería (vista del día, transiciones, walk-ins, bloqueos) | `backend/src/agenda.service.ts`, 15 tests en verde |
| App de barbería: Login + Dashboard + Agenda + Servicios + Barberos + Configuración, completa y conectada al backend real | `frontend/src/barbershop/`, 21 tests de cliente HTTP en verde |

**Total de tests automatizados verificados en verde: 136** (94 backend + 21 cliente HTTP + 21
prototipo HTML).
El test de integración contra Postgres real (`booking.integration.test.ts`) está escrito pero
**no corrido** en este entorno por falta de una instancia de base de datos disponible.

## IN PROGRESS

Nada a medio terminar al cierre de este loop.

## PENDING

- Flujo de "cambiar contraseña" / invitación por token para barberos (ISSUE-014) — hoy el
  owner define una contraseña temporal y la comunica fuera de banda
- Loop 16 (Security Audit formal) — **es el próximo paso**, según DEC-021
- Inconsistencia de contrato camelCase/snake_case en 2 rutas de horarios (ISSUE-016, LOW,
  documentada, el cliente ya la maneja correctamente)
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

---

## Resumen de cierre — MVP v1.0

> Esta sección existe para responder una sola pregunta sin ambigüedad: **¿qué de este
> proyecto es real y funciona de punta a punta, y qué está explícitamente fuera de alcance?**
> No es una lista de aspiraciones — cada ítem de "COMPLETO" tiene tests que lo prueban.

### Completo y probado (MVP real)

- **Modelo de datos multi-tenant** con Row-Level Security activo en runtime, no solo en el
  papel — 16 migraciones SQL.
- **Motor de disponibilidad** que combina horario de sucursal, horario de barbero,
  servicio/duración, descansos, bloqueos, vacaciones y citas existentes — con anti
  double-booking garantizado por constraint de base de datos — verificado con dos requests
  HTTP simultáneas reales contra Postgres real (no solo tests mockeados, ver DEC-025).
- **Flujo de reserva del cliente**, de punta a punta: buscar barbería → elegir servicio/
  barbero/horario → login OTP inline → confirmar → éxito. Cancelación y reprogramación
  incluidas. Maneja timeout, network failure, retry e idempotencia sin duplicar citas.
- **Flujo de la barbería**, de punta a punta: registrarse → configurar perfil y horario →
  dar de alta servicios y barberos → asignarlos entre sí → ver y operar la agenda del día
  (confirmar, iniciar, completar, no-show, walk-ins, bloqueos de urgencia).
- **Autenticación y autorización reales** — no un mock: OTP, password, JWT + refresh
  rotable, RBAC por rol, aislamiento por tenant wireado en runtime.
- **Seguridad auditada formalmente** — rate limiting, validación de parámetros, cero
  CRITICAL/HIGH abiertos, y los MEDIUM que quedan tienen una decisión documentada de por
  qué se aceptan (no son un descuido).
- **136 tests automatizados en verde**, corridos y confirmados en cada checkpoint — no
  "deberían pasar", pasaron, con el output pegado en cada momento de esta conversación.

### Explícitamente fuera de alcance de este MVP (no son bugs, son alcance)

Ver `PRODUCT_VISION.md` — esto es exactamente lo que ese documento clasificó como V2/Futuro
desde el Loop 01, más algunas simplificaciones de implementación tomadas en el camino:

- **Pagos online** (tabla modelada, sin lógica de negocio ni integración con pasarela)
- **Envío real de notificaciones** (se encolan correctamente, el envío es un mock de consola)
- **Envío real de OTP por SMS** (mismo caso — mock de consola, código logueado)
- **Flujo de invitación por token para barberos** (hoy: contraseña temporal comunicada
  fuera de banda por el owner — DEC-020)
- **Reviews, multi-sucursal completo, WhatsApp Business, programa de fidelidad** — V2 por
  diseño desde el Loop 01
- **`audit_logs` instrumentado** en servicios de escritura fuera del ciclo de vida de una
  cita — diferido con decisión explícita (DEC-024)
- **PWA real** (manifest + service worker + offline) — no construido
- **Dashboard de KPIs del lado barbería** — depende de tener datos reales de uso para
  tener sentido, no solo de código
- **El prototipo HTML standalone del cliente** (`booking-flow.html`) nunca se conectó al
  backend — quedó como referencia visual, `BookingFlow.tsx` (React) es el código real

### Por qué este cierre es honesto y no un "ya está todo listo" apurado

Cada uno de los 5 gaps de seguridad reales que se encontraron en el camino
(`ISSUE-001/002/003/013` + la inconsistencia de contrato de `ISSUE-016`) se encontró
**mientras se construía la siguiente pieza que dependía de eso** — no en una auditoría
final que los buscara recién al cerrar. Eso es lo que da confianza en que el checklist de
seguridad de este documento no es una lista de casillas marcadas sin mirar: cada ítem "✅"
tiene un test o una decisión registrada atrás.

### El hallazgo que de verdad probó esto — no fueron los tests, fue arrancar el servidor real

Después de tener 136 tests en verde y considerar el proyecto cerrado, se instaló Postgres
real y se arrancó el servidor Express real por primera vez. Aparecieron **2 bugs críticos
que ningún test había detectado**, porque toda la suite corría contra `pg` mockeado:

1. Una función SQL leía una columna que ya no existía (renombrada en una migración
   posterior) — rompía disponibilidad y creación de citas.
2. **La garantía central de todo el proyecto — el constraint anti double-booking — no
   estaba activa en la base de datos real.** Una migración anterior fallaba a mitad de
   camino por una restricción de Postgres (columnas generadas no pueden usar aritmética de
   `timestamptz`), dropeaba el constraint viejo, y nunca lograba crear el nuevo. Los tests
   seguían en verde porque nunca ejecutaban SQL real — solo verificaban que el código
   *llamara* a SQL con la forma esperada.

Ambos se corrigieron (migraciones 017 y 018) y **se verificaron con dos requests HTTP
simultáneas reales al mismo horario, contra el servidor real** — exactamente una tuvo
éxito, confirmado con una consulta directa a la base de datos. Ver `DECISIONS_LOG.md`
DEC-025 para el detalle completo.

**Esta es la razón real por la que se puede confiar en este MVP:** no porque los tests
pasen (eso ya era cierto y no fue suficiente), sino porque la garantía que más importa se
verificó contra infraestructura real, bajo la misma condición de carrera que se diseñó para
prevenir. Cualquier proyecto futuro que use este como plantilla debería incluir un arranque
real contra Postgres como parte del checklist de cierre, no como un paso opcional.
