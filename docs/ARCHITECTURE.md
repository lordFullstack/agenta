# ARCHITECTURE.md

## Vista general

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────┐
│  Frontend (React PWA /   │─────▶│  Backend (Node/TS/Express)│─────▶│  PostgreSQL 16       │
│  prototipo HTML+Tailwind)│◀─────│  Servicios + rutas REST   │◀─────│  Motor de negocio en │
└─────────────────────────┘      └──────────────────────────┘      │  SQL (no en la app)  │
                                                                     └─────────────────────┘
```

**Decisión central de arquitectura:** la lógica crítica de negocio (anti double-booking,
buffer, máquina de estados de citas, disponibilidad) vive en PostgreSQL — constraints,
triggers y funciones PL/pgSQL — no en la aplicación. El backend consulta, orquesta
transacciones, y traduce errores de Postgres a errores de dominio. Esto es deliberado: la
garantía de "no doble booking incluso con requests simultáneos" solo es real si vive en el
motor de base de datos (ver `DECISIONS_LOG.md` DEC-004).

## Capas

### Base de datos (`/migrations`)

13 migraciones numeradas y ejecutables en orden (`001` a `013`). Ver `DATABASE.md` para el
detalle de entidades. Extensiones requeridas: `pgcrypto` (UUIDs), `btree_gist` (constraints
`EXCLUDE` sobre columnas escalares + rango).

### Backend (`/backend/src`)

| Archivo | Responsabilidad |
|---|---|
| `validation.ts` | Validadores puros (ventana de reserva, anticipación mínima, formato de request) — sin I/O, 100% unit-testeables |
| `catalog.service.ts` | Lectura: perfil de barbería, servicios, barberos por servicio |
| `availability.service.ts` | Wrapper tipado sobre las funciones SQL de disponibilidad |
| `booking.service.ts` | Crear/cancelar/reprogramar citas — transacciones, manejo de concurrencia, idempotencia |
| `availability.routes.ts` | Rutas Express, mapeo de errores de dominio a códigos HTTP |

### Frontend (`/frontend/src`)

| Archivo | Responsabilidad |
|---|---|
| `api/booking-api-client.ts` | Cliente HTTP: timeout (`AbortController`), retry con backoff, idempotencia |
| `hooks/useBookingFlow.ts` | Máquina de estados de los 14 pasos del flujo de reserva del cliente |
| `components/BookingFlow.tsx` | UI del flujo completo, usando los tokens del Design System |

### Prototipo standalone (`/frontend/prototype`)

`booking-flow.html` — las 14 pantallas de cliente en HTML+Tailwind+JS vanilla, navegable e
interactivo, **no conectado al backend real** (usa datos de demo). Sirve como referencia
visual validada (21 tests de humo con jsdom) mientras se conecta `BookingFlow.tsx` al backend.

## Motor de disponibilidad — dónde vive cada regla

```
HORARIO BARBERÍA + HORARIO BARBERO + SERVICIO + DURACIÓN
  + DESCANSOS + BLOQUEOS + VACACIONES + CITAS EXISTENTES
  = SLOTS DISPONIBLES
```

Implementado como funciones PL/pgSQL (migraciones 009-011):
- `resolve_appointment_duration(staff_id, service_ids[])` — suma duraciones + buffer, o
  `NULL` si el barbero no ofrece alguno de los servicios (ver DEC-006)
- `get_working_windows(staff_id, date)` — resuelve ventanas de trabajo (staff_hours >
  business_hours > time_off anula el día > tenant/branch/staff deben estar activos)
- `get_available_slots(...)` — genera candidatos por grilla fija, valida contra citas y
  bloqueos usando los índices GIST
- `get_available_slots_any_staff(...)` — wrapper para "cualquiera disponible"

## Concurrencia

Dos capas, ambas en PostgreSQL:
1. `EXCLUDE USING gist` sobre `appointments` (staff_id, rango ocupado con buffer) — previene
   solapamiento cita-vs-cita.
2. Trigger `BEFORE INSERT/UPDATE` (`check_appointment_against_blocks`) — previene
   cita-vs-bloqueo/vacación, porque `EXCLUDE` no soporta validación cruzada entre tablas.

El backend captura `23P01` (exclusion_violation) → `409` con alternativas, y `P0001`
(excepción de trigger de negocio) → `422`.

## Multi-tenancy

Shared database, `tenant_id` en cada tabla tenant-scoped + Row-Level Security. **El wiring
de `SET app.tenant_id` por conexión/transacción no existe todavía en el código del backend**
— es el próximo bloqueador crítico (ver `SECURITY_RULES.md`, `ROADMAP.md` Loop 8).

## Infraestructura local

`docker-compose.yml` levanta Postgres 16 con las migraciones auto-aplicadas
(`docker-entrypoint-initdb.d`). `scripts/setup.sh` orquesta todo; `scripts/reset-db.sh`
reinicia desde cero.

## Lo que falta a nivel de arquitectura (ver ROADMAP.md)

Capa de autenticación/sesión, wiring de tenant en runtime, worker de notificaciones
asíncronas, manifest + service worker para PWA real, capa de gestión del lado barbería.
