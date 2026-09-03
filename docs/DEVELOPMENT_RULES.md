# DEVELOPMENT_RULES.md

## Workflow obligatorio por loop

```
ANALYZE → PLAN → IMPLEMENT → TEST → AUDIT → FIX → REGRESSION → OPTIMIZE → DOCUMENT → CHECKPOINT → HANDOFF
```

No saltar directamente a IMPLEMENT. Antes de codificar: inspeccionar estructura existente,
revisar `/docs`, revisar código ya escrito, identificar dependencias y riesgos.

## Antes de codificar

- Leer `AI_CONTEXT.md` y `CURRENT_STATE.md` si es una sesión nueva.
- Revisar `DECISIONS_LOG.md` para no reabrir decisiones ya tomadas.
- Revisar `KNOWN_ISSUES.md` para no duplicar bugs ya identificados.
- Confirmar que la migración/servicio que se va a tocar no rompe algo listado en
  "DO NOT BREAK" de `AI_CONTEXT.md`.

## Durante el desarrollo

- Reutilizar servicios y componentes existentes (`CatalogService`, `AvailabilityService`,
  `BookingService`, tokens del Design System) antes de crear alternativas nuevas.
- Mantener la arquitectura: la lógica crítica de negocio (disponibilidad, anti double-booking,
  máquina de estados) vive en PostgreSQL, no se reimplementa en la aplicación.
- Mantener el patrón de errores de dominio (`ValidationConflict`, `SlotNoLongerAvailableError`,
  `InvalidStatusTransitionError`, etc.) — no usar excepciones genéricas para casos ya cubiertos.
- No introducir dependencias nuevas sin necesidad concreta.
- No cambiar el stack (`STACK` en `AI_CONTEXT.md`) sin registrar la decisión en `DECISIONS_LOG.md`.
- Nunca reemplazar una migración ya escrita — corregir con una migración nueva (ver
  migración 010 como ejemplo de patch sobre 009).

## Después de codificar

- Correr los tests relevantes (ver `README.md` para comandos). No asumir que algo funciona
  porque compila.
- Revisar regresiones — correr toda la suite, no solo los tests nuevos.
- Actualizar `CHANGELOG.md`, `CURRENT_STATE.md`, y `DECISIONS_LOG.md` si hubo una decisión
  relevante.
- Si el loop introduce o resuelve un problema conocido, actualizar `KNOWN_ISSUES.md`.

## QA — cobertura mínima para features críticas

Toda funcionalidad crítica (disponibilidad, reservas, cancelación, reprogramación) debe
evaluarse en:

`HAPPY PATH · EDGE CASES · ERROR CASES · PERMISSIONS · MOBILE/TABLET/DESKTOP · OFFLINE ·
NETWORK FAILURE · DUPLICATE REQUEST · CONCURRENCY`

Clasificación de errores: `CRITICAL / HIGH / MEDIUM / LOW`. **No declarar release si hay
errores CRITICAL abiertos** — ver `SECURITY_RULES.md` para los CRITICAL activos hoy.

## Formato de cierre de loop

Cada loop (incluyendo este) cierra con el formato fijo definido en el brief del proyecto:
`LOOP / STATUS / OBJECTIVE / COMPLETED / DECISIONS / DOCUMENTATION UPDATED / FILES CREATED /
FILES MODIFIED / RISKS / BLOCKERS / KNOWN ISSUES / REGRESSION / NEXT LOOP / HANDOFF READY`.

## Migración entre chats

Si el usuario pide "migrar chat" / "cambiar de chat" / "preparar handoff" / "continuar en
otro chat": **no seguir desarrollando funcionalidades**. Primero actualizar
`CURRENT_STATE.md`, `DECISIONS_LOG.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, definir el
próximo loop en `ROADMAP.md`, y generar el `CONTEXT TRANSFER` (mismo formato que
`AI_HANDOFF.md`).
