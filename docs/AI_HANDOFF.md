# AI_HANDOFF.md

> Generar/actualizar este documento cada vez que se cierra un loop o el usuario pide
> "migrar chat" / "cambiar de chat" / "preparar handoff" / "continuar en otro chat".

## PROJECT

PWA SaaS multi-tenant de agendamiento para barberías (mobile-first).

## CURRENT OBJECTIVE

Tener un MVP funcional: cliente reserva de punta a punta, barbería gestiona su agenda,
con aislamiento multi-tenant real y sin double-booking. Base de datos y backend están
sólidos; falta autenticación, conectar el frontend real al backend, y las pantallas de
gestión del lado barbería (hoy solo existe el flujo de cliente).

## CURRENT LOOP

**MVP v1.0 — cierre de proyecto.** Todos los loops planeados (00-12, 16) completos. Ver
`ROADMAP.md` y la sección "Resumen de cierre" en `CURRENT_STATE.md`.

## COMPLETED

- Product Vision, Personas, JTBD, MVP/V2/Futuro (`PRODUCT_VISION.md`)
- Arquitectura UX de 22 pantallas cliente+barbería (`UX_GUIDELINES.md`)
- Design System completo con tokens Tailwind (`DESIGN_SYSTEM.md`)
- Modelo de datos multi-tenant, 16 migraciones SQL numeradas (`DATABASE.md`, `/migrations`)
- Motor de disponibilidad en PL/pgSQL, con fix de validación de servicio-por-barbero
- Anti doble-booking + buffer enforced por constraint de base de datos, no por app
- Flujo de reserva completo: crear/cancelar/reprogramar, con idempotencia y manejo de
  concurrencia, timeout, network failure y retry
- Autenticación y autorización completas: OTP (clientes), password (staff/admin), JWT +
  refresh rotable, RBAC, wiring real de `app.tenant_id` (RLS activo en runtime)
- **Frontend React de cliente (`BookingFlow.tsx`) conectado al backend real**, con login OTP
  inline en el paso de confirmación, refresh automático ante `401`
- **Onboarding de barbería + configuración de negocio** (registro transaccional, perfil,
  horario general con validación, pausar/reactivar sucursal)
- **CRUD completo de servicios y barberos** (asignación bidireccional verificada, horario
  individual, vacaciones/licencias) — RLS agregado a `staff_hours`/`time_off` de paso
- **Agenda del lado barbería** (vista del día, transiciones de estado, walk-ins, bloqueos
  de urgencia) — con la restricción de que un `barber` solo ve/modifica sus propias citas,
  aunque RLS por sí solo lo dejaría ver todo su tenant (DEC-022)
- **App de barbería, completa:** Login, Dashboard, Agenda (con walk-in), Servicios,
  Barberos (con asignación de servicios inline), Configuración (perfil + horario general) —
  todas conectadas al backend real (`frontend/src/barbershop/`)
- **Security Audit formal (Loop 16):** rate limiting + validación de parámetros de ruta —
  0 CRITICAL, 0 HIGH abiertos
- Prototipo HTML+Tailwind interactivo de las 14 pantallas de cliente, testeado con jsdom
  (queda como referencia visual — no conectado al backend, ver `KNOWN_ISSUES.md` ISSUE-004)
- **136 tests automatizados en verde** (94 backend + 21 cliente HTTP + 21 prototipo HTML)

## IN PROGRESS

Ninguna tarea a medio terminar. **MVP v1.0 cerrado** — ver "Resumen de cierre" en
`CURRENT_STATE.md` para el alcance exacto (qué es MVP real vs. qué es V2 por diseño).

## NEXT ACTION

No hay bloqueadores para el MVP definido. Los próximos pasos posibles son todos V2 por
diseño (ver `CURRENT_STATE.md`): pagos, notificaciones/OTP reales, PWA/offline, dashboard
de KPIs, `audit_logs` instrumentado, invitación de barberos por token. Ninguno bloquea a
otro — se puede elegir por prioridad de negocio cuando se retome el proyecto.

## ARCHITECTURE

Shared database multi-tenant (`tenant_id` + Row-Level Security). Backend Node/TypeScript +
Express + `pg`. El motor de disponibilidad y las garantías críticas (doble-booking, buffer,
máquina de estados) viven en PostgreSQL (funciones PL/pgSQL, constraints, triggers), no en
la aplicación — la app consulta y traduce errores, no reimplementa la lógica. Detalle completo
en `ARCHITECTURE.md`.

## DATABASE

21+ tablas, 16 migraciones en `/migrations`, numeradas y ejecutables en orden. Resumen en
`DATABASE.md`. **La fuente de verdad real son los archivos `.sql`, no el resumen.**

## BUSINESS RULES

Ver `BUSINESS_RULES.md`. Las tres reglas no negociables: no doble-booking (DB-level), la
disponibilidad de frontend nunca es la fuente de verdad (el backend siempre re-valida), y
aislamiento multi-tenant absoluto (RLS + `tenant_id`).

## UX RULES

Mobile-first (320/375/390/430/768/1024+), thumb zone, bottom sheets, bottom nav, FAB solo
donde hay una acción dominante, glassmorphism moderado (solo overlays, nunca cards de
contenido). Reserva de cliente en el menor número de pasos posible: Barbería → Servicios →
Barbero → Calendario/Horarios (fusionados) → Confirmar → Éxito. Detalle en `UX_GUIDELINES.md`
y `DESIGN_SYSTEM.md`.

## SECURITY

**Auditado formalmente en Loop 16 — 0 CRITICAL, 0 HIGH abiertos.** Autenticación (OTP +
password), RBAC, RLS wireado en runtime, rate limiting, validación de parámetros de ruta —
todo implementado y testeado. 2 MEDIUM diferidos con decisión explícita: `audit_logs` sin
instrumentar (DEC-024) y refresh token en `localStorage` (DEC-018, con mitigaciones). Ver
`SECURITY_RULES.md` para el checklist completo con su resultado.

## KNOWN ISSUES

Ver `KNOWN_ISSUES.md` completo. Los más relevantes que quedan abiertos (todos de severidad
MEDIUM o menor — no hay ningún CRITICAL/HIGH sin resolver):
1. `audit_logs` sin instrumentar en servicios de escritura (MEDIUM, DEC-024)
2. Sin flujo de invitación por token para barberos — password temporal (MEDIUM, DEC-020)
3. Prototipo HTML standalone no conectado al backend (por diseño, ver ISSUE-004)

## RECENT DECISIONS

Ver `DECISIONS_LOG.md` (24 decisiones registradas). Las del cierre de este checkpoint:
DEC-021/022 (priorización Agenda→UI→Security Audit, y aislamiento por barbero en la
agenda), DEC-023 (rate limiter en memoria, no distribuido), DEC-024 (`audit_logs` diferido
conscientemente, no por descuido).

## FILES MODIFIED

Ver `CHANGELOG.md` para el detalle cronológico completo por loop.

## DO NOT BREAK

Idéntico a la sección "DO NOT BREAK" de `AI_CONTEXT.md` — no se duplica el detalle acá para
evitar que los dos documentos queden desincronizados; si uno cambia, actualizar el otro.

## LAST CHECKPOINT

**Cierre de MVP v1.0.** Loop 16 (Security Audit formal) completado — rate limiting,
validación de parámetros, checklist de `SECURITY_RULES.md` revisado con resultado 0
CRITICAL/0 HIGH. Todos los loops planeados para el MVP (00-12, 16) están `DONE`. Ver la
sección "Resumen de cierre" en `CURRENT_STATE.md` para el alcance exacto documentado —
qué es MVP real y probado, y qué queda explícitamente diferido a V2 (no son bugs, son
alcance). **Nota operativa:** este checkpoint incluyó un reinicio del entorno de desarrollo
a mitad de la auditoría — el trabajo se reconstruyó desde el último zip commiteado y se
re-verificó con la suite completa (94/94 backend) antes de continuar, sin pérdida real.

---

## INSTRUCTIONS FOR NEW AI

1. Leer `AI_HANDOFF.md` (este archivo).
2. Leer `AI_CONTEXT.md`.
3. Leer `CURRENT_STATE.md`.
4. Leer `ROADMAP.md`.
5. Leer `DEVELOPMENT_RULES.md`.
6. Inspeccionar el código real (`/migrations`, `/backend/src`, `/frontend/src`) — no asumir
   que la documentación describe el 100% del detalle de implementación.
7. Identificar el loop actual en `ROADMAP.md` (buscar el primer `TODO` o `IN PROGRESS`).
8. No asumir información que no esté documentada ni verificable en el código.
9. Continuar desde el último estado confirmado en `CURRENT_STATE.md` — no reabrir loops
   marcados `DONE` sin una razón explícita y sin registrar la decisión en `DECISIONS_LOG.md`.
