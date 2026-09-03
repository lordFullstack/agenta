# PROJECT_CONTEXT.md

## Qué es este proyecto

PWA SaaS multi-tenant de agendamiento para barberías, mobile-first. Dos superficies de
producto: **cliente** (descubre barberías, reserva, gestiona sus citas) y **barbería**
(gestiona agenda, servicios, barberos, horarios — diseñado, no implementado en código aún).

Ver `PRODUCT_VISION.md` para la visión de producto completa (personas, JTBD, MVP/V2/Futuro).

## Usuarios del sistema

`CUSTOMER · BARBER · MANAGER (branch_admin) · OWNER · SUPER_ADMIN` — ver `PRODUCT_VISION.md`
para objetivos/permisos/necesidades de cada uno. **Los permisos deben vivir en el backend,
nunca solo en la interfaz** — regla fundacional del proyecto, ver `SECURITY_RULES.md`.

## Mapa de archivos

```
/docs                          ← documentación persistente (este directorio)
/migrations                    ← 13 migraciones SQL, numeradas, fuente de verdad del schema
/backend
  /src
    validation.ts              ← validadores puros
    catalog.service.ts         ← lectura de catálogo (barbería/servicios/barberos)
    availability.service.ts    ← wrapper sobre el motor SQL de disponibilidad
    booking.service.ts         ← crear/cancelar/reprogramar citas
    availability.routes.ts     ← rutas Express
  /tests                       ← 25 tests (backend)
/frontend
  /src
    /api/booking-api-client.ts ← cliente HTTP (timeout, retry, idempotencia)
    /hooks/useBookingFlow.ts   ← máquina de estados del flujo de 14 pasos
    /components/BookingFlow.tsx← UI del flujo de reserva (React)
  /tests                       ← 6 tests (cliente HTTP)
  /prototype
    booking-flow.html          ← prototipo standalone de 14 pantallas, testeado (21 tests)
docker-compose.yml              ← Postgres local con migraciones auto-aplicadas
scripts/                        ← setup.sh, reset-db.sh
README.md                       ← quick start
```

## Cómo entender el estado del proyecto rápido

1. `AI_CONTEXT.md` — resumen ejecutivo para orientarse en 2 minutos.
2. `CURRENT_STATE.md` — qué está hecho, en progreso, pendiente, bloqueado.
3. `ROADMAP.md` — loops con estado y dependencias.
4. `DECISIONS_LOG.md` — por qué las cosas están como están (no reabrir sin leer esto).
5. `KNOWN_ISSUES.md` — qué falta y qué severidad tiene.

## Fuente de verdad por tipo de información

| Información | Fuente de verdad real |
|---|---|
| Schema de base de datos | `/migrations/*.sql` (no `DATABASE.md`, que es un resumen) |
| Comportamiento de la API | El código de `availability.routes.ts` + `API_CONTRACTS.md` |
| Decisiones de diseño visual | `docs/design-system-pwa-barberias.md` |
| Decisiones arquitectónicas/negocio | `DECISIONS_LOG.md` |
| Estado de avance | `CURRENT_STATE.md` + `ROADMAP.md` |

Si hay contradicción entre el chat, la memoria de una IA, la documentación y el código:
**inspeccionar el proyecto real y determinar cuál es la versión más reciente y confiable**
antes de continuar — nunca asumir.
