# CHANGELOG.md

Registra únicamente cambios relevantes. Orden cronológico (más reciente primero).
Numeración de LOOP = canónica oficial (ver `ROADMAP.md`).

---

DATE: Checkpoint actual
LOOP: Verificación real (post Loop 16) — el hallazgo más importante del cierre
TYPE: FIX (CRITICAL) / PROCESO
DESCRIPTION: Se instaló Postgres 16 real y se arrancó el servidor Express real por primera
vez en todo el proyecto — hasta este punto, los 136 tests automatizados corrían contra `pg`
mockeado o jsdom, nunca contra infraestructura real. Aparecieron 2 bugs críticos invisibles
para toda la suite:

1. `resolve_appointment_duration()` leía `buffer_minutes`, columna renombrada a
   `buffer_after_minutes` en la migración 011 — rompía disponibilidad y creación de citas.
   Fix: migración 017.
2. La migración 011 fallaba a mitad de camino al intentar crear `occupied_starts_at`/
   `occupied_ends_at` como columnas `GENERATED ALWAYS AS ... STORED` (Postgres rechaza
   aritmética `timestamptz ± interval` ahí por no ser `IMMUTABLE`). Como corría sin
   `ON_ERROR_STOP`, el resto del archivo seguía ejecutándose — dropeando el constraint
   anti double-booking viejo sin que el nuevo pudiera crearse. **La tabla `appointments`
   quedó sin ninguna protección anti double-booking activa desde la migración 011.**
   Fix: migración 018 (columnas normales + triggers en vez de columnas generadas).

Ambos fixes se verificaron con tráfico HTTP real: registro de barbería real, login OTP real
(código leído del log de mock), creación de servicio/barbero/horario reales, consulta de
disponibilidad real, y la prueba definitiva — **dos requests HTTP simultáneas al mismo slot
exacto** contra el servidor real. Resultado: exactamente 1 cita creada (`pending`,
confirmation_code real), la otra request recibió `409 slot_no_longer_available` con
alternativas reales. Confirmado además con `SELECT` directo en la base de datos.
FILES: `migrations/017_fix_buffer_column_reference.sql`,
`migrations/018_fix_occupied_range_columns.sql`, `backend/src/index.ts` (nuevo — nunca
había existido un punto de entrada real del servidor, solo servicios y rutas sueltas).
IMPACT: Cierra los 2 bugs más graves de todo el proyecto. **Cambio de proceso:** toda
migración que toque columnas generadas, renombres o constraints se corre de acá en más
contra Postgres real con `-v ON_ERROR_STOP=1` antes de darse por buena — un archivo `.sql`
"bien escrito" y tests mockeados en verde no alcanzan como evidencia de que un constraint
de integridad esté realmente activo.

---

DATE: Checkpoint actual
LOOP: 16
TYPE: FEATURE / SECURITY
DESCRIPTION: Security Audit formal. Se implementó rate limiting (ventana deslizante en
memoria, DEC-023) sobre los puntos de mayor exposición a abuso: OTP request/verify, login,
registro de negocio, creación de citas. Se agregó validación de formato de UUID en los 13
parámetros de ruta que la necesitaban (rutas de reserva, cancelación, reprogramación, y
todas las de administración) — rechaza con `400` antes de tocar la base de datos. Se revisó
el checklist completo de `SECURITY_RULES.md`: autenticación, RBAC, RLS, SQL injection,
IDOR, CSRF (no aplica — Bearer tokens, no cookies), XSS (mitigado, riesgo residual
documentado), secrets (verificado que no hay ninguno real commiteado). Quedan 2 ítems
MEDIUM diferidos con decisión explícita (DEC-024: `audit_logs` sin instrumentar).
**Nota operativa:** este loop se completó en dos partes por un reinicio del entorno de
desarrollo a mitad de camino — el código se reconstruyó desde el último zip conocido y se
re-verificó con la suite completa antes de continuar, sin pérdida de trabajo real.
FILES: `backend/src/rate-limit.middleware.ts`, `backend/src/validate-params.middleware.ts`,
`backend/src/validation.ts` (agregado `isValidUuid`), rutas modificadas: `auth/auth.routes.ts`,
`availability.routes.ts`, `business.routes.ts`, `catalog-management.routes.ts`,
`agenda.routes.ts`, `backend/tests/rate-limit.test.ts`, `backend/tests/validate-params.test.ts`.
IMPACT: 12 tests nuevos, 94/94 en la suite completa de backend (0 regresiones). Cierra los
2 ítems HIGH de `SECURITY_RULES.md`. Loop 16 queda `DONE`.

---

DATE: Checkpoint actual
LOOP: UI de barbería (cierre, DEC-021)
TYPE: FEATURE
DESCRIPTION: Se completaron las 3 pantallas que faltaban — Servicios (alta + desactivar),
Barberos (invitar + pausar/reactivar + asignar servicios inline), Configuración (perfil +
horario general semanal). Se encontró y corrigió una inconsistencia real de contrato:
`setBusinessHours` en el cliente mandaba `snake_case`, pero el backend
(`BusinessService.setBusinessHours`) espera `camelCase` porque la ruta pasa `req.body.hours`
directo sin transformar — nunca se había ejercitado ese código hasta que se construyó la UI
real que lo usa. Se agregaron 2 endpoints de lectura que faltaban:
`GET /v1/admin/staff` (listar barberos del tenant), `GET /v1/admin/staff/:id/services`
(servicios asignados a un barbero), `GET /v1/tenants/:id` (leer perfil antes de editarlo).
FILES: `backend/src/catalog-management.service.ts` (agregado `listStaff`,
`getStaffServices`), `backend/src/catalog-management.routes.ts` (2 rutas nuevas),
`backend/src/business.service.ts` (agregado `getTenantProfile`),
`backend/src/business.routes.ts` (1 ruta nueva), `backend/tests/business.test.ts` +
`backend/tests/catalog-management.test.ts` (5 tests nuevos),
`frontend/src/barbershop/api/barbershop-api-client.ts` (fix de contrato + métodos nuevos),
`frontend/src/barbershop/hooks/useBarbershopApp.ts` (estado y acciones de las 3 pantallas),
`frontend/src/barbershop/components/BarbershopApp.tsx` (`ServicesScreen`, `StaffScreen`,
`SettingsScreen`).
IMPACT: 82/82 tests de backend, 21/21 de cliente HTTP, cero errores de TypeScript en ambos
paquetes. **La UI de barbería queda completa** — cierra `ISSUE-015`. Próximo paso: Loop 16
(Security Audit formal), según DEC-021.

---

DATE: Checkpoint actual
LOOP: UI de barbería (post Loop 12, DEC-021)
TYPE: FEATURE
DESCRIPTION: Primera versión de la app de barbería, real y conectada al backend (no
mockup). `BarbershopApiClient` cubre los tres dominios construidos hasta ahora (negocio,
catálogo de gestión, agenda) con el mismo patrón de tokens/refresh que el cliente de la app
de reserva. `useBarbershopApp` orquesta sesión + agenda del día. `BarbershopApp.tsx`
implementa Login, Dashboard (resumen del día) y Agenda (lista de citas con transición de
estado un-tap y creación de walk-in vía bottom sheet). Layout con rail lateral en vez de
bottom nav — a diferencia de la app de cliente, esta se usa mayormente en mostrador/tablet,
no en una mano mientras se camina.
FILES: `frontend/src/barbershop/api/barbershop-api-client.ts`,
`frontend/src/barbershop/hooks/useBarbershopApp.ts`,
`frontend/src/barbershop/components/BarbershopApp.tsx`,
`frontend/tests/barbershop-api-client.test.ts`.
IMPACT: 8 tests nuevos en verde, 21/21 en la suite completa de cliente HTTP (0 regresiones).
**Parcial:** faltan las pantallas de Servicios, Barberos y Configuración — ver
`KNOWN_ISSUES.md` ISSUE-015. El cliente API ya soporta esos endpoints, solo falta la UI.

---

DATE: Checkpoint actual
LOOP: 12
TYPE: FEATURE
DESCRIPTION: Agenda del lado barbería. `AgendaService`: vista del día (`getAgenda`, con
join a `appointments`/`staff_members`/`customers`/`users`), transiciones de estado
(reutiliza la máquina de estados forzada por trigger desde la migración 006), walk-ins
(mismo constraint anti double-booking que la reserva de cliente, encuentra-o-crea cliente
por teléfono igual que el login OTP), bloqueos de urgencia. Se encontró y resolvió un matiz
de seguridad antes de implementar: RLS aísla por tenant, no por barbero — un `barber`
autenticado podría ver/modificar cualquier cita de su tenant si no se restringe
explícitamente en la capa de servicio (DEC-022). `AgendaService` fuerza `staffId =
callerStaffId` para el rol `barber` en cada método, sin excepción. Se agregó `staffId` al
payload del JWT (antes solo existía para clientes vía `customerId`).
FILES: `migrations` (ninguna nueva — reutiliza schema existente),
`backend/src/agenda.service.ts`, `backend/src/agenda.routes.ts`,
`backend/src/auth/token.service.ts` (agregado `staffId` al payload),
`backend/src/auth/auth.service.ts` (`loginWithPassword` ahora resuelve `staffId`),
`backend/tests/agenda.test.ts`.
IMPACT: 15 tests nuevos en verde, 77/77 en la suite completa de backend (0 regresiones).
Backend del lado barbería queda funcionalmente completo (onboarding + config + catálogo +
agenda) — el próximo paso natural es la UI, consolidada de una sola vez (DEC-021).

---

DATE: Checkpoint actual
LOOP: 08 (continuación)
TYPE: FEATURE
DESCRIPTION: CRUD completo de gestión de catálogo del lado barbería. `CatalogManagementService`:
servicios (crear/editar/soft-delete), invitación de barberos (con simplificación consciente
de password temporal, DEC-020), asignación bidireccional servicio↔barbero (verifica que
AMBOS lados pertenezcan al tenant, no solo uno — caso de IDOR que cruza dos tablas),
horario individual del barbero (mismo patrón de reemplazo-completo que `business_hours`),
vacaciones/licencias. Todas las rutas viven bajo `/v1/admin/*`, separadas explícitamente de
las de catálogo público. Se resolvió `ISSUE-013` (RLS faltante en `staff_hours`/`time_off`,
migración 016) antes de exponer las rutas que escriben ahí — mismo criterio que Loop 07 con
`business_hours`.
FILES: `migrations/016_staff_hours_and_time_off_rls.sql`,
`backend/src/catalog-management.service.ts`, `backend/src/catalog-management.routes.ts`,
`backend/tests/catalog-management.test.ts`.
IMPACT: 14 tests nuevos en verde, 62/62 en la suite completa de backend (0 regresiones).
Loop 08 queda `DONE` — Loop 12 (Agenda) ya no tiene bloqueadores.

---

DATE: Checkpoint actual
LOOP: 07
TYPE: FEATURE
DESCRIPTION: Onboarding de barberías y configuración de negocio. `BusinessService.
registerBarbershop` crea usuario+tenant+branch+membership en una sola transacción, con
resolución de slug y retry ante colisión (mismo patrón que el número de confirmación de
citas). `updateTenantProfile`, `getBusinessHours`/`setBusinessHours` (reemplazo completo,
validado), `setBranchActive` (pausar/reactivar, ya respetado por el motor de disponibilidad
desde la migración 010). Todas las rutas mutantes verifican `req.user.tenantId ===
:tenantId/:branchId` en DOS capas (ruta + servicio), no una sola. Al construir esto se
encontró y corrigió un gap real: `business_hours` nunca tuvo RLS habilitado (migración 005
lo omitió) — se agregó vía política con subquery a `branches.tenant_id`, ya que la tabla no
tiene `tenant_id` propio (DEC-019). Se documentó el mismo gap pendiente en `staff_hours`/
`time_off` como ISSUE-013, para no perderlo de vista en Loop 08. También se completó
`API_CONTRACTS.md` con los endpoints de auth del Loop 06, que habían quedado sin documentar.
FILES: `migrations/015_business_hours_rls.sql`, `backend/src/business.service.ts`,
`backend/src/business.routes.ts`, `backend/tests/business.test.ts`.
IMPACT: 10 tests nuevos en verde, 48/48 en la suite completa de backend (0 regresiones).
Primera pieza de código del lado barbería — hasta ahora todo el proyecto era flujo de
cliente.

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
