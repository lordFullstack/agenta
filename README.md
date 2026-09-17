# PWA Barbería — MVP v1.0

Plataforma SaaS multi-tenant de reservas para barberías, mobile-first. Cliente y barbería,
backend y frontend, autenticación real, motor de disponibilidad anti double-booking
verificado contra Postgres real. Ver `docs/CURRENT_STATE.md` para el alcance exacto de qué
es MVP real y qué queda diferido a V2.

## Quick start — levantar el servidor real

```bash
cp .env.example .env
docker compose up -d postgres    # levanta Postgres con las 18 migraciones aplicadas
cd backend
npm install
npm run dev                       # arranca el servidor en http://localhost:3000
```

Confirmar que responde: `curl http://localhost:3000/health` → `{"status":"ok"}`

**Importante:** después de levantar Postgres por primera vez, verificar que el constraint
anti double-booking exista de verdad (no asumirlo por el nombre de la migración):

```bash
docker compose exec postgres psql -U barbershop -d barbershop \
  -c "\d appointments" | grep EXCLUDE
```

Debería mostrar `no_overlapping_appointments EXCLUDE USING gist (...)`. Si no aparece nada,
algo falló silenciosamente al aplicar las migraciones — ver `docs/DECISIONS_LOG.md` DEC-025
para el caso real en que esto pasó y por qué los tests no lo detectaron.

Para correr los tests (los que no requieren base de datos real):

```bash
npm test
```

Para correr el test de integración que prueba la concurrencia real (dos reservas simultáneas
al mismo slot):

```bash
DATABASE_URL=postgres://barbershop:barbershop_dev_password@localhost:5432/barbershop \
  npx --prefix backend jest tests/booking.integration.test.ts
```

Para reiniciar la base de datos desde cero: `./scripts/reset-db.sh`

## Estructura del proyecto

```
migrations/          18 migraciones SQL, numeradas y ordenadas (001-018)
backend/
  src/
    validation.ts            validadores puros (ventana de reserva, anticipación, timezone)
    availability.service.ts  wrapper tipado sobre el motor SQL de disponibilidad
    booking.service.ts       creación de citas: transacción + manejo de concurrencia + idempotencia
    availability.routes.ts   API REST (Express)
  tests/
    validation.test.ts             unitarios puros — sin DB
    booking.concurrency.test.ts    unitarios con pg mockeado — valida el manejo de errores
    booking.integration.test.ts    integración con Postgres real — valida la garantía de concurrencia
    helpers/seed.ts                fixtures de datos de prueba
docs/                 documentos de producto y arquitectura de los loops anteriores
docker-compose.yml    Postgres 16 con las migraciones auto-aplicadas al primer arranque
scripts/
  setup.sh            levanta todo y corre tests unitarios
  reset-db.sh         reinicia la base de datos desde cero
```

## Decisiones de arquitectura clave

- **Multi-tenancy:** shared database + `tenant_id` en cada tabla + Row-Level Security de
  Postgres, con `SET LOCAL app.tenant_id` wireado por transacción en el backend (no solo
  definido en el papel — ver `docs/DECISIONS_LOG.md` DEC-016).
- **RLS split público/privado:** catálogo (`branches`/`staff_members`/`services`) permite
  lectura pública para la búsqueda de clientes; datos operativos (`appointments`,
  `customer_profiles`, etc.) exigen tenant context para todo, sin excepción (DEC-015).
- **Anti doble-booking:** constraint `EXCLUDE USING gist` sobre `appointments`, a nivel de
  motor de base de datos — no depende de que el backend haga bien el locking.
- **Buffer antes/después:** enforced por el mismo constraint anti doble-booking (columnas
  generadas `occupied_starts_at`/`occupied_ends_at`), no por una capa de cálculo aparte.
- **Snapshot de precio/duración:** `appointment_items` congela el precio y duración al momento
  de la reserva — cambios futuros en el catálogo no afectan citas ya creadas.
- **Concurrencia:** resuelta por Postgres (constraint `EXCLUDE`), no por locks distribuidos en
  la aplicación. El backend captura el código `23P01` y responde `409` con alternativas.
- **Idempotencia:** header `Idempotency-Key` obligatorio en endpoints mutantes — protege
  contra duplicados por reintentos de UI (doble-tap), un problema distinto al de concurrencia.
- **Autenticación:** OTP para clientes (sin password), JWT de acceso (15 min) + refresh
  token rotable/revocable para todos los roles. La identidad de quien actúa
  (`customer_id`/`cancelled_by`/etc.) se deriva siempre del token verificado, nunca del body
  de la request (DEC-017).

## Estado de avance (loops — numeración canónica, ver `docs/ROADMAP.md`)

| Loop | Contenido | Estado |
|---|---|---|
| 00 | Memory & Context — documentación persistente en `/docs` | ✅ |
| 01 | Product Discovery | ✅ |
| 02 | UX Architecture (22 pantallas) | ✅ |
| 03 | Design System | ✅ |
| 04 | Technical Architecture | ✅ |
| 05 | Database (14 migraciones) | ✅ |
| 06 | Authentication & RBAC | ✅ |
| 07 | Business / Barbershop (config de negocio) | ⬜ |
| 08 | Services & Barbers (gestión) | 🟡 parcial |
| 09 | Scheduling Engine | ✅ |
| 10 | Booking Engine | ✅ |
| 11 | Customer Experience (14 pantallas) | 🟡 UI lista, falta conectar al backend |
| 12-20 | Ver `docs/ROADMAP.md` | ⬜ |

Detalle completo, incluyendo qué es `IN PROGRESS` y por qué, en `docs/CURRENT_STATE.md`.

## Requisitos

- Docker y Docker Compose
- Node.js 20+
- (Para el test de integración) una instancia de Postgres 16 con `pgcrypto` y `btree_gist`
  disponibles como extensiones — ya cubierto por la imagen `postgres:16-alpine` del compose.
