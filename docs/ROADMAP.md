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
| 07 | Business / Barbershop (onboarding, config de negocio) | TODO | Loop 06 | No — solo diseñado en `UX_GUIDELINES.md`, sin código | Loop 06 ya no bloquea — puede arrancar | — |
| 08 | Services & Barbers (gestión) | **IN PROGRESS** | Loop 05, 06 | Parcial — schema y lectura pública listos; CRUD de gestión ahora puede protegerse con `requireRole('owner','branch_admin')`, pero las rutas todavía no existen | Ninguno — desbloqueado | — |
| 09 | Scheduling Engine | DONE | Loop 05 | Sí — `business_hours`/`staff_hours`/`time_off`/`blocked_slots` + motor de disponibilidad PL/pgSQL, con fix de validación de servicio y buffer enforced por constraint | — | — |
| 10 | Booking Engine | DONE | Loop 09 | Sí — crear/cancelar/reprogramar, anti double-booking real, idempotencia, timeout/retry, 31 tests en verde | — | — |
| 11 | Customer Experience | **DONE** (con salvedad) | Loop 03, 10, 06 | UI completa + endpoints protegidos + frontend real (`BookingFlow.tsx`) conectado con login OTP inline, refresh automático y 13 tests nuevos en verde. **Salvedad:** el prototipo HTML standalone (`booking-flow.html`) sigue sin conectar — quedó como referencia visual, no es el código de producción. | — | — |
| 12 | Barbershop Agenda | TODO | Loop 06, 10 | No — diseñado en `UX_GUIDELINES.md`, sin código | Ninguno — desbloqueado | — |
| 13 | Dashboard & KPIs | TODO | Loop 12 | No | — | — |
| 14 | PWA & Offline | TODO | Loop 11 | No — sin manifest ni service worker todavía | — | — |
| 15 | Notifications | **IN PROGRESS** | Loop 10 | Parcial — se encolan transaccionalmente (tabla `notifications`), falta el worker de envío real | — | — |
| 16 | Security Audit | TODO | Loop 06 | No | Ninguno — desbloqueado, puede arrancar | — |
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
