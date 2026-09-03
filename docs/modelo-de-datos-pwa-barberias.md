# Modelo de Datos — PWA Barbería (Loop 1)

Diseño de schema relacional (PostgreSQL) sobre las 16 entidades definidas. Cada tabla incluye columnas, tipos, constraints, relaciones y notas de negocio. Al final: ERD resumido, índices críticos y mapeo MVP/V2.

---

## 0. Enums Compartidos

```sql
CREATE TYPE user_role AS ENUM ('customer', 'barber', 'branch_admin', 'owner', 'super_admin');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'paid', 'refunded', 'failed');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'deposit_online', 'wallet');
CREATE TYPE notification_channel AS ENUM ('push', 'sms', 'email', 'whatsapp');
CREATE TYPE notification_type AS ENUM ('confirmation', 'reminder_24h', 'reminder_2h', 'cancellation', 'reschedule', 'no_show_warning', 'review_request', 'rebooking_nudge');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
CREATE TYPE blocked_time_reason AS ENUM ('vacation', 'sick_leave', 'personal', 'holiday', 'other');
CREATE TYPE day_of_week AS ENUM ('mon','tue','wed','thu','fri','sat','sun');
```

---

## 1. `users`
Tabla de autenticación central. **No** duplica datos de perfil operativo — `barbers` y `customers` son extensiones 1:1 de `users`, evitando dos sistemas de login paralelos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `phone` | varchar(20) UNIQUE | canal principal de login (OTP), nullable si registra por email |
| `email` | varchar(255) UNIQUE | nullable |
| `password_hash` | varchar | nullable — para roles admin/owner; customer/barber usan OTP |
| `role` | user_role | |
| `full_name` | varchar(150) | |
| `avatar_url` | text | nullable |
| `is_active` | boolean | default true — soft-disable de cuenta |
| `created_at` / `updated_at` | timestamptz | |

**Regla:** `phone` o `email` debe existir (constraint `CHECK`), no ambos nulos.

---

## 2. `barbershops`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → users.id | rol `owner` |
| `name` | varchar(150) | |
| `slug` | varchar(150) UNIQUE | para URL pública `/b/{slug}` |
| `description` | text | nullable |
| `logo_url` / `cover_url` | text | nullable |
| `timezone` | varchar(50) | default `'America/Argentina/Buenos_Aires'` o según región — **crítico**, ver §6 |
| `is_active` | boolean | default true — pausa toda la operación (deja de recibir reservas) |
| `created_at` / `updated_at` | timestamptz | |

---

## 3. `branches`
Sucursal física. En MVP mono-sucursal, cada `barbershop` tiene exactamente 1 `branch` creada automáticamente al onboarding (evita rehacer el modelo cuando se active multi-sucursal en V2).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops.id | |
| `name` | varchar(150) | ej. "Sucursal Centro" |
| `address` | text | |
| `latitude` / `longitude` | numeric | para búsqueda por cercanía |
| `phone` | varchar(20) | nullable |
| `is_active` | boolean | default true |

---

## 4. `barbers`
Extensión operativa de `users` (rol `barber`), ligada a una sucursal.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id UNIQUE | |
| `branch_id` | uuid FK → branches.id | |
| `bio` | text | nullable |
| `status` | varchar | `active` / `paused` — pausado no aparece en selección de cliente pero conserva historial |
| `buffer_minutes` | int | default 5 — colchón entre citas, override del default de la barbería |
| `accepts_walk_ins` | boolean | default true |
| `created_at` / `updated_at` | timestamptz | |

---

## 5. `customers`
Extensión de `users` (rol `customer`), con datos agregados por barbería (no globales) para permitir scoring de no-show por local.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id UNIQUE | |
| `notes` | text | nullable — notas internas del barbero sobre el cliente (preferencias de corte) |
| `no_show_count` | int | default 0, incrementado por trigger/servicio al marcar `no_show` |
| `last_visit_at` | timestamptz | nullable, usado para `rebooking_nudge` |
| `created_at` | timestamptz | |

**Nota:** `no_show_count` se calcula **por barbería** en un modelo más estricto — si el negocio crece, se puede mover a una tabla `customer_barbershop_stats`. En MVP se simplifica como campo agregado global.

---

## 6. `services`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops.id | |
| `name` | varchar(150) | |
| `description` | text | nullable |
| `duration_minutes` | int | **crítico** — define el largo real del slot |
| `price` | numeric(10,2) | |
| `category` | varchar(100) | nullable — "Cortes", "Barba", "Combos" |
| `is_active` | boolean | default true |
| `sort_order` | int | para orden manual en UI |

---

## 7. `barber_services`
Tabla puente — qué barberos ofrecen qué servicios (y a qué precio/duración si difiere del default).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barber_id` | uuid FK → barbers.id | |
| `service_id` | uuid FK → services.id | |
| `price_override` | numeric(10,2) | nullable |
| `duration_override_minutes` | int | nullable |

**Constraint:** UNIQUE (`barber_id`, `service_id`).

---

## 8. `business_hours`
Horario general de la sucursal (fallback si un barbero no tiene horario propio cargado).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `branch_id` | uuid FK → branches.id | |
| `day_of_week` | day_of_week | |
| `opens_at` / `closes_at` | time | |
| `is_closed` | boolean | default false — día cerrado completo |

**Constraint:** UNIQUE (`branch_id`, `day_of_week`) — un registro por día. Franjas partidas (mañana/tarde) se modelan como dos filas del mismo día (requiere quitar el UNIQUE simple y usar UNIQUE compuesto con un `sequence` o permitir múltiples filas — **decisión de diseño:** permitir múltiples filas por día para soportar horario partido desde el día 1.

---

## 9. `barber_hours`
Horario individual del barbero. Si no existe registro para un día, se hereda `business_hours`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barber_id` | uuid FK → barbers.id | |
| `day_of_week` | day_of_week | |
| `starts_at` / `ends_at` | time | |
| `is_off` | boolean | default false |

Misma lógica que `business_hours`: múltiples filas por día permiten horario partido.

---

## 10. `blocked_times`
Bloqueos puntuales (vacaciones, urgencias, feriados) — tiene prioridad absoluta sobre `barber_hours`/`business_hours` en el cálculo de disponibilidad.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barber_id` | uuid FK → barbers.id | nullable — si es null, bloquea toda la sucursal (`branch_id` requerido en ese caso) |
| `branch_id` | uuid FK → branches.id | nullable |
| `starts_at` / `ends_at` | timestamptz | rango exacto, no solo fecha |
| `reason` | blocked_time_reason | |
| `note` | text | nullable |
| `created_by` | uuid FK → users.id | |

**Constraint:** `CHECK (barber_id IS NOT NULL OR branch_id IS NOT NULL)`.

---

## 11. `appointments`
Entidad central del sistema.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `branch_id` | uuid FK → branches.id | |
| `barber_id` | uuid FK → barbers.id | |
| `customer_id` | uuid FK → customers.id | |
| `service_id` | uuid FK → services.id | referencia al servicio principal |
| `additional_service_ids` | uuid[] | array de servicios adicionales si la reserva es multi-servicio (o modelar tabla `appointment_services` — ver nota) |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz | calculado = `starts_at + duración total + buffer` |
| `status` | appointment_status | default `pending` |
| `price_total` | numeric(10,2) | snapshot del precio al momento de reservar (no recalcular si el servicio cambia de precio después) |
| `customer_note` | text | nullable |
| `cancellation_reason` | text | nullable |
| `created_by` | uuid FK → users.id | quién creó la cita (cliente o barbero/admin en walk-in) |
| `created_at` / `updated_at` | timestamptz | |

**Nota de normalización:** si un servicio puede combinarse con otros en una sola reserva (multi-servicio), lo correcto en 3FN es una tabla puente `appointment_services (appointment_id, service_id, price_snapshot, duration_snapshot)` en vez del array. Se recomienda esa tabla para V2; el array es aceptable en MVP si la mayoría de reservas son de un solo servicio.

**Constraint crítico (anti doble-booking):** índice de exclusión a nivel de base de datos, no solo lógica de aplicación:

```sql
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
  barber_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
) WHERE (status NOT IN ('cancelled', 'no_show'));
```

Esto garantiza a nivel de motor de base de datos que dos citas activas del mismo barbero nunca se superpongan — es la implementación real de la regla crítica definida en Loop 0, y **no depende de que el backend haga bien el locking en la capa de aplicación**.

---

## 12. `appointment_status_history`
Auditoría de cada transición de estado — necesaria para KPIs (tiempo hasta confirmación, tiempo de atención real) y para disputas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments.id | |
| `from_status` | appointment_status | nullable (primer registro) |
| `to_status` | appointment_status | |
| `changed_by` | uuid FK → users.id | |
| `changed_at` | timestamptz | |
| `note` | text | nullable |

Se inserta automáticamente vía trigger o en la capa de servicio cada vez que `appointments.status` cambia — nunca se actualiza `appointments.status` sin dejar rastro acá.

---

## 13. `payments`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments.id | |
| `amount` | numeric(10,2) | |
| `method` | payment_method | |
| `status` | payment_status | |
| `provider` | varchar(50) | nullable — pasarela usada (Mercado Pago, Stripe, etc.) |
| `provider_transaction_id` | varchar(150) | nullable |
| `paid_at` | timestamptz | nullable |
| `refunded_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

*(V2 — no bloquea MVP, pero se modela desde ahora para no romper `appointments` después)*

---

## 14. `notifications`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id | destinatario |
| `appointment_id` | uuid FK → appointments.id | nullable |
| `type` | notification_type | |
| `channel` | notification_channel | |
| `sent_at` | timestamptz | nullable — null si está encolada |
| `read_at` | timestamptz | nullable |
| `payload` | jsonb | contenido renderizado (para debug/reenvío) |
| `created_at` | timestamptz | |

---

## 15. `reviews`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments.id UNIQUE | una review por cita, no por cliente-barbero |
| `customer_id` | uuid FK → customers.id | |
| `barber_id` | uuid FK → barbers.id | |
| `rating` | smallint | `CHECK (rating BETWEEN 1 AND 5)` |
| `comment` | text | nullable |
| `barber_reply` | text | nullable — V2+ |
| `created_at` | timestamptz | |

**Constraint:** solo se puede crear si `appointment.status = 'completed'`.

*(V2)*

---

## 16. `subscriptions`
Plan de la barbería sobre la plataforma (modelo de negocio del SaaS, no de la barbería hacia sus clientes).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops.id UNIQUE | |
| `plan` | subscription_plan | |
| `status` | subscription_status | |
| `current_period_start` / `current_period_end` | timestamptz | |
| `provider_subscription_id` | varchar(150) | nullable — Stripe/MP subscription id |
| `created_at` / `updated_at` | timestamptz | |

---

## 17. `audit_logs`
Trazabilidad transversal de acciones sensibles (no solo citas — cambios de configuración, alta/baja de usuarios, etc.).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `actor_id` | uuid FK → users.id | quién ejecutó la acción |
| `entity_type` | varchar(50) | ej. `'barbershop'`, `'service'`, `'appointment'` |
| `entity_id` | uuid | |
| `action` | varchar(50) | `'create'`, `'update'`, `'delete'`, `'status_change'` |
| `diff` | jsonb | nullable — snapshot de cambios (before/after) |
| `ip_address` | inet | nullable |
| `created_at` | timestamptz | |

---

## ERD Resumido (relaciones clave)

```
users 1───1 barbers
users 1───1 customers
users 1───N barbershops (owner_id)

barbershops 1───N branches
branches 1───N barbers
branches 1───N business_hours
branches 1───N blocked_times (opcional)

barbershops 1───N services
barbers N───N services  (vía barber_services)

barbers 1───N barber_hours
barbers 1───N blocked_times (opcional)
barbers 1───N appointments

customers 1───N appointments
services 1───N appointments

appointments 1───N appointment_status_history
appointments 1───1 payments (o 1─N si hay reintentos de pago)
appointments 1───1 reviews (opcional)
appointments 1───N notifications (opcional)

barbershops 1───1 subscriptions
```

---

## Índices Críticos (además de las PK/FK)

```sql
-- Búsqueda de disponibilidad (el query más frecuente del sistema)
CREATE INDEX idx_appointments_barber_range ON appointments USING gist (barber_id, tstzrange(starts_at, ends_at));

-- Agenda del barbero por día
CREATE INDEX idx_appointments_barber_starts_at ON appointments (barber_id, starts_at);

-- Perfil público / búsqueda por slug
CREATE UNIQUE INDEX idx_barbershops_slug ON barbershops (slug);

-- Notificaciones pendientes de envío (worker de reminders)
CREATE INDEX idx_notifications_pending ON notifications (sent_at) WHERE sent_at IS NULL;

-- Historial de cliente por barbería (para no-show scoring)
CREATE INDEX idx_appointments_customer ON appointments (customer_id, starts_at DESC);
```

---

## Mapeo a Reglas Críticas (Loop 0)

| Regla crítica | Cómo se garantiza en el modelo |
|---|---|
| No doble reserva | Constraint `EXCLUDE` con gist en `appointments` — a nivel de motor de BD, no de aplicación |
| Duración dinámica del slot | `services.duration_minutes` + `barber_services.duration_override_minutes` alimentan el cálculo de `ends_at` |
| Buffer entre citas | `barbers.buffer_minutes`, sumado al calcular `ends_at` antes de insertar |
| Bloqueos con prioridad | `blocked_times` se consulta primero en el motor de disponibilidad; si hay overlap, el slot ni se muestra |
| No-show tracking | `customers.no_show_count`, incrementado vía trigger en `appointment_status_history` cuando `to_status = 'no_show'` |
| Zona horaria única por barbería | `barbershops.timezone` — todos los `timestamptz` se renderizan según ese campo, nunca según el timezone del dispositivo del cliente |
| Trazabilidad de estados | `appointment_status_history` — ninguna transición ocurre sin registro |
| Trazabilidad general | `audit_logs` para acciones fuera del ciclo de vida de una cita (config, alta de usuarios, etc.) |

---

## Mapeo MVP vs V2 (consistente con el roadmap de producto)

| Tabla | Fase |
|---|---|
| `users`, `barbershops`, `branches`, `barbers`, `customers` | **MVP** |
| `services`, `barber_services` | **MVP** |
| `business_hours`, `barber_hours`, `blocked_times` | **MVP** |
| `appointments`, `appointment_status_history` | **MVP** |
| `notifications` | **MVP** (canal mínimo: push/email; SMS/WhatsApp = V2) |
| `payments` | **V2** (modelada ahora para no migrar schema después) |
| `reviews` | **V2** |
| `subscriptions` | **V2** (o interno/admin si el modelo de negocio se define antes) |
| `audit_logs` | **MVP reducido** (solo cambios de estado de cita) → **V2 completo** (todas las entidades) |

---

*Este modelo es la base para Loop 2 (Arquitectura Técnica — stack, API, motor de disponibilidad) y Loop 5 (Setup del Proyecto). El constraint `EXCLUDE` de `appointments` es el elemento no negociable: es la pieza que convierte la regla de negocio "no doble booking" en una garantía técnica real.*
