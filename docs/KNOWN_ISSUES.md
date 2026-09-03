# KNOWN_ISSUES.md

Severidades: `CRITICAL / HIGH / MEDIUM / LOW`. Nunca ocultar problemas conocidos.
No declarar Release Candidate (Loop 20) con CRITICAL abiertos.

---

**ISSUE-001**
DATE: Loop 06 (identificado en checkpoint de Loop 00 reconciliado)
SEVERITY: CRITICAL
DESCRIPTION: No existe autenticación en ningún endpoint del backend.
REPRODUCTION: Llamar a cualquier endpoint de `/v1/*` sin ningún header de auth — responde
normalmente, sin rechazar la request.
CAUSE: Loop 06 (Authentication & RBAC) todavía no se ejecutó — fue una decisión de
secuenciación explícita (ver `DECISIONS_LOG.md` DEC-014), no un descuido.
WORKAROUND: No exponer estos endpoints fuera de un entorno de desarrollo local.
STATUS: **Resuelto en Loop 06** — ver sección "Resueltos en Loop 06" más abajo.
FIX: `auth.service.ts`, `token.service.ts`, `otp.service.ts`, `middleware.ts` (migración 014).

---

**ISSUE-002**
DATE: Loop 06/08 (identificado en checkpoint de Loop 00 reconciliado)
SEVERITY: CRITICAL
DESCRIPTION: No existe autorización por rol (RBAC) — cualquier request puede, en teoría,
actuar sobre datos de cualquier `customer_id`/`tenant_id` que se le pase en el body.
REPRODUCTION: Llamar a `POST /v1/appointments/:id/cancel` con un `cancelled_by` arbitrario,
sin verificación de que ese usuario sea dueño de la cita.
CAUSE: Mismo motivo que ISSUE-001 — Loop 06 no ejecutado todavía.
WORKAROUND: Ninguno más allá de no exponer los endpoints. No mitigar con validación
superficial en frontend — la regla del proyecto es que la autorización vive en backend.
STATUS: **Resuelto en Loop 06** para el flujo de cliente — ver DEC-017. Rutas de gestión de
barbería (Loop 07/08/12) todavía no existen, así que no aplica todavía ahí.
FIX: `requireRole`/`requireCustomerIdentity` en `middleware.ts`, aplicados en `availability.routes.ts`.

---

**ISSUE-003**
DATE: Loop 05 (identificado en checkpoint de Loop 00 reconciliado)
SEVERITY: CRITICAL
DESCRIPTION: Las políticas de Row-Level Security están definidas en las migraciones pero la
aplicación nunca ejecuta `SET app.tenant_id` — sin esa variable de sesión, las policies
comparan contra `NULL` y deniegan todo.
REPRODUCTION: Correr cualquier query contra una tabla con RLS habilitado (`branches`,
`staff_members`, `appointments`, etc.) sin haber seteado `app.tenant_id` en la sesión —
devuelve 0 filas aunque existan datos.
CAUSE: El wiring de tenant-por-request depende de que exista una capa de sesión/auth, que
todavía no existe (ver ISSUE-001).
WORKAROUND: En desarrollo local, correr las migraciones con RLS deshabilitado temporalmente
o setear `app.tenant_id` manualmente por sesión de prueba — **no hacer esto en ningún
entorno compartido**.
STATUS: **Resuelto en Loop 06** para las rutas existentes — ver DEC-015/016 y la salvedad
en "Resueltos en Loop 06" más abajo (no es automático para rutas futuras).
FIX: `db/tenant-context.ts` (`withTenantContext`, `SET LOCAL`), aplicado en `BookingService`
y `AvailabilityService`. Migración 014 además separa RLS público/privado (DEC-015).

---

**ISSUE-004**
DATE: Loop 11
SEVERITY: HIGH (parcialmente resuelto — ver STATUS)
DESCRIPTION: Ni `BookingFlow.tsx` (React) ni `booking-flow.html` (prototipo standalone)
estaban conectados al backend real — ambos usaban datos de demostración hardcodeados.
REPRODUCTION (histórica): Abrir cualquiera de los dos y completar el flujo de reserva — no
se hacía ninguna llamada de red real, todo el estado era local/simulado.
CAUSE: Se priorizó validar la UX y la lógica de negocio del backend por separado antes de
integrarlos, para reducir superficie de debugging simultánea.
WORKAROUND: N/A.
STATUS: **`BookingFlow.tsx` resuelto en este checkpoint** — conectado al backend real con
login OTP inline, tokens, y refresh automático (13 tests nuevos en verde). **`booking-flow.html`
sigue sin conectar** — queda deliberadamente como referencia visual estática, no es el código
que corre en producción. Si se necesita mantenerlo sincronizado con el backend real en algún
momento, es trabajo aparte, no asumir que ya lo está.
FIX: `frontend/src/api/booking-api-client.ts`, `frontend/src/hooks/useBookingFlow.ts`,
`frontend/src/components/BookingFlow.tsx`.

---

**ISSUE-005**
DATE: Loop 16 (bloqueado, no iniciado)
SEVERITY: HIGH
DESCRIPTION: No hay rate limiting en ningún endpoint.
REPRODUCTION: Enviar N requests consecutivas a `POST /v1/appointments` — ninguna es
rechazada por volumen.
CAUSE: No priorizado todavía; depende de que exista autenticación para tener una identidad
razonable sobre la cual aplicar límites (por usuario, no solo por IP).
WORKAROUND: Ninguno en este entorno de desarrollo.
STATUS: Abierto.
FIX: Pendiente — Loop 16 (Security Audit).

---

**ISSUE-006**
DATE: Loop 12 (no iniciado)
SEVERITY: HIGH
DESCRIPTION: Las pantallas de gestión del lado barbería (Dashboard, Agenda, Clientes,
Servicios, Barberos, Horarios, Configuración) están diseñadas en `UX_GUIDELINES.md` pero no
tienen implementación en código.
REPRODUCTION: No hay rutas ni componentes para ninguna de estas pantallas en `/frontend` ni
`/backend`.
CAUSE: Secuenciación — se priorizó cerrar el flujo de cliente de punta a punta primero.
WORKAROUND: N/A.
STATUS: Abierto.
FIX: Pendiente — Loop 07 (config de negocio) y Loop 12 (agenda).

---

**ISSUE-007**
DATE: Loop 10
SEVERITY: MEDIUM
DESCRIPTION: `min_cancellation_lead_minutes` está hardcodeado (default 120 min) en
`BookingService`, no se lee de una configuración por tenant.
REPRODUCTION: Revisar `cancelAppointment()` en `booking.service.ts` — el valor no viene de
ninguna columna de `tenants`.
CAUSE: `tenants` no tiene todavía una columna de política de cancelación; se dejó como
deuda técnica explícita para no bloquear el Loop 10 por un detalle de configuración.
WORKAROUND: El default de 120 min aplica igual para todos los tenants por ahora.
STATUS: Abierto.
FIX: Agregar columna de política a `tenants` en una migración futura (sin loop asignado
todavía).

---

**ISSUE-008**
DATE: Loop 15
SEVERITY: MEDIUM
DESCRIPTION: Las notificaciones se encolan en la tabla `notifications` dentro de la misma
transacción que crea/cancela/reprograma una cita, pero no existe el worker que las procese
y las envíe realmente (push/SMS/email).
REPRODUCTION: Crear una cita — se inserta una fila en `notifications` con `status = pending`
que nunca cambia a `sent`.
CAUSE: Loop 15 no ejecutado todavía.
WORKAROUND: Ninguno — el encolado es correcto y suficiente para este punto del roadmap.
STATUS: Abierto.
FIX: Pendiente — Loop 15 (Notifications).

---

**ISSUE-009**
DATE: Loop 16 (bloqueado, no iniciado)
SEVERITY: MEDIUM
DESCRIPTION: La tabla `audit_logs` existe (inmutable por diseño) pero `CatalogService` y
`BookingService` no escriben ahí — solo `appointment_status_history` y
`appointment_reschedules` capturan cambios, y solo del ciclo de vida de una cita.
REPRODUCTION: Cambiar la configuración de un servicio o barbero — no queda ningún registro
en `audit_logs`.
CAUSE: No priorizado todavía; sin autenticación (ISSUE-001), no hay un `actor_id`
confiable para instrumentar correctamente de todas formas.
WORKAROUND: N/A.
STATUS: Abierto.
FIX: Pendiente — junto con Loop 06 (para tener `actor_id` real) y Loop 16.

---

**ISSUE-010**
DATE: Loop 11 / Loop 17
SEVERITY: MEDIUM
DESCRIPTION: `BookingFlow.tsx` no tiene tests de integración (Jest + Testing Library) —
solo el cliente HTTP que usa (`booking-api-client.ts`) está testeado.
REPRODUCTION: No existe ningún archivo `BookingFlow.test.tsx` en el proyecto.
CAUSE: Se priorizó testear la lógica de red (timeout/retry/idempotencia) por ser la parte
de mayor riesgo; el componente en sí es principalmente presentacional.
WORKAROUND: El prototipo HTML standalone sí tiene 21 tests de humo, pero es un artefacto
paralelo — no garantiza que `BookingFlow.tsx` (el código real de producción) se comporte igual.
STATUS: Abierto.
FIX: Pendiente — Loop 17 (QA) o al conectar el componente al backend real (Loop 11).

---

**ISSUE-011**
DATE: Loop 08 / Loop 17
SEVERITY: LOW
DESCRIPTION: Los endpoints de catálogo (`catalog.service.ts`, rutas `/v1/barbershops/*`,
`/v1/branches/*/staff`) no tienen la misma capa de validación de formato (UUID, etc.) que sí
existe en `validation.ts` para disponibilidad/reservas.
REPRODUCTION: Llamar `GET /v1/barbershops/:tenantId/services` con un `tenantId` mal
formado — no hay un `400` explícito, el error queda como lo que devuelva Postgres.
CAUSE: No priorizado — menor impacto que los endpoints mutantes.
WORKAROUND: N/A.
STATUS: Abierto.
FIX: Sin loop asignado todavía — candidato para agrupar con Loop 17 (QA).

---

**ISSUE-012**
DATE: Loop 10
SEVERITY: LOW
DESCRIPTION: `booking.integration.test.ts` (el test que prueba la garantía real de
concurrencia contra Postgres) está escrito pero no se corrió en el entorno donde se generó
el código, por no haber una instancia de base de datos disponible ahí.
REPRODUCTION: Correr `DATABASE_URL=... npx jest booking.integration.test.ts` sin una DB
levantada — falla por falta de conexión, no por un defecto del test.
CAUSE: Limitación del entorno de generación de código, no del proyecto en sí.
WORKAROUND: Correr `./scripts/setup.sh` localmente, que sí levanta Postgres vía Docker.
STATUS: Abierto — pendiente de confirmación en un entorno con Docker disponible.
FIX: Correr el test como parte del checklist de cualquier PR que toque
`booking.service.ts` o las migraciones 006/011.

---

## Resueltos en Loop 06 (ver DECISIONS_LOG.md DEC-015/016/017)

**ISSUE-001 (era CRITICAL)** — No existía autenticación en ningún endpoint. RESUELTO:
OTP para clientes + password para staff/admin, JWT + refresh rotable, middleware
`authenticate`. `POST /v1/appointments`, `/cancel`, `/reschedule` ahora lo exigen.

**ISSUE-002 (era CRITICAL)** — No existía autorización por rol; `customer_id`/`cancelled_by`/
`rescheduled_by` se recibían del body sin verificar identidad. RESUELTO: esos campos ahora
se derivan de `req.user` (token verificado), nunca del body — ver DEC-017.

**ISSUE-003 (era CRITICAL)** — RLS definido pero sin wiring de `app.tenant_id` en runtime.
RESUELTO para el flujo de cliente: `BookingService` y `AvailabilityService.getAvailableSlots`
ahora abren `SET LOCAL app.tenant_id` por transacción (`db/tenant-context.ts`). **Salvedad
honesta:** esto cubre las rutas ya existentes (reserva, cancelación, reprogramación,
disponibilidad); cuando se construyan las rutas de gestión de barbería (Loop 07/08/12), cada
una nueva debe aplicar el mismo patrón — no es automático por el solo hecho de que RLS esté
habilitado en la tabla.

## Resueltos (histórico previo — no reabrir sin nueva evidencia)

**ISSUE-000-A** — El motor de disponibilidad no validaba que el barbero ofreciera el
servicio pedido (devolvía slots igual). CAUSE: falta de join contra `staff_services` en
`resolve_appointment_duration`. FIX: migración 010, ver `DECISIONS_LOG.md` DEC-006.
STATUS: Resuelto.

**ISSUE-000-B** — El buffer antes/después solo se aplicaba en el cálculo de slots, no en el
constraint anti double-booking, dejando una ventana teórica para colar una cita a menos del
buffer de distancia vía insert directo. FIX: migración 011 (columnas generadas +
`EXCLUDE` sobre rango ocupado), ver DEC-008. STATUS: Resuelto.

**ISSUE-000-C** — Reservas duplicadas por reintentos de red/timeout/doble-tap de UI. FIX:
`Idempotency-Key` obligatoria + tabla `idempotency_keys`, ver DEC-009. STATUS: Resuelto.
