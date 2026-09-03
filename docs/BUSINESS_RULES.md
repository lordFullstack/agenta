# BUSINESS_RULES.md

## Regla absoluta #1 — Nunca double booking

Dos citas activas (`pending`, `confirmed`, `in_progress`) del mismo barbero nunca pueden
solaparse en el tiempo. Garantizado por constraint `EXCLUDE USING gist` en `appointments`
(migración 006, extendido en 011 para incluir buffer) — **no por lógica de aplicación.**

## Regla absoluta #2 — La disponibilidad de frontend no es una reserva

Lo que devuelve `GET /v1/availability` es solo para pintar la UI. El backend **siempre**
re-valida el slot real en el momento del `POST /v1/appointments`, contra el estado actual
de la base de datos, dentro de la misma transacción que crea la cita. Ver `DEC-004`, `DEC-006`.

## Regla absoluta #3 — Aislamiento multi-tenant

Barbería A no puede acceder a datos de Barbería B — usuarios, clientes, citas, servicios,
barberos, sucursales, reportes, configuraciones. Ver `DECISIONS_LOG.md` DEC-002 y
`SECURITY_RULES.md` (pendiente de wiring en runtime).

## Duración y precio de servicios

- Cada servicio tiene `base_price` y `base_duration_minutes` (tabla `services`).
- Un barbero puede tener `price_override` / `duration_override_minutes` por servicio
  (tabla `staff_services`) — si no los tiene, se usa el valor base.
- Al crear una cita, precio y duración se **snapshotean** en `appointment_items` — cambios
  futuros en el catálogo no afectan citas ya reservadas.

## Horarios

- `business_hours`: horario general de la sucursal, por día de semana. Fallback.
- `staff_hours`: horario individual del barbero, por día de semana. **Tiene prioridad sobre
  `business_hours`, no se combinan por intersección** (ver DEC-005).
- Turnos partidos (mañana/tarde) se modelan como múltiples filas del mismo día, no como un
  campo de "descanso" separado.

## Vacaciones y bloqueos

- `time_off`: rango de días completos (vacaciones, licencias) — anula el día entero para
  ese barbero.
- `blocked_slots`: rango de tiempo exacto (timestamp), puede ser de un barbero específico o
  de toda la sucursal (`branch_id` con `staff_id` nulo).
- Ambos tienen prioridad absoluta sobre `staff_hours`/`business_hours` en el cálculo de
  disponibilidad — se validan tanto en el `SELECT` de slots como en un trigger `BEFORE
  INSERT/UPDATE` sobre `appointments` (defensa en profundidad).

## Buffer

- `buffer_before_minutes` / `buffer_after_minutes` por barbero (`staff_members`).
- Se snapshotea en la cita al crearla (`appointments.buffer_before_minutes/after_minutes`).
- Enforced por el mismo constraint `EXCLUDE` que previene double-booking (vía columnas
  generadas `occupied_starts_at`/`occupied_ends_at`) — ver DEC-008.

## Anticipación mínima y ventana máxima de reserva

- `minLeadMinutes`: no se puede reservar un slot que empiece antes de X minutos desde ahora.
- `maxWindowDays`: no se puede reservar más allá de X días de anticipación.
- Ambos se validan **dos veces**: en la función SQL `get_available_slots` (para que la
  disponibilidad mostrada ya los respete) y en la capa de validación de la API
  (`assertWithinBookingWindow`, `assertMeetsMinimumLeadTime`) — defensa en profundidad, no
  redundancia accidental.

## Cancelación

- Ventana mínima de cancelación gratuita: **120 minutos por defecto** (hardcodeado hoy,
  ver `TECHNICAL DEBT` en `CURRENT_STATE.md` — pendiente hacerlo configurable por tenant).
- Fuera de esa ventana, `cancelAppointment` lanza `CancellationWindowError` (`422`).
- Solo se puede cancelar desde estados `pending`/`confirmed`/`in_progress` — la máquina de
  estados (trigger en DB) rechaza cancelar una cita `completed`.

## Reprogramación

- Conserva el mismo `id` de cita — no crea una nueva (ver DEC-012).
- Solo permitida desde estados `pending`/`confirmed`.
- El nuevo horario pasa por el mismo constraint `EXCLUDE` que una creación nueva.
- Se registra en `appointment_reschedules` (horario anterior y nuevo, motivo, quién la hizo).

## No-show

- `customer_profiles.no_show_count` se incrementa automáticamente vía trigger cuando una
  cita pasa a estado `no_show` (scoped por tenant, no global al cliente — ver DEC-003).

## Estados de cita (máquina de estados)

```
pending → confirmed → in_progress → completed   (flujo normal)
pending → cancelled
confirmed → cancelled
confirmed → no_show
in_progress → cancelled
```

`completed`, `cancelled` y `no_show` son estados terminales — ninguna transición sale de
ellos. Forzado por trigger en base de datos (`validate_appointment_status_transition`), no
solo por validación de la aplicación.

## Número de confirmación

6 caracteres alfanuméricos, generados y verificados como únicos **dentro del mismo INSERT**
(trigger `BEFORE INSERT`), sin una segunda ida a la base desde la aplicación. Excluye
caracteres visualmente ambiguos (`0/O`, `1/I/L`).

## Notificaciones

Se **encolan** en la tabla `notifications` dentro de la misma transacción que crea/cancela/
reprograma la cita (garantiza que si la cita existe, la intención de notificar también quedó
registrada). El **envío real** es responsabilidad de un worker asíncrono — no implementado
todavía (ver `KNOWN_ISSUES.md`). Si el envío falla, **no** revierte la reserva.

## Pagos (V2 — modelado, no implementado)

Tabla `payments` existe desde el modelo de datos inicial para no requerir migración de
esquema cuando se implemente, pero no hay lógica de negocio ni integración con pasarela
todavía.
