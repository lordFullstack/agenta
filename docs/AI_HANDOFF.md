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

**Loop 07 — Business / Barbershop** (numeración canónica). Loops 00-06, 09, 10 y 11
completos; 08, 15 y 17 en progreso parcial. Ver `ROADMAP.md`.

## COMPLETED

- Product Vision, Personas, JTBD, MVP/V2/Futuro (`PRODUCT_VISION.md`)
- Arquitectura UX de 22 pantallas cliente+barbería (`UX_GUIDELINES.md`)
- Design System completo con tokens Tailwind (`DESIGN_SYSTEM.md`)
- Modelo de datos multi-tenant, 14 migraciones SQL numeradas (`DATABASE.md`, `/migrations`)
- Motor de disponibilidad en PL/pgSQL, con fix de validación de servicio-por-barbero
- Anti doble-booking + buffer enforced por constraint de base de datos, no por app
- Flujo de reserva completo: crear/cancelar/reprogramar, con idempotencia y manejo de
  concurrencia, timeout, network failure y retry
- Autenticación y autorización completas: OTP (clientes), password (staff/admin), JWT +
  refresh rotable, RBAC, wiring real de `app.tenant_id` (RLS activo en runtime)
- **Frontend React (`BookingFlow.tsx`) conectado al backend real**, con login OTP inline en
  el paso de confirmación, refresh automático ante `401`, e identidad derivada del token
- Prototipo HTML+Tailwind interactivo de las 14 pantallas de cliente, testeado con jsdom
  (queda como referencia visual — no conectado al backend, ver `KNOWN_ISSUES.md` ISSUE-004)
- 38 tests de backend + 13 de API client + 21 de humo del prototipo HTML, todos en verde
  (72 total)

## IN PROGRESS

Nada a medio terminar — este es un buen punto de corte para handoff.

## NEXT ACTION

Dos frentes disponibles, sin bloqueadores entre sí:
1. **Loop 07:** onboarding y configuración de negocio del lado barbería.
2. **Loop 08 (continuación):** rutas de gestión de servicios/barberos protegidas con
   `requireRole('owner', 'branch_admin')`.

## ARCHITECTURE

Shared database multi-tenant (`tenant_id` + Row-Level Security). Backend Node/TypeScript +
Express + `pg`. El motor de disponibilidad y las garantías críticas (doble-booking, buffer,
máquina de estados) viven en PostgreSQL (funciones PL/pgSQL, constraints, triggers), no en
la aplicación — la app consulta y traduce errores, no reimplementa la lógica. Detalle completo
en `ARCHITECTURE.md`.

## DATABASE

21 tablas, 13 migraciones en `/migrations`, numeradas y ejecutables en orden. Resumen en
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

**No implementado todavía: autenticación, autorización por rol, rate limiting.** RLS está
definido en las migraciones pero requiere que la app haga `SET app.tenant_id` por conexión/
transacción — **ese wiring todavía no existe en el código del backend**. Ver `SECURITY_RULES.md`
y `KNOWN_ISSUES.md` (marcado como CRITICAL).

## KNOWN ISSUES

Ver `KNOWN_ISSUES.md` completo. Los tres más importantes:
1. Sin autenticación/autorización (CRITICAL)
2. RLS sin wiring de `app.tenant_id` en el pool de conexiones (CRITICAL)
3. Frontend (React y HTML) no conectado al backend real, usa datos de demo (HIGH)

## RECENT DECISIONS

Ver `DECISIONS_LOG.md`. Las más recientes y con más impacto: DEC-009 (buffer enforced vía
columnas generadas + constraint, no solo cálculo de slots), DEC-011 (Idempotency-Key
obligatoria en endpoints mutantes), DEC-013 (fusión de pantallas Calendario+Horarios en el
cliente para minimizar pasos).

## FILES MODIFIED

Ver `CHANGELOG.md` para el detalle cronológico completo por loop.

## DO NOT BREAK

Idéntico a la sección "DO NOT BREAK" de `AI_CONTEXT.md` — no se duplica el detalle acá para
evitar que los dos documentos queden desincronizados; si uno cambia, actualizar el otro.

## LAST CHECKPOINT

Reconciliación de Loop 00 con la plantilla oficial (segunda versión recibida) — numeración
canónica de loops establecida (00-20), `KNOWN_ISSUES.md` y `CHANGELOG.md` reformateados a
los templates exactos especificados. Ver `CHANGELOG.md` para el detalle completo.

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
