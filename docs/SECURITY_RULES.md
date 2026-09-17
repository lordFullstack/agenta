# SECURITY_RULES.md

> Este documento incluye explícitamente lo que **falta**, no solo lo que existe. No declarar
> el proyecto deployable mientras haya ítems marcados CRITICAL sin resolver.

## Estado actual (honesto)

| Área | Estado |
|---|---|
| Autenticación | ✅ OTP (clientes) + password (staff/admin), JWT + refresh rotable |
| Autorización (RBAC) | ✅ `authenticate`/`requireRole`/`requireCustomerIdentity`, aplicados en rutas de reserva |
| Tenant isolation (RLS) | ✅ Definida en DB + wireada en runtime (`withTenantContext`) para el flujo de cliente |
| Input validation | ✅ Validación de UUIDs en los 13 parámetros de ruta que la necesitaban (rutas de reserva + administración) |
| Rate limiting | ✅ Implementado (OTP, login, registro, creación de citas) — en memoria, no distribuido (DEC-023) |
| Session/token security | ✅ Access token en memoria, refresh rotable y revocable — ver DEC-018 para el trade-off de storage |
| Prevención de SQL injection | Sí — todas las queries usan parámetros (`$1, $2...`), no concatenación |
| Prevención de IDOR | ✅ Para el flujo de cliente — la identidad se deriva del token, no del body (DEC-017) |
| Audit logs | Tabla `audit_logs` existe (inmutable), sin instrumentar todavía en el código de servicios |
| Secrets | `JWT_SECRET`/`OTP_PEPPER` vía variables de entorno — `.env.example` trae valores dummy, reemplazar antes de cualquier entorno compartido |

## RESUELTO EN LOOP 06 — antes eran CRITICAL, dejo el detalle por trazabilidad

### 1. Autenticación — ✅ resuelto

OTP para clientes (`/v1/auth/otp/request`, `/verify`), password para staff/admin
(`/v1/auth/login`), JWT de acceso (15 min) + refresh token rotable/revocable
(`/v1/auth/refresh`, `/logout`). `customer_id`/`created_by`/etc. ya no se reciben del body
en los endpoints de reserva — se derivan del token verificado (`req.user`).

### 2. Autorización por rol — ✅ resuelto (para el flujo de cliente)

`authenticate` + `requireRole` + `requireCustomerIdentity` en `middleware.ts`, aplicados en
`POST /v1/appointments`, `/cancel`, `/reschedule`. **Salvedad:** las rutas de gestión de
barbería (Loop 07/08/12) todavía no existen — cuando se construyan, deben aplicar el mismo
patrón (`requireRole('owner', 'branch_admin')` según corresponda), no es automático.

### 3. RLS wireado en runtime — ✅ resuelto (para las rutas existentes)

`db/tenant-context.ts` (`withTenantContext`, vía `SET LOCAL`) aplicado en `BookingService`
y `AvailabilityService.getAvailableSlots`. Además, la migración 014 separó las políticas
entre catálogo público (`branches`/`staff_members`/`services`: `SELECT` libre, mutación
tenant-scoped) y datos operativos privados (siguen exigiendo `app.tenant_id` para todo) —
ver DEC-015. **Salvedad:** cada endpoint nuevo que toque una tabla con RLS debe aplicar
`withTenantContext` explícitamente; no es automático por el solo hecho de que la tabla tenga
RLS habilitado.

## RESUELTO EN LOOP 16 (Security Audit formal)

### 4. Rate limiting — ✅ resuelto

`rate-limit.middleware.ts` — ventana deslizante en memoria (DEC-023). Aplicado a
`POST /v1/auth/otp/request` (5/15min por teléfono), `/otp/verify` y `/login` (10/15min por
IP), `/v1/business/register` (10/15min por IP), `POST /v1/appointments` (100/15min por IP).
**Limitación conocida:** no es distribuido — con múltiples instancias, el límite efectivo
escala con la cantidad de instancias. Migrar a Redis si eso se vuelve un problema real.

### 5. Validación de parámetros de ruta — ✅ resuelto

`validate-params.middleware.ts` (`validateUuidParams`) — rechaza con `400` antes de tocar la
base de datos si un parámetro de ruta no es un UUID bien formado. Aplicado a las 13 rutas de
reserva/cancelación/reprogramación y administración que reciben IDs por URL.

## CRITICAL — ninguno abierto al cierre de Loop 06

## HIGH — ninguno abierto al cierre de Loop 16

## MEDIUM

- **Refresh token persistido en `localStorage` (DEC-018).** Es legible por cualquier script
  que logre inyectarse (XSS) — la mitigación es que el access token (lo que de verdad abre
  puertas en cada request) vive solo en memoria y dura 15 minutos, y que `logout` revoca
  todos los refresh tokens del usuario. La opción más segura (cookie `httpOnly` seteada por
  el backend) queda pendiente de evaluar antes de un release real.
- **Audit logs no instrumentados.** La tabla existe y es inmutable por diseño, pero
  `BookingService`/`CatalogService` no insertan filas ahí todavía — hoy la única traza de
  cambios es `appointment_status_history` y `appointment_reschedules`, que cubren el ciclo
  de vida de una cita pero no cambios de configuración (servicios, horarios, etc.).

## Principios que sí están aplicados desde el día 1

- **Nunca confiar en el frontend para decisiones de negocio** — toda validación crítica
  (disponibilidad, duración, permisos de servicio) se re-verifica server-side. Ver
  `BUSINESS_RULES.md`.
- **Queries parametrizadas siempre** — cero concatenación de strings SQL en todo el código
  entregado.
- **Idempotencia explícita** en endpoints mutantes (`Idempotency-Key`), lo cual también
  mitiga (parcialmente) ataques de replay accidental, aunque no es un mecanismo de seguridad
  por sí mismo — no reemplaza autenticación.
- **Errores de negocio vs. errores técnicos separados explícitamente** — el backend nunca
  filtra detalles internos (stack traces, nombres de tablas) en las respuestas de error al
  cliente; los mensajes de `ValidationConflict`/`InvalidStatusTransitionError` están escritos
  para ser mostrados directamente al usuario.

## Checklist de Loop 16 (Security Audit formal) — resultado final

- [x] Endpoint de OTP para clientes — Loop 06
- [x] Login con password para staff/admin — Loop 06
- [x] Middleware de autenticación — Loop 06
- [x] Middleware de autorización por rol — Loop 06
- [x] `SET app.tenant_id` derivado del usuario autenticado, nunca del body — Loop 06
- [x] `customer_id`/`created_by` derivados del token, no del body — Loop 06 (DEC-017)
- [x] Rate limiting en endpoints públicos y mutantes — Loop 16 (DEC-023)
- [x] Validación de formato de parámetros de ruta — Loop 16
- [x] Verificación de que no haya secretos reales commiteados — Loop 16 (revisado, solo
      defaults de desarrollo marcados explícitamente en `.env.example`)
- [x] CSRF — no aplica: la API usa Bearer tokens en header, no cookies; un sitio ajeno no
      puede adjuntar automáticamente ese header en una request cross-site
- [x] XSS — mitigado por el escape automático de React en el frontend; riesgo residual
      documentado explícitamente (DEC-018, refresh token en `localStorage`)
- [ ] `audit_logs` instrumentado en servicios de escritura — **diferido conscientemente**
      (DEC-024, severidad MEDIUM, no bloquea el cierre)

**Resultado: 0 CRITICAL, 0 HIGH, 2 MEDIUM abiertos (audit_logs sin instrumentar,
refresh token en localStorage), ambos con decisión documentada de por qué se aceptan.**
