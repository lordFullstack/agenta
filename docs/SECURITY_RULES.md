# SECURITY_RULES.md

> Este documento incluye explícitamente lo que **falta**, no solo lo que existe. No declarar
> el proyecto deployable mientras haya ítems marcados CRITICAL sin resolver.

## Estado actual (honesto)

| Área | Estado |
|---|---|
| Autenticación | ✅ OTP (clientes) + password (staff/admin), JWT + refresh rotable |
| Autorización (RBAC) | ✅ `authenticate`/`requireRole`/`requireCustomerIdentity`, aplicados en rutas de reserva |
| Tenant isolation (RLS) | ✅ Definida en DB + wireada en runtime (`withTenantContext`) para el flujo de cliente |
| Input validation | Parcial (solo en el flujo de reserva) |
| Rate limiting | **No implementado** |
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

## CRITICAL — ninguno abierto al cierre de Loop 06

## HIGH

- **Rate limiting ausente.** El endpoint `POST /v1/appointments` podría ser abusado para
  agotar el generador de números de confirmación o para spam de reservas.
- **Validación de input incompleta.** `validation.ts` cubre bien el flujo de disponibilidad/
  reserva; los endpoints de catálogo (`catalog.service.ts`, rutas de `/v1/barbershops/*`,
  `/v1/branches/*/staff`) no tienen la misma capa de validación de UUIDs/formato.

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

## Checklist para Loop 7 (Autenticación y Autorización) — no implementar todavía, solo referencia

- [ ] Endpoint de OTP para clientes (enviar código, verificar código, emitir token)
- [ ] Login con password para staff/admin
- [ ] Middleware de autenticación (verifica token, adjunta `req.user`)
- [ ] Middleware de autorización por rol (verifica que `req.user.role` puede hacer la acción)
- [ ] Middleware que hace `SET app.tenant_id` por request, derivado del usuario autenticado
      (nunca del body de la request — evita que alguien mande un `tenant_id` ajeno)
- [ ] Verificar que `customer_id`/`created_by` en `BookingService` se derive del token, no del body
- [ ] Rate limiting en endpoints públicos (búsqueda, disponibilidad) y mutantes (reservas)
