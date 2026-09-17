# API_CONTRACTS.md

> Base URL de desarrollo: `http://localhost:3000`. **Ningún endpoint tiene autenticación
> todavía** — ver `SECURITY_RULES.md`. Los ejemplos usan snake_case en el body/query porque
> así están definidos las rutas Express (`availability.routes.ts`); el código TypeScript
> interno usa camelCase y convierte en la capa de rutas.

## Catálogo (lectura, pasos 1-3 del flujo de cliente)

### `GET /v1/barbershops/:slug`
Perfil público de una barbería por su slug.
- `200` → `{ barbershop: { id, tradeName, slug, timezone, branchId } }`
- `404` → `{ error: "not_found" }`

### `GET /v1/barbershops/:tenantId/services`
Servicios activos de una barbería.
- `200` → `{ services: [{ id, name, description, basePrice, baseDurationMinutes }] }`

### `GET /v1/branches/:branchId/staff?service_ids=id1,id2`
Barberos que ofrecen **todos** los servicios pedidos, con precio/duración resuelta.
- `200` → `{ staff: [{ id, fullName, avatarUrl, price, durationMinutes }] }`
- `400` → falta `service_ids`

## Disponibilidad (lectura — nunca es la fuente de verdad, ver BUSINESS_RULES.md)

### `GET /v1/availability?barber_id=&branch_id=&service_id=&date=YYYY-MM-DD`
- `200` → `{ slots: [{ start, end }], timezone }` (`slots: []` es una respuesta válida, no un error)
- `400` → parámetros inválidos o fecha fuera de la ventana de reserva permitida

## Reservas (mutación — requieren `Idempotency-Key`)

### `POST /v1/appointments`
Headers: `Idempotency-Key: <uuid generado por el cliente>` (obligatorio)
Body: `{ tenant_id, branch_id, barber_id, customer_id, service_ids[], starts_at, created_by, customer_note? }`
- `201` → `{ appointment: { id, starts_at, ends_at, status, confirmation_code } }`
- `400` → falta `Idempotency-Key`
- `409` → `{ error: "slot_no_longer_available", alternatives: [{start,end}] }` — el slot se ocupó
  entre el `GET` y el `POST` (double booking evitado)
- `422` → `{ error: "service_not_offered" | "business_rule_violation", message }`

### `POST /v1/appointments/:id/cancel`
Body: `{ cancelled_by, reason?, min_cancellation_lead_minutes? }`
- `200` → `{ appointment: { id, status } }`
- `404` → cita inexistente
- `422` → `{ error: "cancellation_window_expired", minutesRequired }` o
  `{ error: "invalid_status_transition" }` (ej. intentar cancelar una cita `completed`)

### `POST /v1/appointments/:id/reschedule`
Headers: `Idempotency-Key` (obligatorio — reprogramar es una mutación)
Body: `{ new_starts_at, rescheduled_by, reason? }`
- `200` → `{ appointment: { id, starts_at, ends_at, status, confirmation_code } }` (mismo `id`)
- `404` → cita inexistente
- `409` → `{ error: "slot_no_longer_available", alternatives }`
- `422` → `{ error: "invalid_status_transition" }` (ej. reprogramar una cita `completed`)

## Convenciones generales

- **Rate limiting (Loop 16):** `POST /v1/auth/otp/request` (5/15min por teléfono),
  `/otp/verify` y `/login` (10/15min por IP), `/v1/business/register` (10/15min por IP),
  `POST /v1/appointments` (100/15min por IP). Al superarse, responde `429` con
  `{ error: "rate_limited", retryAfterSeconds }` y header `Retry-After`.

- Todas las fechas/horas son ISO 8601 con timezone (`timestamptz` de Postgres serializado).
- Los errores de negocio siempre tienen `error` (código machine-readable) y `message`
  (texto listo para mostrar al usuario, en español, sin jerga técnica) — ver
  `SECURITY_RULES.md` sobre no filtrar detalles internos.
- `409` se reserva exclusivamente para conflictos de disponibilidad; `422` para violaciones
  de reglas de negocio que no son de concurrencia (transición de estado inválida, ventana de
  cancelación, servicio no ofrecido).

## Autenticación (Loop 06)

### `POST /v1/auth/otp/request`
Público. Body: `{ phone }`
- `200` → `{ message }` — **siempre** la misma respuesta exista o no el teléfono, para no
  filtrar qué números están registrados.

### `POST /v1/auth/otp/verify`
Público. Body: `{ phone, code, full_name? }` (`full_name` solo se usa si es la primera vez).
- `200` → `{ accessToken, refreshToken }`
- `401` → `{ error: "invalid_otp" }`
- `429` → `{ error: "too_many_attempts" }` (5 intentos fallidos sobre el mismo código)

### `POST /v1/auth/login`
Público — staff/admin con password. Body: `{ identifier, password }` (`identifier` = phone o email).
- `200` → `{ accessToken, refreshToken }`
- `401` → `{ error: "invalid_credentials" }`

### `POST /v1/auth/refresh`
Público (no requiere `Authorization`, es cómo se renueva cuando ya expiró). Body:
`{ refresh_token, expired_access_token }` — ambos son necesarios: el segundo se verifica por
firma (ignorando expiración) para reconstruir el payload sin confiar en nada del cliente.
- `200` → `{ accessToken, refreshToken }` (el refresh viejo queda revocado — rotación)
- `401` → `{ error: "invalid_refresh_token" }`

### `POST /v1/auth/logout`
Requiere `Authorization`. Revoca todos los refresh tokens del usuario (no solo el actual).
- `200` → `{ message }`

## Pendiente de documentar (no implementado todavía)

Endpoints de administración de plataforma (super_admin).

## Agenda (Loop 12)

Todas requieren `Authorization` + rol `owner`/`branch_admin`/`barber`. Un `barber` solo ve/
modifica sus propias citas y bloqueos — ver DEC-022. No hay parámetro de tenant en la URL en
ninguna de estas rutas: siempre se deriva del token.

### `GET /v1/admin/agenda?branch_id=&date=&staff_id=`
`staff_id` es un filtro opcional que solo `owner`/`branch_admin` pueden usar — si lo manda
un `barber`, se ignora y se fuerza su propio `staffId` (no es un error, es la misma lógica
de "identidad derivada del token" del resto del proyecto).
- `200` → `{ appointments: [...] }`

### `PUT /v1/admin/appointments/:id/status`
Body: `{ status }`. La máquina de estados real la fuerza un trigger de base de datos — acá
solo se agrega la restricción de "solo mis citas" para `barber`.
- `200` → `{ appointment: { id, status } }`
- `403` → `{ error: "own_appointments_only" }` (barber intentando tocar una cita ajena)
- `422` → `{ error: "invalid_status_transition" }`

### `POST /v1/admin/walk-ins`
Crea una cita directamente desde el lado barbería, sin que el cliente pase por su propio
flujo de reserva. Pasa por el mismo constraint anti double-booking que cualquier otra
creación. Body: `{ branch_id, staff_id, customer_phone, customer_full_name?, service_ids[], starts_at }`
- `201` → `{ appointment }`
- `403` → `{ error: "own_appointments_only" }` si un barber intenta cargarlo en otro barbero
- `409` → `{ error: "slot_conflict" }`
- `422` → si el barbero no ofrece el servicio

### `POST /v1/admin/blocked-slots`
Body: `{ branch_id, staff_id?, starts_at, ends_at, reason?, note? }`. `staff_id` ausente
bloquea toda la sucursal — solo `owner`/`branch_admin` pueden hacer eso, un `barber` solo
puede bloquear su propio horario.
- `201` → `{ blockedSlot }`

### `DELETE /v1/admin/blocked-slots/:id`
- `204` / `403` (`own_appointments_only` si es de otro barbero)

## Gestión de catálogo — servicios y barberos (Loop 08)

Todas requieren `Authorization` + rol `owner`/`branch_admin` **del tenant del usuario**
(derivado del token, no de la URL — no hay parámetro `tenantId` en ninguna de estas rutas
justamente por eso).

- `GET /v1/admin/staff` → `200 { staff: [...] }` — lista los barberos del tenant (para la UI de gestión)
- `GET /v1/admin/staff/:staffId/services` → `200 { services: [...] }` — servicios asignados a ese barbero
- `POST /v1/admin/services` → `201 { service }`
- `PUT /v1/admin/services/:serviceId` → `200 { service }` / `403` si es de otro tenant
- `DELETE /v1/admin/services/:serviceId` → `204` (soft delete) / `403`
- `POST /v1/admin/staff` → `201 { staff }`. Body incluye `temp_password` (ver DEC-020 — no
  hay flujo de invitación por token todavía) / `409` si el teléfono ya existe
- `PUT /v1/admin/staff/:staffId` → `200 { staff }` / `403`
- `PUT /v1/admin/staff/:staffId/services/:serviceId` → `200 { assignment }` (upsert) / `403`
  si el barbero O el servicio son de otro tenant (se verifican ambos, no solo uno)
- `DELETE /v1/admin/staff/:staffId/services/:serviceId` → `204` / `403`
- `PUT /v1/admin/staff/:staffId/hours` → `200 { staffHours }` (reemplazo completo) / `422`
  si algún día tiene fin ≤ inicio / `403`
- `POST /v1/admin/staff/:staffId/time-off` → `201 { timeOff }` / `403`
- `DELETE /v1/admin/time-off/:timeOffId` → `204` / `404`

## Negocio (Loop 07)

### `POST /v1/business/register`
Onboarding — público, sin auth (es cómo se crea la primera identidad). Body:
`{ owner_phone, owner_password, owner_full_name?, trade_name, legal_name, timezone? }`
- `201` → `{ accessToken, refreshToken, tenantId, branchId }`
- `400` → faltan parámetros obligatorios
- `409` → `{ error: "phone_already_registered" }`
- `422` → `{ error: "slug_generation_failed" }` (colisión de nombre persistente, caso raro)

### `GET /v1/tenants/:tenantId`
Requiere auth + rol + tenant coincidente (mismo guard que el `PUT`).
- `200` → `{ tenant: { id, trade_name, description, timezone } }`

### `PUT /v1/tenants/:tenantId`
Requiere `Authorization` + rol `owner`/`branch_admin` **del mismo tenant** (se verifica
`req.user.tenantId === tenantId`, no alcanza con tener el rol correcto en otra barbería).
Body: `{ trade_name?, description?, timezone? }`
- `200` → `{ tenant }`
- `403` → `{ error: "forbidden" }` si el tenant no coincide

### `GET /v1/branches/:branchId/business-hours`
Público — el horario general es información que la barbería quiere que se vea.
- `200` → `{ businessHours: [{ day_of_week, opens_at, closes_at }] }`

### `PUT /v1/branches/:branchId/business-hours`
Requiere auth + rol + tenant coincidente. Reemplaza el horario completo (no hace merge
parcial). Body: `{ hours: [{ dayOfWeek, opensAt, closesAt }] }` — **atención: camelCase,
no snake_case como el resto de esta API.** La ruta pasa `req.body.hours` directo al
servicio sin transformar campos; es una inconsistencia real del contrato existente, no
está documentada así por capricho. Igual para `PUT /v1/admin/staff/:staffId/hours`
(`{ hours: [{ dayOfWeek, startsAt, endsAt }] }`).
- `200` → `{ businessHours: [...] }`
- `403` → `{ error: "forbidden" }` si la sucursal es de otro tenant
- `422` → `{ error: "invalid_business_hours" }` si algún día tiene cierre ≤ apertura

### `PUT /v1/branches/:branchId/active`
Pausa/reactiva la sucursal — el motor de disponibilidad (migración 010) ya respeta este
flag. Body: `{ is_active: boolean }`
- `200` → `{ branch: { id, is_active } }`
- `403` → `{ error: "forbidden" }` si la sucursal es de otro tenant
