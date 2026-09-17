# ROADMAP.md

> Numeración canónica oficial (definida en el Loop 00 formal). Reemplaza la numeración
> ad-hoc usada antes de este checkpoint — el trabajo ya hecho se **mapea** a esta
> numeración, no se resetea. Estados: `TODO / IN PROGRESS / DONE / BLOCKED`.

| LOOP | NAME | STATUS | DEPENDENCIES | COMPLETED | BLOCKERS | NEXT |
|---|---|---|---|---|---|---|
| 00 | Memory & Context | DONE | — | Sí — `/docs` completo, 16 documentos + este checkpoint de reconciliación | — | — |
| 01 | Product Discovery | DONE | Loop 00 | Sí — `PRODUCT_VISION.md` (visión, personas, JTBD, MVP/V2/futuro, KPIs) | — | — |
| 02 | UX Architecture | DONE | Loop 01 | Sí — `UX_GUIDELINES.md`, 22 pantallas especificadas (cliente + barbería) | — | — |
| 03 | Design System | DONE | Loop 02 | Sí — `DESIGN_SYSTEM.md`, tokens Tailwind, 20 categorías de componentes | — | — |
| 04 | Technical Architecture | DONE | Loop 03 | Sí — `ARCHITECTURE.md`: stack confirmado (Node/TS/Express/Postgres/React), capas, decisión de multi-tenancy | — | — |
| 05 | Database | DONE | Loop 04 | Sí — 13 migraciones SQL, 21 tablas, `DATABASE.md` | — | — |
| 06 | Authentication & RBAC | **DONE** | Loop 05 | Sí — OTP para clientes, login con password para staff/admin, JWT + refresh rotable, middleware `authenticate`/`requireRole`/`requireCustomerIdentity`, wiring real de `app.tenant_id` vía `SET LOCAL` en `BookingService`/`AvailabilityService`, split de RLS público/privado (DEC-015/016/017). 38 tests backend en verde. | — | — |
| 07 | Business / Barbershop (onboarding, config de negocio) | **DONE** | Loop 06 | Sí — registro de barbería (usuario+tenant+branch+membership transaccional), edición de perfil, horario general (CRUD completo), pausar/reactivar sucursal. RLS agregado a `business_hours` (gap encontrado y corregido, migración 015). 48 tests backend en verde. | — | — |
| 08 | Services & Barbers (gestión) | **DONE** | Loop 05, 06, 07 | Sí — CRUD completo de servicios, invitación de barberos (con simplificación de password temporal, DEC-020), asignación servicio↔barbero (verificada en ambos sentidos), horario individual, vacaciones/licencias. RLS agregado a `staff_hours`/`time_off` (ISSUE-013 resuelto, migración 016). 62 tests backend en verde. | — | — |
| 09 | Scheduling Engine | DONE | Loop 05 | Sí — `business_hours`/`staff_hours`/`time_off`/`blocked_slots` + motor de disponibilidad PL/pgSQL, con fix de validación de servicio y buffer enforced por constraint | — | — |
| 10 | Booking Engine | DONE | Loop 09 | Sí — crear/cancelar/reprogramar, anti double-booking real, idempotencia, timeout/retry, 31 tests en verde | — | — |
| 11 | Customer Experience | **DONE** (con salvedad) | Loop 03, 10, 06 | UI completa + endpoints protegidos + frontend real (`BookingFlow.tsx`) conectado con login OTP inline, refresh automático y 13 tests nuevos en verde. **Salvedad:** el prototipo HTML standalone (`booking-flow.html`) sigue sin conectar — quedó como referencia visual, no es el código de producción. | — | — |
| 12 | Barbershop Agenda | **DONE** | Loop 06, 10, 08 | Sí — vista del día (con restricción de rol: barber solo ve las suyas, DEC-022), transiciones de estado, walk-ins (mismo constraint anti double-booking que la reserva de cliente), bloqueos de urgencia. 77 tests backend en verde. **UI conectada al backend real** (login, Dashboard, Agenda con walk-in) — ver fila siguiente. | — | — |
| — | UI de barbería (consolidada, DEC-021) | **DONE** | Loop 07, 08, 12 | Sí — las 6 pantallas completas (Login, Dashboard, Agenda con walk-in, Servicios, Barberos con asignación de servicios, Configuración con perfil y horario general), todas conectadas al backend real. Se encontró y corrigió una inconsistencia real de contrato (`setBusinessHours` esperaba camelCase, no snake_case). Se agregaron 2 endpoints de lectura que faltaban (`GET /v1/admin/staff`, `GET /v1/tenants/:id`). 21 tests de cliente HTTP + 82 de backend en verde. | — | Security Audit formal (Loop 16) |
| 13 | Dashboard & KPIs | TODO | Loop 12 | No — Loop 12 ya no bloquea | Ninguno — desbloqueado | — |
| 14 | PWA & Offline | TODO | Loop 11 | No — sin manifest ni service worker todavía | — | — |
| 15 | Notifications | **IN PROGRESS** | Loop 10 | Parcial — se encolan transaccionalmente (tabla `notifications`), falta el worker de envío real | — | — |
| 16 | Security Audit | **DONE** | Loop 06 | Sí — rate limiting (DEC-023), validación de UUIDs en 13 rutas, checklist completo revisado (`SECURITY_RULES.md`). 0 CRITICAL, 0 HIGH abiertos. 2 MEDIUM diferidos con decisión documentada (DEC-024: `audit_logs` sin instrumentar; DEC-018: refresh token en localStorage). 12 tests nuevos, 94/94 backend en verde. | — | — |
| 17 | QA | **IN PROGRESS** | Todos los anteriores | Parcial — 52 tests automatizados (backend + cliente HTTP + prototipo HTML), pero sin auditoría formal de offline/tablet/permissions | — | — |
| 18 | Performance | TODO | Loop 17 | No | — | — |
| 19 | Mobile UX Audit | TODO | Loop 11 | No — diseño validado visualmente, sin auditoría formal | — | — |
| 20 | Release Candidate | TODO | Loop 16, 17, 18, 19 | No | Bloqueado por Loops 06 y 16 (CRITICAL) | — |

## Reconciliación con la numeración anterior (histórica, para trazabilidad)

La numeración usada antes de este checkpoint (Loop 0, 1, 1.1, 6.3, 6.4, 6.5) queda
mapeada así — no se perdió ningún trabajo, solo se renumeró:

| Numeración anterior | Numeración canónica actual |
|---|---|
| Loop 0 (Product Discovery) | Loop 01 |
| Arquitectura UX | Loop 02 |
| Design System | Loop 03 |
| Loop 1 / 1.1 (Modelo de datos) | Loop 05 (Loop 04 se documentó implícitamente junto con las decisiones de stack) |
| Loop 6.3 (Motor de disponibilidad + fixes) | Loop 09 |
| Loop 6.4 (Flujo de reserva end-to-end) | Loop 10 |
| Loop 6.5 (Pantallas de cliente HTML) | Loop 11 (parcial — falta conectar al backend) |

## Notas de secuenciación

- **Loop 06 es el bloqueador de mayor impacto** — desbloquea 07, 12, 16, y permite cerrar
  11 (conectar frontend) con seguridad real.
- Loop 08 puede avanzar en paralelo a Loop 06 en lo que es puro schema/lectura, pero
  cualquier endpoint de escritura para gestión de servicios/barberos debe esperar a Loop 06.
- Loop 20 (Release Candidate) no puede declararse mientras existan CRITICAL abiertos —
  hoy hay 2 (ver `KNOWN_ISSUES.md`).

## Priorización decidida tras el cierre de Loop 08 (ver DECISIONS_LOG.md DEC-021)

Con Loops 00-08, 09, 10 y 11 en `DONE`, el orden recomendado para lo que sigue es:

1. **Loop 12 (Agenda, backend)** — completa la superficie funcional mínima del lado
   barbería ("ABRIR → VER AGENDA → ATENDER → SIGUIENTE CLIENTE", `PRODUCT_VISION.md`).
   Reutiliza infraestructura ya construida (estados de cita, RBAC, tenant-guard).
2. **UI del lado barbería, consolidada** — deliberadamente después de Loop 12, no antes:
   construirla una sola vez contra la API completa evita re-trabajo de UI en dos pasadas
   (una para 07/08, otra para 12).
3. **Loop 16 (Security Audit formal)** — después de tener la superficie completa del MVP
   para auditar todo junto, no en pedazos (aunque cada loop ya viene auto-auditándose:
   ISSUE-001/002/003/013 se encontraron y corrigieron en el mismo loop que los introdujo).
4. **Loop 15 (worker de notificaciones)** — no bloquea nada, sube de prioridad con usuarios reales.
5. **Loops 14/18/19 (PWA/offline, performance, auditoría UX)** — endurecimiento, tiene más
   sentido con uso real que auditar.
6. **Loop 20 (Release Candidate)** — bloqueado por 16/17/18/19, sin excepciones.

No priorizado explícitamente: Loop 13 (Dashboard/KPIs) depende de Loop 12, no puede ir antes.
