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

- Todas las fechas/horas son ISO 8601 con timezone (`timestamptz` de Postgres serializado).
- Los errores de negocio siempre tienen `error` (código machine-readable) y `message`
  (texto listo para mostrar al usuario, en español, sin jerga técnica) — ver
  `SECURITY_RULES.md` sobre no filtrar detalles internos.
- `409` se reserva exclusivamente para conflictos de disponibilidad; `422` para violaciones
  de reglas de negocio que no son de concurrencia (transición de estado inválida, ventana de
  cancelación, servicio no ofrecido).

## Pendiente de documentar (no implementado todavía)

Endpoints de autenticación, endpoints de gestión del lado barbería (agenda, servicios,
horarios, barberos — ver `ROADMAP.md` Loop 10), endpoints de administración.
