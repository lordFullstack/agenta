# Arquitectura UX — PWA Mobile-First de Reservas para Barberías

## 0. Principios de Diseño (Design System Base)

### Thumb Zone
Todos los CTA principales viven en el **tercio inferior de la pantalla** (zona de alcance natural del pulgar en uso de una sola mano). Elementos secundarios o de solo lectura pueden vivir arriba.

### Bottom Navigation
- **App Cliente:** `Inicio | Buscar | Mis Citas | Perfil` (4 ítems, ícono + label)
- **App Barbería:** `Dashboard | Agenda | Clientes | Más` (4 ítems, ícono + label)
- Persistente en pantallas raíz. Se oculta en flujos lineales (reserva, wizard de configuración) para maximizar foco.

### Bottom Sheets
Se usan para decisiones rápidas sin romper el contexto: selección de barbero, selección de hora, filtros, acciones sobre una cita, confirmaciones. Nunca para formularios largos (eso va a pantalla completa).

### Floating Action Button (FAB)
Reservado para **la acción más frecuente y de mayor valor** de cada contexto:
- Cliente → no lleva FAB global (el flujo de reserva ya es el flujo principal de la app).
- Barbería → FAB de **"+ Nueva cita"** (walk-in manual) visible en Agenda.

### Bento Grid
Se usa en pantallas de **resumen/overview** con información heterogénea en tamaño y jerarquía: Dashboard de barbería, Perfil de barbería (cliente), Home. No se usa en listados secuenciales (agenda, historial) donde una lista vertical es más legible.

### Estados universales (aplican a toda pantalla con datos)
- **Loading:** skeleton screens (no spinners genéricos) que respetan el layout final.
- **Empty:** ilustración simple + mensaje + CTA de acción (nunca una pantalla en blanco).
- **Error:** mensaje claro en lenguaje humano + botón de reintentar; nunca códigos técnicos.
- **Success:** confirmación visual breve (toast, check animado, o pantalla de éxito si es un hito, como completar una reserva).

---

# PARTE 1 — APP CLIENTE

Bottom Nav: **Inicio · Buscar · Mis Citas · Perfil**

## 1.1 Onboarding

**Objetivo:** Llevar al usuario de "recién llegado" a "listo para reservar" con la mínima fricción, idealmente sin bloquear la exploración detrás de un login.

**Contenido:**
- Pantalla 1: value prop ("Reservá tu turno de barbería en 60 segundos")
- Pantalla 2 (opcional, solo si viene por link genérico y no de barbería): permiso de ubicación
- Sin login obligatorio para explorar — el login se pide recién al confirmar la reserva (guest browsing)

**CTA principal:** `Continuar` / `Explorar barberías`

**CTA secundarios:** `Ya tengo cuenta` (si aplica), `Omitir ubicación`

**Navegación:** Onboarding → Home (si llega orgánico) o directo a Perfil de Barbería (si llega por QR/link directo de una barbería — este es el camino más común y el que hay que optimizar).

**Interacción:** Swipe o auto-avance entre 1-2 pantallas máximo. Nunca más de 2 pantallas de onboarding.

**Estados:** N/A (contenido estático), excepto permiso de ubicación (concedido/denegado — si se deniega, fallback a búsqueda manual por texto/ciudad).

**Errores:** Si geolocalización falla, no bloquear: mostrar buscador manual inmediatamente.

---

## 1.2 Búsqueda

**Objetivo:** Encontrar la barbería deseada (por nombre, cercanía o link directo) en el menor número de taps.

**Contenido:**
- Barra de búsqueda sticky arriba
- Filtro rápido por chips: "Cerca de mí", "Mejor calificados", "Disponible hoy" (V2 si hay ratings)
- Lista de resultados: tarjeta con foto, nombre, distancia, próxima disponibilidad ("Próximo turno: hoy 15:30")

**CTA principal:** Tap en tarjeta → ir a Perfil de Barbería

**CTA secundarios:** Filtros, "Buscar por ciudad/zona"

**Navegación:** Búsqueda → Perfil de Barbería. Accesible desde Bottom Nav en todo momento.

**Interacción:** Búsqueda en tiempo real (debounce), scroll infinito o paginado en resultados.

**Estados:**
- Loading: skeleton de tarjetas (3-4 placeholders)
- Empty: "No encontramos barberías en tu zona" + CTA "Ampliar búsqueda"
- Error: "No pudimos cargar resultados" + Reintentar
- Success: lista poblada

**Errores:** Sin conexión → mostrar caché de últimas búsquedas si existe, con badge "Sin conexión, mostrando resultados guardados".

---

## 1.3 Barbería (Perfil Público)

**Objetivo:** Dar confianza suficiente para decidir reservar (esto es la "vidriera" del negocio), y ser el punto de entrada al flujo de reserva.

**Contenido (Bento Grid):**
- Header: foto de portada + logo + nombre + dirección + calificación (si V2)
- Bloque de horario de atención (hoy: abierto/cerrado + horario)
- Bloque de servicios destacados (2-3 con precio)
- Bloque de barberos (fotos circulares, tap → ver su disponibilidad directo)
- Galería de fotos del local
- Ubicación (mini mapa)

**CTA principal:** `Reservar cita` — botón fijo en la thumb zone (sticky bottom), visible en todo momento al hacer scroll.

**CTA secundarios:** `Ver en el mapa`, `Compartir barbería`, tap directo sobre un barbero específico (atajo al flujo de reserva pre-filtrado)

**Navegación:** Perfil de Barbería → (tap "Reservar") → Selección de Servicios

**Interacción:** Scroll vertical, CTA principal siempre visible (no se oculta con el scroll, es sticky).

**Estados:**
- Loading: skeleton del header + bloques
- Empty: N/A (si existe la barbería, siempre hay datos mínimos)
- Error: "No pudimos cargar esta barbería" + Reintentar / Volver
- Success: perfil completo

**Errores:** Barbería inactiva/pausada temporalmente → banner: "Esta barbería no está tomando reservas en este momento" + ocultar CTA de reservar, mostrar solo info de contacto.

---

## 1.4 Servicios

**Objetivo:** Elegir uno o más servicios de forma rápida, entendiendo precio y duración.

**Contenido:**
- Lista de servicios agrupados por categoría si aplica (Cortes, Barba, Combos)
- Cada ítem: nombre, duración estimada, precio, checkbox/toggle de selección
- Resumen flotante inferior: "1 servicio seleccionado — $X — 30 min"

**CTA principal:** `Continuar` (thumb zone, se activa al seleccionar ≥1 servicio)

**CTA secundarios:** Ver detalle del servicio (bottom sheet con descripción, si aplica)

**Navegación:** Servicios → Selección de Barbero

**Interacción:** Selección múltiple mediante checkboxes, feedback inmediato en el resumen sticky.

**Estados:**
- Loading: skeleton de lista
- Empty: (no debería pasar; si ocurre) "Esta barbería aún no cargó sus servicios" + volver
- Error: reintentar
- Success: lista interactiva

**Errores:** Si se intenta continuar sin seleccionar nada, el CTA principal permanece deshabilitado (no hay error modal, es prevención por diseño).

---

## 1.5 Selección de Barbero

**Objetivo:** Elegir barbero preferido, o dejar que el sistema asigne el primero disponible (para minimizar fricción y tiempo total de reserva).

**Contenido:**
- Card destacada arriba: `"Cualquiera disponible"` (recomendada, con badge "Más rápido")
- Grid de barberos (fotos, nombre, próxima disponibilidad: "Libre hoy 16:00")
- Si un barbero no ofrece alguno de los servicios seleccionados, se muestra deshabilitado con nota

**CTA principal:** Tap sobre la card del barbero elegido → avanza automático (no requiere botón "Continuar" extra, cada card es el CTA)

**CTA secundarios:** N/A

**Navegación:** Selección de Barbero → Calendario / Disponibilidad

**Interacción:** Tap directo sobre card = selección + avance (reduce un paso vs. seleccionar y luego confirmar).

**Estados:**
- Loading: skeleton de grid
- Empty: si ningún barbero ofrece el servicio elegido → "No hay barberos disponibles para este servicio" + volver a Servicios
- Error: reintentar
- Success: grid interactivo

**Errores:** N/A adicional (los estados cubren los casos).

---

## 1.6 Calendario

**Objetivo:** Elegir el día de la cita de forma visual y rápida.

**Contenido:**
- Selector horizontal de días (scroll horizontal, próximos 14-30 días), con indicador de "días con disponibilidad" vs. "sin cupo" (atenuado)
- Día actual destacado por defecto
- Debajo, transición directa a franjas horarias del día seleccionado (no es pantalla separada obligatoriamente — puede fusionarse con Disponibilidad, ver 1.7)

**CTA principal:** Selección de día = avance automático a horarios (si están en pantallas separadas) o scroll a sección de horarios (si están fusionadas — **recomendado para cumplir el objetivo de 60 segundos**)

**CTA secundarios:** `Ver más fechas` (si el rango visible no alcanza)

**Navegación:** Calendario → Disponibilidad (horarios)

**Interacción:** Swipe horizontal para navegar semanas, tap en día para seleccionar.

**Estados:**
- Loading: skeleton del selector de días
- Empty: días sin cupo se muestran atenuados/no clickeables (no es un estado de error, es información)
- Error: reintentar
- Success: calendario interactivo

**Errores:** Si toda la semana visible está sin cupo → mensaje inline "Sin turnos esta semana" + botón `Ver próxima semana`.

---

## 1.7 Disponibilidad (Horarios)

**Objetivo:** Elegir el horario exacto — es el paso más sensible a condiciones de carrera (doble booking), debe reflejar disponibilidad real en tiempo real.

**Contenido:**
- Franjas horarias del día seleccionado, agrupadas por Mañana/Tarde/Noche
- Cada slot: hora + estado (disponible / ocupado, atenuado y no clickeable)
- Slots calculados según duración real del servicio elegido

**CTA principal:** Tap en horario disponible → abre **Bottom Sheet de Confirmación** (ver 1.8), sin cambiar de pantalla completa (mantiene contexto y velocidad)

**CTA secundarios:** Cambiar de barbero desde aquí (link "¿Otro barbero?" si este día no tiene horarios convenientes)

**Navegación:** Disponibilidad → Bottom Sheet de Confirmación (no es una pantalla nueva, es una capa superpuesta)

**Interacción:** Tap directo. El sistema debe **re-validar disponibilidad en el momento del tap** (por si otro cliente reservó ese slot mientras el usuario navegaba) antes de abrir el sheet.

**Estados:**
- Loading: skeleton de franjas horarias
- Empty: "No hay horarios disponibles este día" + CTA `Ver otro día`
- Error: reintentar
- Success: grid de horarios

**Errores:** **Caso crítico** — si el slot fue tomado justo antes de confirmar: mostrar mensaje inmediato "Este horario ya no está disponible" + refrescar automáticamente la grilla + resaltar el horario más cercano alternativo.

---

## 1.8 Confirmación (Bottom Sheet)

**Objetivo:** Último check antes de comprometer la reserva — debe ser el paso más simple y directo del flujo.

**Contenido (Bottom Sheet, no pantalla completa):**
- Resumen: barbería, barbero, servicio(s), fecha/hora, precio total, duración
- Si el usuario no está autenticado: campo de teléfono + OTP inline (mínima fricción, sin salir del sheet)
- Nota opcional del cliente (campo de texto corto, opcional)
- Política de cancelación (texto breve, no bloqueante)

**CTA principal:** `Confirmar reserva`

**CTA secundarios:** `Editar` (vuelve a la pantalla correspondiente sin perder el resto de la selección)

**Navegación:** Confirmación → Pantalla de Éxito (no bottom sheet, esto sí merece pantalla completa por ser el hito principal del flujo)

**Interacción:** Sheet expandible (drag), formulario mínimo, teclado numérico automático para OTP.

**Estados:**
- Loading: botón en estado "Confirmando..." con spinner inline (no bloquear toda la pantalla)
- Empty: N/A
- Error: si falla la confirmación (ej. slot tomado) → mensaje inline en el sheet, sin cerrar el sheet, permitiendo elegir otro horario sin perder los datos ya ingresados
- Success: transición a pantalla de "¡Cita confirmada!" con animación breve

**Errores:** OTP incorrecto → mensaje inline + reenviar código. Slot tomado en el último instante → mensaje + CTA `Elegir otro horario` que vuelve a Disponibilidad manteniendo el resto de la selección intacta.

---

## 1.9 Mis Citas

**Objetivo:** Ver de un vistazo la(s) próxima(s) cita(s) confirmada(s) y gestionarlas (cancelar/reagendar).

**Contenido:**
- Sección "Próxima cita" destacada arriba (card grande con countdown: "Mañana a las 15:30")
- Lista de otras citas próximas (si hay más de una)
- Tab o toggle hacia Historial (1.10)

**CTA principal:** En la card de próxima cita: `Ver detalle` (abre bottom sheet con opciones: cancelar, reagendar, cómo llegar, agregar a calendario)

**CTA secundarios:** `Reservar otra cita` (si no hay ninguna próxima)

**Navegación:** Mis Citas es un ítem del Bottom Nav. Tap en card → Bottom Sheet de gestión de cita.

**Interacción:** Pull to refresh, tap en card abre sheet de acciones.

**Estados:**
- Loading: skeleton de card
- Empty: "No tenés citas próximas" + CTA `Buscar barbería` (lleva a Búsqueda)
- Error: reintentar
- Success: card(s) con info

**Errores:** Al intentar cancelar fuera de la ventana permitida → mensaje explicativo: "Esta cita ya no se puede cancelar sin costo (ventana de 2h)" con opción de contactar a la barbería directamente.

---

## 1.10 Historial

**Objetivo:** Ver citas pasadas para referencia y facilitar re-reserva rápida ("repetir mismo servicio/barbero").

**Contenido:**
- Lista cronológica inversa de citas completadas/canceladas/no-show
- Cada ítem: fecha, barbería, servicio, barbero, estado (badge de color)

**CTA principal:** `Reservar de nuevo` sobre cada ítem (atajo que pre-llena servicio + barbero, saltando directo a Calendario)

**CTA secundarios:** Tap en ítem → detalle read-only (recibo simple)

**Navegación:** Accesible como tab/toggle desde Mis Citas.

**Interacción:** Scroll vertical, paginado.

**Estados:**
- Loading: skeleton
- Empty: "Todavía no tenés historial de citas" (para usuarios nuevos)
- Error: reintentar
- Success: lista

**Errores:** N/A relevante más allá de carga.

---

## 1.11 Perfil

**Objetivo:** Gestionar datos personales y preferencias básicas.

**Contenido:**
- Datos del usuario (nombre, teléfono, email)
- Barberías favoritas (si hay reservas recurrentes)
- Preferencias de notificaciones
- Ayuda/soporte
- Cerrar sesión

**CTA principal:** `Editar perfil`

**CTA secundarios:** Gestión de notificaciones, soporte, logout

**Navegación:** Ítem de Bottom Nav.

**Interacción:** Formularios simples, toggles para notificaciones.

**Estados:** Loading/Error estándar en edición. Success: toast "Perfil actualizado".

**Errores:** Validación inline de campos (teléfono/email inválido).

---

# PARTE 2 — APP BARBERÍA

Bottom Nav: **Dashboard · Agenda · Clientes · Más**
(Más = Servicios, Barberos, Horarios, Configuración — agrupados para no saturar el nav con 8 ítems)

## 2.1 Dashboard

**Objetivo:** Dar al dueño/barbero una foto instantánea del estado del negocio al abrir la app.

**Contenido (Bento Grid):**
- Bloque grande: próxima cita / cita en curso
- Bloque: citas de hoy (contador + mini lista)
- Bloque: ingresos del día (si aplica al rol admin)
- Bloque: alertas (huecos sin llenar, no-shows recientes, cancelaciones nuevas)
- Bloque: acceso rápido a "Bloquear horario"

**CTA principal:** `Ver agenda de hoy` (lleva a Agenda con el día actual ya seleccionado)

**CTA secundarios:** Tap en cualquier bloque → detalle correspondiente

**Navegación:** Ítem raíz del Bottom Nav (pantalla de inicio para el rol barbería).

**Interacción:** Bento grid con cards tap-eables, pull to refresh.

**Estados:**
- Loading: skeleton de bento grid
- Empty: primer uso → "Aún no tenés citas hoy" + CTA para compartir el link de reserva
- Error: reintentar
- Success: dashboard poblado

**Errores:** N/A más allá de carga de datos.

---

## 2.2 Agenda

**Objetivo:** Vista operativa del día/semana para gestionar el flujo de citas en tiempo real.

**Contenido:**
- Selector de vista: Día / Semana
- Timeline vertical de horas con bloques de citas (color por estado: confirmada, en curso, completada, cancelada, bloqueada)
- Si es dueño con varios barberos: selector/filtro de barbero (columnas tipo calendario compartido en vista día)

**CTA principal (FAB):** `+ Nueva cita` — walk-in manual, abre bottom sheet de creación rápida

**CTA secundarios:** Tap en bloque de cita → bottom sheet de detalle/acciones; tap en hueco vacío → crear bloqueo o cita ahí directamente

**Navegación:** Ítem raíz del Bottom Nav.

**Interacción:** Scroll vertical por horas, swipe entre días, long-press sobre bloque para acciones rápidas (opcional).

**Estados:**
- Loading: skeleton de timeline
- Empty: día sin citas → "Sin citas para este día" + CTA para bloquear el día completo o compartir disponibilidad
- Error: reintentar
- Success: timeline poblado

**Errores:** Intento de crear cita en horario ya ocupado → bloqueo preventivo (el slot ni siquiera se muestra como disponible en el picker del sheet).

---

## 2.3 Citas (Detalle / Gestión — vía Bottom Sheet desde Agenda)

**Objetivo:** Ejecutar las acciones operativas sobre una cita puntual durante el día.

**Contenido:** Cliente, servicio, hora, duración, notas, estado actual, historial del cliente con este barbero (si tiene citas previas).

**CTA principal:** Cambia según estado —
- Si "confirmada" → `Marcar en curso`
- Si "en curso" → `Marcar completada`

**CTA secundarios:** `Cancelar`, `Reagendar`, `Marcar no-show`, `Contactar cliente`

**Navegación:** Se accede desde Agenda (tap en bloque). Al completar acción, vuelve a Agenda actualizada.

**Interacción:** Botones de estado grandes en thumb zone (el barbero suele operar con una mano mientras trabaja).

**Estados:** Loading al guardar cambio de estado (breve), Success con toast, Error con reintentar.

**Errores:** Intento de marcar "completada" sin haber pasado por "en curso" → el sistema permite el salto pero registra timestamp real (no bloquea al usuario, prioriza velocidad operativa sobre rigidez del flujo).

---

## 2.4 Clientes

**Objetivo:** Ver base de clientes de la barbería para relacionamiento y seguimiento (frecuencia, no-shows).

**Contenido:**
- Lista de clientes (nombre, última visita, contador de citas totales, badge si tiene no-shows recurrentes)
- Buscador arriba

**CTA principal:** Tap en cliente → perfil con historial de citas de ese cliente

**CTA secundarios:** `Agendar cita para este cliente` (acceso directo a Agenda pre-filtrado)

**Navegación:** Ítem del Bottom Nav.

**Interacción:** Búsqueda en tiempo real, scroll vertical.

**Estados:**
- Loading: skeleton
- Empty: "Todavía no tenés clientes registrados" (día 1 de la barbería)
- Error: reintentar
- Success: lista

**Errores:** N/A adicional.

---

## 2.5 Servicios (dentro de "Más")

**Objetivo:** Administrar el catálogo de servicios de la barbería.

**Contenido:** Lista de servicios (nombre, duración, precio, barberos asignados), reordenable.

**CTA principal:** `+ Agregar servicio` (FAB o botón fijo)

**CTA secundarios:** Editar/eliminar por ítem (swipe actions o tap → detalle)

**Navegación:** Dentro de "Más" → Servicios.

**Interacción:** Formulario de alta/edición en pantalla completa (no bottom sheet, por ser formulario con varios campos).

**Estados:** Loading/Empty ("Agregá tu primer servicio")/Error/Success estándar.

**Errores:** Validación — duración y precio no pueden ser 0 o vacíos.

---

## 2.6 Barberos (dentro de "Más")

**Objetivo:** Gestionar el equipo (alta de barberos, sus servicios asignados, su estado activo/inactivo).

**Contenido:** Lista de barberos con foto, estado (activo/pausado), servicios que realiza.

**CTA principal:** `+ Invitar barbero` (genera link/código de invitación)

**CTA secundarios:** Tap en barbero → editar perfil, pausar cuenta, ver su agenda individual

**Navegación:** Dentro de "Más" → Barberos.

**Interacción:** Formulario de invitación simple (teléfono/email).

**Estados:** Loading/Empty ("Agregá a tu primer barbero")/Error/Success.

**Errores:** Invitación a un contacto ya registrado → mensaje claro "Este barbero ya está en tu equipo".

---

## 2.7 Horarios (dentro de "Más")

**Objetivo:** Configurar disponibilidad general de la barbería y de cada barbero.

**Contenido:** Horario semanal por barbero (días y franjas), excepciones (feriados, días libres puntuales), buffer entre citas.

**CTA principal:** `Guardar horario`

**CTA secundarios:** `+ Agregar excepción` (bloqueo puntual, ej. vacaciones)

**Navegación:** Dentro de "Más" → Horarios.

**Interacción:** Selector visual de franjas por día (toggle de días + rango horario).

**Estados:** Loading/Error/Success estándar. Empty no aplica (siempre hay un horario por defecto sugerido al onboarding).

**Errores:** Solapamiento de franjas horarias inválido → validación inline antes de guardar.

---

## 2.8 Configuración (dentro de "Más")

**Objetivo:** Ajustes generales del negocio y la cuenta.

**Contenido:** Datos del negocio (nombre, dirección, fotos, redes), política de cancelación, notificaciones, plan/suscripción (si aplica), soporte.

**CTA principal:** `Guardar cambios`

**CTA secundarios:** Cerrar sesión, contactar soporte

**Navegación:** Dentro de "Más" → Configuración (última sección del menú).

**Interacción:** Formularios estándar, upload de imágenes.

**Estados:** Loading/Error/Success estándar.

**Errores:** Validación de campos obligatorios (nombre y dirección no pueden quedar vacíos).

---

## 3. Mapa de Navegación Resumido

**Cliente (flujo crítico de reserva en 60 seg):**
`Perfil de Barbería → Servicios → Barbero → Calendario+Horarios → Bottom Sheet Confirmación → Éxito`
→ 5 pantallas + 1 sheet, todas con avance por tap directo (sin formularios largos salvo el OTP inline).

**Barbería (flujo operativo diario):**
`Dashboard → Agenda → Bottom Sheet de cita → acción de estado`
→ el barbero pasa el 90% de su tiempo en Agenda durante el día.

---

*Este documento define la arquitectura UX. El siguiente paso natural es traducir cada pantalla a wireframes de baja fidelidad (Loop 4) antes de entrar a Setup del Proyecto (Loop 5).*
