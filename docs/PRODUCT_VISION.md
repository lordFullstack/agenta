# PRODUCT_VISION.md

> Consolidado desde el Loop 0 del proyecto (Product Discovery). Contenido original, no
> reinventado — ver `CHANGELOG.md` para la trazabilidad.

## Product Vision

**Visión:** ser la plataforma líder de agendamiento para barberías independientes y cadenas
pequeñas, eliminando citas perdidas, llamadas telefónicas y el caos de WhatsApp, mientras da
a cada barbería su propia vitrina digital con reservas en tiempo real.

**Propuesta de valor:**
- Cliente final: reservar una cita en menos de 60 segundos, sin llamar, sin esperar respuesta.
- Barbería/barbero: llenar la agenda, reducir no-shows, profesionalizar la operación sin
  software complejo.

**Diferenciador:** experiencia mobile-first ultraligera (PWA), foco vertical en barberías
(no genérico), lógica específica del rubro (elección de barbero, duración por servicio).

## Personas

| Persona | Rol | Necesidad principal |
|---|---|---|
| Cliente Final | Usuario que agenda | Reservar rápido, elegir barbero favorito, recordatorio |
| Barbero | Presta el servicio | Ver agenda del día, bloquear horarios, evitar huecos |
| Dueño/Admin | Gestiona el negocio | Configurar servicios/precios/horarios, métricas, gestión de barberos |
| Recepcionista (V2) | Agenda en nombre de otros | Walk-ins, caja del día |
| Super Admin | Equipo de la plataforma | Gestión de barberías, planes, soporte |

## Jobs To Be Done

**Cliente:** reservar sin llamar a nadie; volver a agendar con el mismo barbero fácil;
saber cuánto va a esperar y pagar; no perder el turno ni la seña por olvido.

**Barbero:** día organizado sin sorpresas; bloquear horarios cuando no puede atender;
reducir no-shows.

**Dueño:** control de todos los barberos en un panel; entender qué servicios generan más
ingresos; verse profesional online.

## MVP

**Cliente:** perfil público de barbería, disponibilidad real, reserva (servicio + barbero +
horario), registro simple (OTP), confirmación + recordatorio, cancelar/reagendar.

**Barbería:** registro y configuración de perfil, alta de servicios, horario por barbero,
panel de agenda (día/semana), marcar completada/no-show/cancelada, bloqueo manual de horarios.

**Fuera del MVP explícitamente:** pagos online/depósitos, multi-sucursal completo,
reviews/ratings, programa de fidelidad, chat interno.

## V2

Pagos online y depósitos, reviews de barberos, reagendamiento con 1 clic, recordatorios
inteligentes post-corte (3-4 semanas), rol de recepcionista/walk-ins, WhatsApp Business API,
dashboard de métricas, multi-sucursal para cadenas, referidos.

## Futuro (V3+)

Marketplace/descubrimiento estilo Booksy, propinas digitales, programa de lealtad, venta de
productos integrada, IA para pricing/horarios, check-in por geolocalización, integración con
Google/Apple Calendar, app nativa si la PWA no alcanza.

## Riesgos funcionales identificados en Loop 0

- Concurrencia en reservas (double-booking) → **resuelto a nivel de arquitectura**, ver
  `DECISIONS_LOG.md` DEC-004.
- Adopción del barbero (no actualizar estado en tiempo real desincroniza la agenda real).
- No-shows sin fricción sin depósito (fuera del MVP).
- Dependencia de notificaciones para el valor central del producto.
- Resistencia al cambio desde WhatsApp — requiere fuerte onboarding/soporte.
- Zona horaria y horarios irregulares → **mitigado**, `tenants.timezone` +
  `staff_hours`/`business_hours` con turnos partidos soportados desde el modelo base.
- Escalabilidad de queries de disponibilidad en tiempo real → mitigado con índices GIST;
  revisar si el volumen real lo justifica (ver nota de cache en el motor de disponibilidad).

## KPIs del producto

**Adopción:** barberías activas semanales, citas agendadas por semana.
**Eficiencia:** tiempo promedio de reserva (objetivo <60s), conversión perfil→reserva.
**Retención:** % de re-reserva en 30-45 días, churn de barberías mes 2 vs mes 1.
**Calidad operativa:** tasa de no-shows, cancelaciones tardías, % de citas 100% gestionadas
por la app (vs. fallback a llamada/WhatsApp).
**Negocio:** ingresos vía plataforma, LTV/CAC de barbería.

## Backlog priorizado (resumen — ver ROADMAP.md para el detalle de ejecución real)

P0: motor de disponibilidad, reserva end-to-end, panel de agenda, configuración de
servicios/horarios. P1: notificaciones, cancelación/reagendamiento, tracking de no-shows.
P2: pagos, reviews, dashboard de métricas. P3: multi-sucursal, marketplace.
