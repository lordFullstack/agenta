# DECISIONS_LOG.md

Formato: ID / DATE / CATEGORY / CONTEXT / OPTIONS / DECISION / REASON / IMPACT / STATUS.
Toda decisión arquitectónica, UX o de negocio importante se registra acá antes de
considerarse "definitiva". No reabrir sin registrar por qué se revierte.

---

**DEC-001**
CATEGORY: UX
CONTEXT: Navegación principal de la app de cliente en mobile.
OPTIONS: Bottom Navigation vs. Top Navigation vs. Hamburger menu.
DECISION: Bottom Navigation persistente (Inicio, Buscar, Mis Citas, Perfil).
REASON: Las acciones principales deben permanecer dentro de la thumb zone; top nav y
hamburger menu requieren estirar el pulgar o usar la otra mano.
IMPACT: Todas las pantallas raíz del cliente comparten el mismo nav; pantallas de flujo
lineal (reserva) lo ocultan.
STATUS: Activa.

---

**DEC-002**
CATEGORY: Arquitectura / Base de datos
CONTEXT: Cómo aislar los datos de una barbería (tenant) de otra en un modelo SaaS.
OPTIONS: (a) Base de datos separada por tenant, (b) schema separado por tenant, (c) shared
database + `tenant_id` + Row-Level Security.
DECISION: (c) Shared database, shared schema, `tenant_id` en cada tabla + RLS de Postgres.
REASON: (a) y (b) escalan mal operativamente (miles de barberías = miles de bases/schemas).
RLS da aislamiento real a nivel de motor, no solo por filtrado de la app.
IMPACT: Toda tabla tenant-scoped requiere `tenant_id` denormalizado, incluso si es
derivable transitivamente por FK, para que la policy de RLS pueda filtrar sin joins.
STATUS: Activa. **Pendiente de wiring en runtime — ver KNOWN_ISSUES.md.**

---

**DEC-003**
CATEGORY: Base de datos
CONTEXT: ¿Los clientes (`customers`) pertenecen a un tenant o son globales a la plataforma?
OPTIONS: (a) `customers` scoped por tenant (un registro por barbería visitada), (b) `customers`
global + tabla de relación por tenant.
DECISION: (b) — `customers` es global, `customer_profiles` es la relación por tenant
(notas, no-show count, última visita).
REASON: Un cliente puede reservar en varias barberías de la plataforma (es un marketplace).
Su reputación de no-shows en la Barbería A no debe contaminar la Barbería B.
IMPACT: Cualquier query de "historial de cliente" debe decidir explícitamente si consulta
`customers` (identidad) o `customer_profiles` (relación con un tenant específico).
STATUS: Activa.

---

**DEC-004**
CATEGORY: Base de datos / Regla crítica de negocio
CONTEXT: Cómo garantizar que dos citas del mismo barbero nunca se solapen, incluso con
requests simultáneos.
OPTIONS: (a) Lock optimista con retry en la app, (b) lock distribuido (Redis), (c) constraint
`EXCLUDE USING gist` de Postgres.
DECISION: (c).
REASON: (a) reinventa lo que Postgres ya hace mejor. (b) agrega un punto único de falla
innecesario para este volumen. El constraint `EXCLUDE` es una garantía del motor de base de
datos, no de la aplicación — no depende de que el backend haga bien el locking.
IMPACT: `appointments` tiene el constraint `no_overlapping_appointments`; el backend debe
capturar específicamente el código de error `23P01` (exclusion_violation), no un catch genérico.
STATUS: Activa. Ver migración 006 y 011.

---

**DEC-005**
CATEGORY: Base de datos
CONTEXT: `HORARIO BARBERÍA` vs `HORARIO BARBERO` en el motor de disponibilidad — ¿se combinan
(intersección) o uno reemplaza al otro?
OPTIONS: (a) Intersección de ambos horarios, (b) el horario del barbero reemplaza al general
cuando existe, usando el general solo como fallback.
DECISION: (b).
REASON: (a) generaría falsos negativos — un barbero que labura hasta más tarde que el
horario general del local quedaría bloqueado artificialmente.
IMPACT: `get_working_windows()` consulta `staff_hours` primero; si no hay registro para ese
día, recién ahí cae a `business_hours`.
STATUS: Activa.

---

**DEC-006**
CATEGORY: Regla crítica de negocio
CONTEXT: El motor de disponibilidad inicial solo validaba "¿el barbero está libre?", sin
validar si el barbero realmente ofrece el servicio pedido.
OPTIONS: N/A — era un bug funcional detectado durante desarrollo, no una decisión de diseño abierta.
DECISION: `resolve_appointment_duration()` debe devolver `NULL` (no `0` ni un número
"por defecto") si el barbero no ofrece alguno de los servicios pedidos, y `get_available_slots`
debe cortar temprano en ese caso.
REASON: Antes del fix, la función sumaba `services.base_duration_minutes` sin verificar
`staff_services`, devolviendo slots válidos para servicios que ese barbero no podía realizar.
IMPACT: Migración 010. Cualquier refactor del motor de disponibilidad debe preservar esta
validación explícitamente — no asumir que "sin duración" implica "sin slots" por descarte.
STATUS: Activa. **No revertir.**

---

**DEC-007**
CATEGORY: Base de datos
CONTEXT: Reservas con más de un servicio en la misma cita — ¿array en `appointments` o
tabla puente?
OPTIONS: (a) Columna array `additional_service_ids` en `appointments`, (b) tabla puente
`appointment_items` con snapshot de precio/duración.
DECISION: (b), implementada desde el modelo multi-tenant (no se quedó como deuda para V2).
REASON: (a) no permite snapshot de precio/duración por servicio individual y no está en 3FN.
IMPACT: Todo insert de cita debe poblar `appointment_items` en la misma transacción que
`appointments`.
STATUS: Activa.

---

**DEC-008**
CATEGORY: Regla crítica de negocio
CONTEXT: Buffer antes/después de una cita — ¿se aplica solo en el cálculo de slots (app) o
también en el constraint que previene doble-booking (DB)?
OPTIONS: (a) Solo en el cálculo de disponibilidad, (b) enforced también por el constraint
`EXCLUDE`.
DECISION: (b) — vía columnas generadas `occupied_starts_at`/`occupied_ends_at` que restan/suman
el buffer, snapshoteado en la cita al crearla, y el `EXCLUDE` usa ese rango en vez del rango
"puro" del servicio.
REASON: Si el buffer solo vive en el cálculo de slots, un insert directo (ej. un walk-in
creado sin pasar por ese cálculo) podría colar una cita a menos del buffer de distancia.
IMPACT: Migración 011. `staff_members.buffer_minutes` se separó en `buffer_before_minutes` /
`buffer_after_minutes`.
STATUS: Activa.

---

**DEC-009**
CATEGORY: Arquitectura / Concurrencia
CONTEXT: Cómo evitar citas duplicadas por reintentos de UI (timeout, network failure,
doble-tap) sin reintroducir el problema de concurrencia real.
OPTIONS: (a) Deduplicar por contenido del payload, (b) header `Idempotency-Key` generado
client-side una vez por intento de reserva.
DECISION: (b).
REASON: (a) es frágil (¿qué campos definen "el mismo intento"?). (b) es explícito y estándar.
La key se genera una sola vez cuando el usuario toca "Confirmar" y sobrevive a todos los
reintentos de ESE intento — un intento nuevo (otra cita) genera una key nueva.
IMPACT: Tabla `idempotency_keys`. El endpoint `POST /v1/appointments` exige el header;
sin él, responde `400`.
STATUS: Activa.

---

**DEC-010**
CATEGORY: Arquitectura / Cliente HTTP
CONTEXT: ¿El cliente HTTP debe reintentar automáticamente ante cualquier error?
OPTIONS: (a) Reintentar todo, (b) reintentar solo fallas de transporte (timeout, network
failure), nunca respuestas de negocio (4xx).
DECISION: (b).
REASON: Un `409`/`422` es una respuesta válida del servidor — reintentar automáticamente no
cambiaría el resultado sin una decisión nueva del usuario (ej. elegir otro horario).
IMPACT: `withRetry()` en `booking-api-client.ts` distingue `NetworkError`/`TimeoutError`
(reintentables) de `ApiError` (no reintentable automáticamente).
STATUS: Activa.

---

**DEC-011**
CATEGORY: UX
CONTEXT: Pasos "Calendario" y "Horarios" del flujo de reserva del cliente — ¿pantallas
separadas o fusionadas?
OPTIONS: (a) Dos pantallas secuenciales, (b) una sola pantalla continua (elegir el día
revela los horarios inmediatamente debajo).
DECISION: (b).
REASON: Es la pieza central para cumplir el objetivo de "reserva en el menor número de pasos
posible" — evita una pantalla intermedia y un tap extra.
IMPACT: En el código (React y prototipo HTML) ambos pasos viven en la misma sección/pantalla
(`data-screen="calendario"`), aunque conceptualmente sigan siendo los pasos 6 y 7 del flujo
documentado.
STATUS: Activa.

---

**DEC-012**
CATEGORY: UX / Contenido
CONTEXT: Reprogramación de una cita — ¿crear una cita nueva y cancelar la vieja, o mutar la
existente?
OPTIONS: (a) Cancelar + crear nueva, (b) `UPDATE` sobre la misma fila, registrando el cambio
en una tabla de historial.
DECISION: (b).
REASON: (a) rompe la trazabilidad (pagos ya asociados, número de confirmación, historial de
estados) y complica reportes ("¿cuántas citas se reprograman más de una vez?").
IMPACT: Tabla `appointment_reschedules`. El `UPDATE` de `starts_at`/`ends_at` pasa otra vez
por el mismo constraint `EXCLUDE` que la creación — no hay una versión "más liviana" del
chequeo anti doble-booking para este caso.
STATUS: Activa.

---

**DEC-013**
CATEGORY: Diseño visual / Design System
CONTEXT: Paleta de color para una identidad "premium, masculina sin cliché, moderna".
OPTIONS: Evaluadas y descartadas explícitamente: cream+terracota (default genérico de IA),
negro+acento neón (otro default genérico).
DECISION: Paleta con 6 tokens nombrados: `ink` (grafito cálido), `bone` (hueso, no blanco
puro), `steel`, `brass` (acento de firma), `ember`, `moss`. Tipografía: Bricolage Grotesque
(display) + Inter (UI) + JetBrains Mono (datos/precios/horarios).
REASON: Evitar los "tres looks" en los que cae por defecto el diseño generado por IA (ver
`frontend-design` skill). El "brass tick" (punto/línea de 1px) es el elemento de firma
recurrente, evocando la guía de un clipper.
IMPACT: Todo componente nuevo debe derivar sus clases de estos tokens — no introducir
colores/radios/sombras fuera de esta paleta.
STATUS: Activa.

---

**DEC-014**
CATEGORY: Seguridad
CONTEXT: ¿Implementar autenticación/autorización antes o después del motor de reservas?
OPTIONS: (a) Auth primero, (b) motor de reservas primero, auth después.
DECISION: (b), explícitamente, para poder validar la lógica de concurrencia/disponibilidad
sin la complejidad adicional de sesiones/tokens en cada test.
REASON: Decisión de secuenciación de desarrollo, no de producto — el motor de reservas es el
riesgo técnico más alto (double booking) y se quiso des-riesgar primero.
IMPACT: **Ningún endpoint actual debe exponerse fuera de desarrollo local hasta que el
Loop 06 (Autenticación y Autorización) esté completo.** Ver `SECURITY_RULES.md`.
STATUS: Completada — ver DEC-015 y DEC-016 para el resultado del Loop 06.

---

**DEC-015**
CATEGORY: Seguridad / Base de datos
CONTEXT: Las políticas RLS originales (migraciones 002-011) exigían `app.tenant_id` para
TODA operación, incluyendo `SELECT`. Al implementar la búsqueda pública de barberías
(`GET /v1/barbershops/:slug`), esto resultó imposible de cumplir: no se puede setear el
tenant antes de saber qué tenant es — la propia query de descubrimiento necesita leer
`branches` sin contexto de tenant todavía.
OPTIONS: (a) Mantener RLS estricto y resolver el discovery con una función `SECURITY
DEFINER` que bypasee RLS deliberadamente, (b) separar las políticas por comando: `SELECT`
público para catálogo (`branches`, `staff_members`, `services`), mutación siempre
tenant-scoped.
DECISION: (b).
REASON: (a) agrega una superficie de bypass de RLS que hay que auditar con mucho cuidado
cada vez que cambia. (b) es más simple de razonar: el catálogo es *intencionalmente*
público (el producto necesita que los clientes descubran barberías sin login), mientras que
los datos operativos privados (`appointments`, `customer_profiles`, `blocked_slots`,
`payments`, `audit_logs`) siguen exigiendo `app.tenant_id` para todo, sin excepción.
IMPACT: Migración 014. `CatalogService` y la lectura de disponibilidad pública no necesitan
contexto de tenant; `BookingService` y `AvailabilityService.getAvailableSlots` sí (porque
consultan `appointments`, que permanece completamente protegido).
STATUS: Activa.

---

**DEC-016**
CATEGORY: Seguridad / Arquitectura
CONTEXT: Cómo activar `app.tenant_id` en runtime sin que el valor de un usuario se filtre
hacia la siguiente request que reutilice la misma conexión física del pool.
OPTIONS: (a) `SET app.tenant_id` directo sobre la conexión, (b) `SET LOCAL` (vía
`set_config(..., true)`) dentro de una transacción explícita.
DECISION: (b).
REASON: (a) persiste en la conexión física — como el pool reutiliza conexiones entre
requests, el tenant de un usuario podría quedar seteado para el siguiente request que tome
esa misma conexión. `SET LOCAL` se resetea automáticamente al `COMMIT`/`ROLLBACK`, sin
excepción.
IMPACT: `db/tenant-context.ts` (`withTenantContext`). Todo método de `BookingService` que
antes usaba `pool.query` suelto ahora abre una transacción explícita con
`SELECT set_config('app.tenant_id', $1, true)` como primera sentencia — incluida la
verificación de idempotencia, que antes corría *antes* de la transacción y por eso su
lectura de `appointments` quedaba bloqueada por RLS sin que nadie lo notara (bug real
encontrado y corregido en este mismo loop, no solo teórico).
STATUS: Activa.

---

**DEC-017**
CATEGORY: Seguridad
CONTEXT: ¿De dónde deben salir `customer_id`/`created_by`/`cancelled_by`/`rescheduled_by`
en los endpoints mutantes — del body de la request o del token verificado?
OPTIONS: (a) Del body (como estaba hasta este loop), (b) del token (`req.user`), ignorando
lo que venga en el body para esos campos.
DECISION: (b).
REASON: (a) es exactamente ISSUE-002 — cualquiera podía cancelar la cita de otro cliente
con solo cambiar un campo del JSON. La identidad de quien actúa debe salir de una fuente que
el cliente no controla.
IMPACT: `availability.routes.ts` — `POST /v1/appointments`, `/cancel` y `/reschedule` ahora
requieren `authenticate` (y `requireCustomerIdentity` para crear) y usan `req.user.sub`/
`req.user.customerId` en vez de los campos equivalentes del body.
STATUS: Activa. Cierra ISSUE-001 y ISSUE-002 para el flujo de cliente — la gestión del lado
barbería (Loop 07/12) todavía no tiene sus propias rutas protegidas porque no existen rutas
todavía.

---

**DEC-018**
CATEGORY: Seguridad / Frontend
CONTEXT: Dónde persistir los tokens de sesión en el cliente (React/PWA) — el access token
vive poco (15 min) pero el refresh token debe sobrevivir a un reload/cierre de la PWA, o el
cliente tendría que pedir OTP cada vez que abre la app.
OPTIONS: (a) Ambos en memoria (se pierden al recargar), (b) ambos en `localStorage`, (c)
access token en memoria + refresh token en `localStorage`, (d) refresh token en cookie
`httpOnly` seteada por el backend.
DECISION: (c), con la salvedad explícita de que (d) es la opción más segura y debería
evaluarse antes de un release real.
REASON: (a) obliga a re-loguearse en cada reload, mala UX para una PWA que se espera que
quede instalada. (b) expone también el access token (de vida corta, pero igual innecesario)
a lectura por XSS. (d) es la más segura porque un script inyectado no puede leer una cookie
`httpOnly` — pero requiere que el backend la setee con `Set-Cookie` y maneje CORS/CSRF en
consecuencia, cambio que no entraba en el alcance de este loop.
IMPACT: `booking-api-client.ts` guarda `accessToken` solo en memoria (variable de instancia,
nunca persiste) y `refreshToken` en `localStorage`. Si `refreshToken` se filtra por XSS, el
atacante puede rotar sesiones hasta que se revoque manualmente (`logout` revoca todos los
refresh tokens del usuario) — el riesgo residual es real y está documentado en
`SECURITY_RULES.md`, no oculto.
STATUS: Activa — revisar antes de cualquier entorno productivo real.

---

**DEC-019**
CATEGORY: Base de datos / Seguridad
CONTEXT: Al construir Loop 07 se encontró que `business_hours` nunca tuvo RLS habilitado
(migración 005 lo omitió — gap real, no decisión deliberada). La tabla no tiene `tenant_id`
propio, solo `branch_id`.
OPTIONS: (a) Agregar una columna `tenant_id` denormalizada a `business_hours` para poder
usar el mismo patrón de comparación directa que el resto de las tablas, (b) política RLS
con subquery contra `branches.tenant_id`.
DECISION: (b).
REASON: (a) es más simple de leer pero exige mantener esa columna sincronizada si algún día
una sucursal cambiara de tenant (no ocurre en el modelo actual, pero es una asunción frágil
a futuro). (b) no requiere esa sincronización — siempre resuelve el tenant real de la
sucursal en el momento de la query. El costo (un subquery extra) es despreciable para el
volumen de esta tabla.
IMPACT: Migración 015. `BusinessService.setBusinessHours` además verifica pertenencia
explícitamente ANTES de mutar (defensa en profundidad, mismo patrón que el resto del
proyecto — nunca una sola capa de protección).
STATUS: Activa. **Nota para Loop 08:** `staff_hours` y `time_off` tienen el mismo problema
estructural (sin `tenant_id` propio, sin RLS) — no se resolvió acá porque son del dominio de
gestión de barberos, no de configuración de negocio. Queda registrado en `KNOWN_ISSUES.md`
para no perderlo.

---

**DEC-020**
CATEGORY: Producto / Seguridad
CONTEXT: Cómo un owner invita a un barbero nuevo a la plataforma — hace falta que el
barbero termine con una cuenta autenticable (`users.password_hash`), pero un flujo de
invitación completo (link único, expiración, el barbero elige su propia contraseña) es
trabajo considerable.
OPTIONS: (a) Flujo de invitación completo (token de invitación, endpoint de aceptación,
el barbero define su password), (b) el owner define una contraseña temporal al invitar, se
la comunica fuera de banda (WhatsApp, en persona), sin flujo de "cambiar contraseña" todavía.
DECISION: (b), explícitamente como simplificación de este loop, no como diseño final.
REASON: (a) es la UX correcta a largo plazo pero no es necesaria para que el resto del
sistema (gestión de servicios/horarios/agenda) tenga sentido — se puede agregar después sin
tocar el resto del modelo.
IMPACT: `POST /v1/admin/staff` recibe `temp_password` en el body. **No existe todavía**
`PUT /v1/auth/change-password` ni un flujo de invitación por token — el barbero queda con la
contraseña que el owner eligió hasta que se construya eso. Ver `KNOWN_ISSUES.md`.
STATUS: Activa — revisar antes de onboarding real de barberos fuera de un entorno de demo/test.

---

**DEC-021**
CATEGORY: Producto / Proceso
CONTEXT: Con Loops 00-08, 09, 10 y 11 completos, había varios frentes disponibles sin
bloqueadores entre sí (Agenda, UI de barbería, Security Audit formal, notificaciones). Hacía
falta decidir un orden explícito, no dejarlo implícito.
OPTIONS: (a) UI de barbería primero (cierra el gap de que hoy no hay ninguna pantalla para
ese lado), (b) Agenda (backend) primero, UI después de forma consolidada.
DECISION: (b).
REASON: Construir la UI ahora significaría hacerla dos veces — una para registro/config/
servicios/barberos (ya listo) y otra para agenda apenas se termine. Cerrar primero la API
completa del lado barbería y construir la UI una sola vez contra una superficie estable es
más barato que iterar en dos pasadas. Agenda además es la pieza que le falta al backend
para estar funcionalmente completo del lado barbería (`PRODUCT_VISION.md`: "ABRIR → VER
AGENDA → ATENDER → SIGUIENTE CLIENTE").
IMPACT: Orden decidido: Loop 12 (Agenda) → UI de barbería consolidada → Loop 16 (Security
Audit formal) → Loop 15 (notificaciones) → Loops 14/18/19 (endurecimiento) → Loop 20.
STATUS: Activa.

---

**DEC-022**
CATEGORY: Seguridad
CONTEXT: Al diseñar la agenda se encontró que RLS aísla por tenant, no por barbero — un
usuario con rol `barber` autenticado tiene `tenantId` en su token, así que las políticas
RLS existentes lo dejarían ver/modificar cualquier cita de su barbería, no solo las propias.
OPTIONS: (a) Agregar una policy RLS adicional basada en `staff_id` (requeriría setear
también `app.staff_id` por sesión, además de `app.tenant_id`), (b) resolver la restricción
"solo mis citas" en la capa de servicio, explícitamente, sin tocar RLS.
DECISION: (b).
REASON: (a) agrega una segunda dimensión de contexto de sesión que complica el wiring
existente para un caso que en realidad es de autorización de aplicación (qué puede ver un
rol), no de aislamiento de datos entre organizaciones (que es lo que RLS resuelve). Mezclar
ambos conceptos en RLS lo hace más difícil de razonar.
IMPACT: `AgendaService` recibe `callerRole`/`callerStaffId` en cada método y fuerza
`staffId = callerStaffId` cuando el caller es `barber`, ignorando cualquier `staffId`
distinto que se pida — no lo rechaza con error, lo redirige a lo que ese rol puede ver,
consistente con cómo se manejan los demás casos de "identidad derivada del token" en el
proyecto (DEC-017).
STATUS: Activa.

---

**DEC-023**
CATEGORY: Seguridad
CONTEXT: Loop 16 (Security Audit formal) — implementar rate limiting sin agregar
infraestructura nueva (Redis) que el proyecto no tenía hasta ahora.
OPTIONS: (a) Rate limiter distribuido (Redis), (b) rate limiter en memoria, por instancia.
DECISION: (b), con la limitación documentada explícitamente.
REASON: El proyecto corre en una sola instancia hoy. Agregar Redis solo para esto sería
una dependencia nueva sin necesidad concreta todavía (viola DEVELOPMENT_RULES.md: "no
instalar dependencias innecesarias"). Si el backend escala horizontalmente, el límite
efectivo se vuelve (max × instancias) — no es una falla de seguridad grave (sigue limitando,
solo que con menos precisión), así que se acepta como deuda técnica conocida, no como un
riesgo que bloquee el cierre del proyecto.
IMPACT: `rate-limit.middleware.ts`. Aplicado a OTP request/verify, login, registro de
negocio, y creación de citas — los puntos de mayor exposición a abuso.
STATUS: Activa. Migrar a Redis si el proyecto escala a múltiples instancias.

---

**DEC-024**
CATEGORY: Seguridad / Alcance
CONTEXT: Al cerrar Loop 16, quedó pendiente instrumentar `audit_logs` (la tabla existe,
inmutable, desde Loop 1.1, pero ningún servicio escribe ahí todavía salvo
`appointment_status_history`/`appointment_reschedules`, que cubren solo el ciclo de vida de
una cita).
OPTIONS: (a) Instrumentar todos los servicios de escritura ahora, como parte del cierre,
(b) documentar explícitamente como diferido, con alcance claro de qué falta.
DECISION: (b).
REASON: Es un ítem MEDIUM, no CRITICAL/HIGH — los dos HIGH reales (rate limiting, validación
de input) ya se resolvieron en este mismo loop. Forzar todo en un solo cierre por
perfeccionismo no es "cerrar bien" — es no saber dónde parar. Cerrar bien significa dejar
esto documentado con precisión suficiente para que se resuelva después sin re-descubrirlo.
IMPACT: `audit_logs` sigue sin instrumentar. Ver `KNOWN_ISSUES.md` para el detalle exacto de
qué acciones quedan sin auditar (config de tenant, alta/baja de servicios y barberos).
STATUS: Activa — diferido a un loop futuro sin numeración asignada todavía.

---

**DEC-025**
CATEGORY: Arquitectura / Base de datos / Proceso
CONTEXT: Al pedir "los pasos para levantar el servidor" y ejecutarlo de verdad por primera
vez (Postgres real instalado en el entorno, servidor Express real arrancado, requests HTTP
reales), se encontraron DOS bugs críticos que 136 tests automatizados nunca detectaron:

1. `resolve_appointment_duration()` leía `staff_members.buffer_minutes`, columna renombrada
   a `buffer_after_minutes` en la migración 011 — rompía disponibilidad y creación de citas.
2. La migración 011 intentaba crear `appointments.occupied_starts_at/ends_at` como columnas
   `GENERATED ALWAYS AS ... STORED` con aritmética `timestamptz ± interval`. Postgres
   rechaza esto (esos operadores son `STABLE`, no `IMMUTABLE`, requisito de `GENERATED`).
   La migración falló en ese punto, pero como corría sin `ON_ERROR_STOP`, siguió ejecutando
   el resto del archivo — incluyendo el `DROP CONSTRAINT` del anti-double-booking viejo, sin
   que el `ADD CONSTRAINT` nuevo pudiera crearse (dependía de las columnas nunca creadas).
   **Resultado real: la tabla `appointments` quedó sin NINGÚN constraint anti double-booking
   desde que se aplicó la migración 011** — la garantía central de todo el proyecto, rota en
   silencio, invisible para la suite de tests porque esos tests mockean `pg` y nunca corren
   SQL real contra un schema real.

OPTIONS: N/A — no era una decisión de diseño abierta, era un bug real que corregir.
DECISION: Fix #1 en migración 017 (columna correcta). Fix #2 en migración 018 — se
reemplazaron las columnas generadas por columnas normales mantenidas por trigger (los
triggers sí pueden usar operadores `STABLE` sin restricción), se re-creó el índice GIST y
el constraint `EXCLUDE`, y se agregó un trigger nuevo de `UPDATE` para recalcular el rango
ocupado en reprogramaciones (la migración original solo lo calculaba en el `INSERT`).
REASON: Los tests con `pg` mockeado (que son el 100% de la suite hasta este punto) validan
que el CÓDIGO LLAMA a SQL con la forma esperada — nunca validan que ESE SQL sea
sintácticamente válido ni que se aplique sin errores contra un schema real. Son
complementarios, no sustitutos, del test de integración (`booking.integration.test.ts`, que
sí requiere Postgres real y nunca se había corrido en ningún entorno hasta este checkpoint).
IMPACT: Migraciones 017 y 018. **Cambio de proceso para el resto del proyecto:** de acá en
más, cualquier migración que toque columnas generadas, renombres, o constraints debe
aplicarse contra una instancia real de Postgres con `-v ON_ERROR_STOP=1` antes de
considerarse terminada — no alcanza con que el archivo `.sql` "se vea bien" o con que los
tests mockeados sigan en verde.
STATUS: Activa. Este es el hallazgo que más cambia la confianza real en el cierre del
proyecto — ver la sección "Resumen de cierre" en `CURRENT_STATE.md`, actualizada para
reflejar esto explícitamente.
