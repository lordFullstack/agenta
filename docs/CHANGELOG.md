# CHANGELOG.md

Registra únicamente cambios relevantes. Orden cronológico (más reciente primero).
Numeración de LOOP = canónica oficial (ver `ROADMAP.md`).

---

DATE: Checkpoint actual
LOOP: 11 (continuación)
TYPE: FEATURE
DESCRIPTION: Conexión real del frontend React al backend autenticado. `booking-api-client.ts`
ahora maneja tokens (access en memoria, refresh en `localStorage` — DEC-018), login OTP
(`requestOtp`/`verifyOtp`), y un wrapper `authenticatedFetch` que adjunta
`Authorization: Bearer` y hace un único intento de refresh ante `401` antes de rendirse.
`useBookingFlow.ts` integra el login inline dentro del paso de confirmación (sin pantalla
separada, como se definió en `DESIGN_SYSTEM.md` desde Loop 03). `BookingFlow.tsx`/
`ConfirmSheet` muestran el formulario de teléfono→OTP cuando no hay sesión, y el formulario
de confirmación normal cuando sí la hay. Las firmas de `createAppointment`/
`cancelAppointment`/`rescheduleAppointment` ya no reciben `customerId`/`createdBy`/etc. —
el backend los deriva del token (consistente con DEC-017 del Loop 06).
FILES: `frontend/src/api/booking-api-client.ts` (reescrito), `frontend/src/hooks/useBookingFlow.ts`
(reescrito), `frontend/src/components/BookingFlow.tsx` (modificado), `frontend/src/vite-env.d.ts`
(nuevo), `frontend/tests/booking-api-client.test.ts` (extendido con 7 tests de auth).
IMPACT: Cierra ISSUE-004 para `BookingFlow.tsx` (el código de producción real) — el
prototipo HTML standalone queda explícitamente fuera de este cierre, como referencia visual.
13/13 tests del cliente HTTP en verde (6 preexistentes + 7 nuevos de auth), 0 regresiones en
backend (38/38). TypeScript compila sin errores en ambos paquetes.

---

DATE: Checkpoint actual
LOOP: 06
TYPE: FEATURE
DESCRIPTION: Autenticación y autorización completas — OTP para clientes (find-or-create de
usuario+cliente en el mismo verify), login con password para staff/admin, JWT de acceso +
refresh token rotable y revocable, middleware `authenticate`/`requireRole`/
`requireCustomerIdentity`. Wiring real de `app.tenant_id` vía `SET LOCAL` por transacción
(`db/tenant-context.ts`), aplicado en `BookingService` y `AvailabilityService`. Split de
políticas RLS entre catálogo público (`branches`/`staff_members`/`services`: SELECT libre,
mutación tenant-scoped) y datos operativos privados (siguen exigiendo tenant context para
todo). Rutas de reserva/cancelación/reprogramación ahora exigen autenticación y derivan
`customer_id`/`cancelled_by`/`rescheduled_by` del token, nunca del body.
FILES: `migrations/014_auth_and_rls_split.sql`, `backend/src/db/tenant-context.ts`,
`backend/src/auth/otp.service.ts`, `backend/src/auth/token.service.ts`,
`backend/src/auth/auth.service.ts`, `backend/src/auth/middleware.ts`,
`backend/src/auth/auth.routes.ts`, `backend/src/booking.service.ts` (modificado),
`backend/src/availability.service.ts` (modificado), `backend/src/availability.routes.ts`
(modificado), `backend/tests/auth.test.ts`, `backend/tests/booking.cancel-reschedule.test.ts`
(mocks actualizados).
IMPACT: Cierra ISSUE-001, ISSUE-002 y (para las rutas existentes) ISSUE-003 — los tres
CRITICAL que bloqueaban cualquier despliegue. De paso se encontraron y corrigieron dos bugs
reales durante la implementación: la verificación de idempotencia corría antes de abrir el
contexto de tenant (rompía silenciosamente contra RLS), y `rescheduleAppointment` armaba
las alternativas de conflicto con `err.staffId`, un campo que nunca existió. 38/38 tests de
backend en verde, sin regresiones sobre los 25 anteriores.

---

DATE: Checkpoint actual
LOOP: 00 (reconciliación)
TYPE: DOCS
DESCRIPTION: Reconciliación de la documentación persistente con la plantilla oficial de
Loop 00 (segunda versión recibida). Renumeración del roadmap a la nomenclatura canónica
(00-20), sin resetear progreso real. Reformato de `KNOWN_ISSUES.md` y `CHANGELOG.md` a los
templates exactos especificados.
FILES: `docs/ROADMAP.md`, `docs/KNOWN_ISSUES.md`, `docs/CHANGELOG.md`, `docs/AI_CONTEXT.md`,
`docs/AI_HANDOFF.md`, `docs/CURRENT_STATE.md`.
IMPACT: Ninguno sobre funcionalidad — solo documentación. Establece la numeración de loop
que se usará de acá en adelante.

---

DATE: Loop 00 (primera consolidación)
LOOP: 00
TYPE: DOCS
DESCRIPTION: Creación inicial de los 16 documentos de `/docs`, consolidando retroactivamente
todo lo construido hasta ese punto (numeración pre-canónica: Loops 0, 1, 1.1, 6.3, 6.4, 6.5).
FILES: los 16 archivos de `/docs` (ver `PROJECT_CONTEXT.md` para el listado completo).
IMPACT: Ninguno sobre funcionalidad. Primera vez que el proyecto tiene memoria persistente
fuera del chat.

---

DATE: Loop 11 (numeración canónica) / Loop 6.5 (numeración anterior)
LOOP: 11
TYPE: FEATURE
DESCRIPTION: Prototipo HTML+Tailwind interactivo de las 14 pantallas de cliente,
mobile-first, con Design System aplicado, bottom sheets funcionales, FAB, glassmorphism
moderado, estados demo (loading/empty/error/success), accesibilidad verificada con tests.
FILES: `frontend/prototype/booking-flow.html`, `frontend/prototype/smoke-test.js`.
IMPACT: UI de cliente completa a nivel visual/interactivo. **No conectada al backend real**
— ver `KNOWN_ISSUES.md` ISSUE-004.

---

DATE: Loop 10 (numeración canónica) / Loop 6.4 (numeración anterior)
LOOP: 10
TYPE: FEATURE
DESCRIPTION: Flujo de reserva end-to-end: `CatalogService`, extensión de `BookingService`
(cancelación, reprogramación, número de confirmación, notificación encolada), rutas de
cancelación/reprogramación, cliente HTTP con timeout/retry/idempotencia, hook de
orquestación del flujo de 14 pasos, componente React.
FILES: `backend/src/catalog.service.ts`, `backend/src/booking.service.ts` (extendido),
`backend/src/availability.routes.ts` (extendido), `frontend/src/api/booking-api-client.ts`,
`frontend/src/hooks/useBookingFlow.ts`, `frontend/src/components/BookingFlow.tsx`,
`migrations/013_confirmation_codes.sql`.
IMPACT: 25 tests de backend + 6 tests de cliente HTTP, todos en verde. Base funcional
completa del flujo de reserva, cancelación y reprogramación.

---

DATE: Loop 09 (numeración canónica) / Loop 6.3 patch (numeración anterior)
LOOP: 09
TYPE: FIX
DESCRIPTION: Buffer antes/después ahora enforced por el mismo constraint `EXCLUDE` que
previene double-booking (columnas generadas `occupied_starts_at`/`occupied_ends_at`), no
solo por el cálculo de slots.
FILES: `migrations/011_buffers_and_occupied_range.sql`, `migrations/012_idempotency_keys.sql`.
IMPACT: Cierra una ventana teórica de inconsistencia (ver `KNOWN_ISSUES.md`, resuelto
ISSUE-000-B). Cambio de schema: `staff_members.buffer_minutes` → `buffer_before_minutes`/
`buffer_after_minutes`.

---

DATE: Loop 09 (numeración canónica) / Loop 6.3 patch (numeración anterior)
LOOP: 09
TYPE: FIX
DESCRIPTION: `resolve_appointment_duration` ahora devuelve `NULL` si el barbero no ofrece
el servicio pedido, en vez de calcular una duración de todas formas. También valida que
tenant/branch/staff estén activos antes de devolver ventanas de trabajo.
FILES: `migrations/010_availability_engine_fix.sql`.
IMPACT: Corrige un bug funcional real (ver `KNOWN_ISSUES.md`, resuelto ISSUE-000-A) — antes
del fix, el motor podía mostrar slots para servicios que el barbero no podía realizar.

---

DATE: Loop 09 (numeración canónica) / Loop 6.3 (numeración anterior)
LOOP: 09
TYPE: FEATURE
DESCRIPTION: Motor de disponibilidad — funciones PL/pgSQL `resolve_appointment_duration`,
`get_working_windows`, `get_available_slots`, `get_available_slots_any_staff`.
FILES: `migrations/009_availability_engine.sql`.
IMPACT: Primera implementación funcional del cálculo de slots disponibles, combinando
horario de barbería, horario de barbero, servicio/duración, descansos, bloqueos, vacaciones
y citas existentes.

---

DATE: Loop 05 (numeración canónica) / Loop 1.1 (numeración anterior)
LOOP: 05
TYPE: FEATURE
DESCRIPTION: Refinamiento completo del modelo de datos como SaaS multi-tenant (shared
database + Row-Level Security), soft delete, audit fields, anti double-booking a nivel de
constraint desde el diseño inicial de `appointments`.
FILES: `migrations/001` a `008`.
IMPACT: Reemplaza el modelo de datos de la primera iteración (single-schema, sin
multi-tenancy formal) — ver nota de trazabilidad en `DATABASE.md`.

---

DATE: Loop 05 (numeración canónica) / Loop 1 (numeración anterior)
LOOP: 05
TYPE: FEATURE
DESCRIPTION: Primera versión del modelo de datos — 16 entidades, ERD, reglas críticas
mapeadas a estructura (documento narrativo, sin migraciones SQL ejecutables todavía).
FILES: `docs/modelo-de-datos-pwa-barberias.md`.
IMPACT: Histórico — superado por la versión multi-tenant. Conservado por trazabilidad, no
es el schema vigente.

---

DATE: Loop 03 (numeración canónica)
LOOP: 03
TYPE: DOCS
DESCRIPTION: Design System completo — tokens Tailwind (color, tipografía, spacing, radius,
shadows), especificación de 20 categorías de componentes, comportamiento responsive
320px→1024px+.
FILES: `docs/design-system-pwa-barberias.md` (= `docs/DESIGN_SYSTEM.md`).
IMPACT: Base visual para todo el frontend construido después.

---

DATE: Loop 02 (numeración canónica)
LOOP: 02
TYPE: DOCS
DESCRIPTION: Arquitectura UX — especificación de 22 pantallas (11 cliente + 11 barbería):
objetivo, contenido, CTA, navegación, interacción, estados, errores.
FILES: `docs/arquitectura-ux-pwa-barberias.md` (= `docs/UX_GUIDELINES.md`).
IMPACT: Base de todas las pantallas construidas después (cliente completo; barbería todavía
pendiente de implementación).

---

DATE: Loop 01 (numeración canónica)
LOOP: 01
TYPE: DOCS
DESCRIPTION: Product Discovery — Product Vision, Personas, JTBD, MVP/V2/Futuro, backlog
priorizado, riesgos, KPIs.
FILES: `docs/PRODUCT_VISION.md`.
IMPACT: Define el alcance y las prioridades de todo el proyecto.
