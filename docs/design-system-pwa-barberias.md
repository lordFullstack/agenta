# Design System — PWA Barbería
### Premium · Masculino sin cliché · Moderno · Rápido · Elegante · Táctil

---

## 0. Dirección Creativa (antes de los tokens)

**Referencia conceptual:** no la barbería de cliché (rojo/blanco/azul de poste, maderas oscuras, tipografía vintage), sino el instrumental del oficio bien hecho: el filo de una navaja, el metal cepillado de una tijera, el cuero curtido de un sillón, el peso de un clipper en la mano. Premium = precisión de materiales, no decoración.

**Paleta (6 tokens con nombre):**

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#14161A` | Superficie oscura base, texto sobre bone |
| `bone` | `#EDE9E2` | Superficie clara base, papel cálido (no blanco puro) |
| `steel` | `#5B6169` | Neutro medio — texto secundario, bordes, iconografía |
| `brass` | `#A9843C` | Acento primario — el "filo" de la marca. CTAs, focus, selección |
| `ember` | `#B5502E` | Error / destructivo — terroso, no rojo semáforo |
| `moss` | `#5C7A5E` | Éxito / confirmado — verde apagado, no verde sistema |

`brass` es el elemento de firma: aparece en el CTA principal, el indicador de nav activo, el borde de foco, y la línea divisoria fina que actúa como "corte" entre secciones — nunca como relleno masivo.

**Tipografía (3 roles):**

| Rol | Fuente | Motivo |
|---|---|---|
| Display | **Bricolage Grotesque** | Grotesco con carácter, no genérico — títulos, precios grandes, hero |
| Body/UI | **Inter** | Máxima legibilidad en pantallas chicas y tamaños de texto pequeños |
| Utility/Data | **JetBrains Mono** | Horarios, duraciones, precios, códigos OTP — precisión "técnica" táctil |

**Signature element:** el **"brass tick"** — una línea fina de 1px en `brass` con un pequeño punto circular en un extremo, usada como divisor de sección, indicador de tab activo, y marca de progreso. Evoca la guía de un clipper. Se usa con moderación — es el único elemento decorativo recurrente del sistema.

---

## 1. Typography

```js
// tailwind.config.js (extracto)
fontFamily: {
  display: ['"Bricolage Grotesque"', 'sans-serif'],
  body: ['"Inter"', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'monospace'],
}
```

| Estilo | Clase Tailwind | Uso |
|---|---|---|
| Display XL | `font-display text-4xl md:text-6xl font-semibold tracking-tight` | Hero, nombre de barbería en perfil |
| Display L | `font-display text-2xl md:text-4xl font-semibold tracking-tight` | Títulos de pantalla |
| Display M | `font-display text-xl font-medium` | Títulos de card / sección |
| Body L | `font-body text-base leading-relaxed` | Texto principal |
| Body M | `font-body text-sm leading-relaxed text-steel` | Texto secundario |
| Caption | `font-body text-xs uppercase tracking-wide text-steel` | Labels, eyebrows |
| Data | `font-mono text-sm tabular-nums` | Precios, horarios, duración, OTP |

**Regla mobile-first:** en 320–390px el Display XL baja a `text-3xl`; nunca reducir el Body por debajo de `text-sm` (14px) — esto es una PWA táctil, no una app de datos densos.

---

## 2. Color System

```js
colors: {
  ink:   { DEFAULT: '#14161A', 80: '#14161ACC', 60: '#14161A99' },
  bone:  { DEFAULT: '#EDE9E2', 90: '#E4DFD5' },
  steel: { DEFAULT: '#5B6169', 40: '#5B616966' },
  brass: { DEFAULT: '#A9843C', light: '#C9A15E', dark: '#8A6B2E' },
  ember: { DEFAULT: '#B5502E', light: '#D97757' /* solo interno, no exponer como acento primario */ },
  moss:  { DEFAULT: '#5C7A5E', light: '#7A9A7C' },
}
```

**Modo por defecto:** dark-first (`bg-ink text-bone`) — refuerza "premium/nocturno de barbería moderna". Superficies claras (`bone`) se usan en cards y sheets sobre el fondo oscuro para dar jerarquía, no como tema alternativo obligatorio.

**Contraste:** todo texto `body` sobre `ink` usa `bone` o `bone/70`; nunca `steel` puro como texto de lectura larga (falla contraste en pantallas con luz solar directa — uso real de una barbería con vidriera).

---

## 3. Spacing

Base 4px (Tailwind default) + escala extendida para thumb zone:

```js
spacing: {
  '18': '4.5rem',  // 72px — altura de bottom nav
  '22': '5.5rem',  // 88px — zona de CTA sticky + safe area
  'safe': 'env(safe-area-inset-bottom)',
}
```

**Reglas:**
- Padding horizontal de pantalla: `px-4` en 320–375px, `px-5` en 390–430px, `px-6` en ≥768px.
- Todo CTA principal fijo inferior lleva `pb-[calc(1rem+env(safe-area-inset-bottom))]` para respetar notch/home indicator.
- Separación entre bloques de contenido: `space-y-6` mobile, `space-y-8` desktop.

---

## 4. Border Radius

```js
borderRadius: {
  razor: '2px',    // elementos de precisión: badges pequeños, inputs de OTP
  DEFAULT: '12px', // botones, inputs
  card: '16px',    // cards
  sheet: '24px',   // bottom sheets (solo esquinas superiores)
  pill: '999px',   // chips, avatars, botón FAB
}
```

Nada usa `rounded-none` (rompe la sensación táctil/suave) ni `rounded-full` en botones grandes (se reserva para FAB y avatares — mantiene el `pill` como acento, no default).

---

## 5. Shadows

Sombras **tintadas en ink**, nunca negro puro — da sensación de profundidad cálida, no de UI genérica:

```js
boxShadow: {
  sm: '0 1px 2px 0 rgba(20,22,26,0.08)',
  card: '0 4px 16px -4px rgba(20,22,26,0.18)',
  float: '0 8px 24px -6px rgba(20,22,26,0.28)',
  brass: '0 0 0 3px rgba(169,132,60,0.35)', // focus ring / selección activa
}
```

Uso: `shadow-card` en cards en reposo, `shadow-float` en bottom sheets y FAB, `shadow-brass` como focus-visible en vez del outline azul default del navegador.

---

## 6. Glassmorphism

Reservado para **superficies flotantes sobre contenido** (bottom nav, header sticky al hacer scroll, bottom sheet de confirmación) — no para cards de contenido base (ahí compite con la legibilidad).

```html
<div class="bg-ink/70 backdrop-blur-xl border-t border-brass/20">
  <!-- bottom nav -->
</div>
```

```css
.glass-panel {
  background: rgba(20, 22, 26, 0.72);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(169, 132, 60, 0.15);
}
```

Regla: el borde siempre es `brass` a baja opacidad (10–20%), nunca blanco — es lo que evita que el glassmorphism se sienta genérico/iOS-default.

---

## 7. Cards

Tres variantes, misma base:

```html
<!-- Base -->
<div class="bg-bone text-ink rounded-card shadow-card p-4">

<!-- Barber Card (perfil de barbero en selección) -->
<div class="bg-bone rounded-card shadow-card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">

<!-- Appointment Card (Mis Citas / Agenda) -->
<div class="bg-bone rounded-card shadow-card p-4 border-l-4 border-brass"> <!-- borde izq = color de estado -->
```

**Estados de borde izquierdo (appointment card):** `border-brass` confirmada · `border-moss` en curso/completada · `border-steel` cancelada · `border-ember` no-show.

**Interacción táctil:** toda card clickeable lleva `active:scale-[0.98] transition-transform duration-150` — feedback físico inmediato al tap, sin depender de hover (mobile-first real).

---

## 8. Buttons

```html
<!-- Primary -->
<button class="bg-brass text-ink font-body font-semibold rounded-full px-6 py-3.5
  active:scale-95 active:bg-brass-dark transition-all duration-150
  shadow-card disabled:opacity-40 disabled:pointer-events-none">

<!-- Secondary (outline) -->
<button class="border border-steel/40 text-bone rounded-full px-6 py-3.5
  active:scale-95 active:bg-steel/10 transition-all duration-150">

<!-- Ghost -->
<button class="text-brass font-medium active:opacity-60 transition-opacity">

<!-- Destructive -->
<button class="bg-ember/10 text-ember border border-ember/30 rounded-full px-6 py-3.5 active:scale-95">
```

**Tamaños:** `sm` (py-2 text-sm, acciones dentro de sheets), `md` (py-3.5 text-base, CTA estándar), `lg` (py-4 text-lg, CTA único de pantalla, "Reservar cita" / "Confirmar reserva").

**Estado loading:** el label se reemplaza por un spinner de 3 puntos en `brass` pulsando (no gira — pulsa, se siente más "premium/mecánico" que un spinner genérico), el botón mantiene su ancho (`min-w`) para evitar salto de layout.

---

## 9. Inputs

```html
<div class="relative">
  <input class="w-full bg-transparent border-b-2 border-steel/30 focus:border-brass
    text-bone font-body text-base py-3 outline-none transition-colors placeholder:text-steel/60"
    placeholder="Tu número de teléfono" />
</div>
```

- **Estilo:** underline, no box — se siente más ligero/táctil en mobile y reduce ruido visual.
- **Focus:** `border-brass` + label flotante sube y se tiñe `text-brass text-xs`.
- **OTP input:** 6 celdas individuales `w-11 h-13 rounded-razor bg-bone/5 border border-steel/30 text-center font-mono text-xl`, celda activa `border-brass shadow-brass`.
- **Error:** `border-ember`, mensaje `text-ember text-xs mt-1.5` con ícono, tono directo ("Ingresá un número válido", nunca "Oops, algo salió mal").

---

## 10. Badges

```html
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium">
```

| Estado | Clases de color |
|---|---|
| Confirmada | `bg-brass/15 text-brass` |
| En curso | `bg-moss/15 text-moss` + punto pulsante |
| Completada | `bg-steel/15 text-steel` |
| Cancelada | `bg-steel/10 text-steel/70 line-through` |
| No-show | `bg-ember/15 text-ember` |

El punto pulsante de "en curso" (`animate-pulse` en un `w-1.5 h-1.5 rounded-full bg-moss`) es la única badge con microinteracción — refuerza que algo está sucediendo *ahora*.

---

## 11. Bottom Sheets

```html
<div class="fixed inset-x-0 bottom-0 z-50 bg-bone rounded-t-sheet shadow-float
  max-h-[85vh] overflow-y-auto pb-safe">
  <div class="w-9 h-1 bg-steel/30 rounded-pill mx-auto mt-3 mb-4"></div> <!-- drag handle -->
  <div class="px-5 pb-6">
    <!-- contenido -->
  </div>
</div>
<div class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-40"></div> <!-- overlay -->
```

**Comportamiento:** entra con spring (`translateY` 100%→0, ease `cubic-bezier(0.32,0.72,0,1)`, ~320ms), draggable por el handle, cierra con swipe-down >120px o tap en overlay. Nunca supera `85vh` — siempre deja ver contexto de la pantalla detrás.

**Variante glass** (usada sobre contenido con imagen de fondo, ej. detalle de barbero): `bg-ink/80 backdrop-blur-xl` en vez de `bg-bone`.

---

## 12. Navigation

**Bottom Nav (mobile, <768px):**

```html
<nav class="fixed bottom-0 inset-x-0 h-18 glass-panel flex items-center justify-around pb-safe z-50">
  <button class="flex flex-col items-center gap-1">
    <!-- ícono 24px, activo: text-brass, inactivo: text-steel -->
    <span class="w-1 h-1 rounded-full bg-brass"></span> <!-- brass tick indicador activo -->
    <span class="text-[10px] font-medium">Inicio</span>
  </button>
</nav>
```

El indicador de tab activo **no** es un fondo relleno ni un ícono agrandado — es el "brass tick" (punto de 4px) sobre el ícono. Consistente con el signature element.

**Desktop (≥1024px):** el bottom nav se transforma en **rail lateral izquierdo fijo** (`w-20 lg:w-64` con labels visibles en ≥1280px), no en un top nav — mantiene la lógica de navegación persistente sin imitar patrones de escritorio genéricos.

---

## 13. Calendar

Selector horizontal de días (scroll snap), no un calendario en grilla mensual — prioriza velocidad sobre exploración:

```html
<div class="flex gap-2 overflow-x-auto snap-x px-4 scrollbar-hide">
  <button class="snap-start flex-shrink-0 w-14 h-18 rounded-card flex flex-col items-center justify-center
    bg-bone/5 border border-steel/20
    aria-selected:bg-brass aria-selected:text-ink aria-selected:border-brass
    disabled:opacity-30 disabled:line-through">
    <span class="text-xs font-mono uppercase">Lun</span>
    <span class="text-lg font-display font-semibold">24</span>
  </button>
</div>
```

Días sin disponibilidad: `disabled` con opacidad reducida (no se ocultan — mantener el ritmo visual del calendario). Día seleccionado: fondo `brass` sólido, único lugar donde `brass` se usa como fill grande (justifica su jerarquía de "decisión tomada").

---

## 14. Time Slots

Grid de 3 columnas en mobile, 4–5 en tablet/desktop:

```html
<div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
  <button class="py-3 rounded font-mono text-sm tabular-nums border border-steel/25 text-bone
    aria-selected:bg-brass aria-selected:text-ink aria-selected:border-brass aria-selected:shadow-brass
    disabled:opacity-25 disabled:border-steel/10 disabled:pointer-events-none">
    15:30
  </button>
</div>
```

Fuente `mono` en los horarios — es deliberado: da precisión "de instrumento" y alinea los dígitos perfectamente en grilla, reforzando la sensación técnica/táctil pedida en el brief.

---

## 15. Avatar System

```html
<!-- Base -->
<img class="w-11 h-11 rounded-pill object-cover ring-2 ring-bone/10" />

<!-- Con estado de disponibilidad (barbero) -->
<div class="relative">
  <img class="w-14 h-14 rounded-pill object-cover" />
  <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-pill border-2 border-ink
    bg-moss"></span> <!-- disponible hoy -->
</div>

<!-- Grupo (equipo de barberos, overview) -->
<div class="flex -space-x-3">
  <img class="w-9 h-9 rounded-pill ring-2 ring-ink object-cover" />
</div>
```

Tamaños: `w-8` (lista/grupo) · `w-11` (card estándar) · `w-14` (selección de barbero) · `w-20` (perfil individual del barbero). Anillo de disponibilidad: `moss` disponible hoy, `steel` sin turnos próximos, sin anillo = información no cargada (no usar `ember` acá, no es un estado de error).

---

## 16. Skeleton Loaders

Shimmer sutil, no genérico gris-sobre-gris — usa el tono `steel` a baja opacidad sobre `ink`, con barrido de brillo en diagonal:

```css
.skeleton {
  background: linear-gradient(100deg, rgba(91,97,105,0.08) 30%, rgba(91,97,105,0.18) 45%, rgba(91,97,105,0.08) 60%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
@keyframes shimmer { 0% { background-position: 150% 0; } 100% { background-position: -50% 0; } }
```

Los skeletons **replican el layout exacto** de la pantalla final (mismo `rounded`, mismas proporciones de card/avatar/texto) — nunca bloques genéricos rectangulares.

---

## 17. Empty States

Estructura fija: ícono/ilustración lineal simple en `steel` (nunca ilustración a color, para no romper la paleta) + título directo + CTA de acción.

```html
<div class="flex flex-col items-center text-center py-16 px-6">
  <div class="w-16 h-16 rounded-pill bg-steel/10 flex items-center justify-center mb-4"><!-- icon --></div>
  <p class="font-display text-lg mb-1">No tenés citas próximas</p>
  <p class="text-steel text-sm mb-6">Reservá tu próximo turno en menos de un minuto.</p>
  <button class="bg-brass text-ink rounded-full px-6 py-3 font-semibold">Buscar barbería</button>
</div>
```

**Copy:** en voz activa, sin disculpas, describiendo qué puede hacer la persona ahora — nunca "Parece que no hay nada por aquí 😅".

---

## 18. Error States

Mismo layout que empty, pero ícono en `ember/60` y el mensaje explica **qué pasó** y **qué hacer**, sin jerga técnica:

```html
<div class="flex flex-col items-center text-center py-16 px-6">
  <div class="w-16 h-16 rounded-pill bg-ember/10 flex items-center justify-center mb-4"><!-- icon warning --></div>
  <p class="font-display text-lg mb-1">No pudimos cargar esta pantalla</p>
  <p class="text-steel text-sm mb-6">Revisá tu conexión e intentá de nuevo.</p>
  <button class="border border-steel/40 text-bone rounded-full px-6 py-3">Reintentar</button>
</div>
```

**Errores inline** (formularios, slot ocupado): no usan este layout de pantalla completa — son un mensaje corto en `text-ember text-xs` pegado al elemento que falló, para no interrumpir el flujo de reserva de 60 segundos.

---

## 19. Success States

Dos niveles:
- **Micro-success** (guardar cambio, actualizar perfil): toast flotante inferior, `bg-moss text-bone`, aparece 2.5s con slide-up + fade, ícono de check.
- **Macro-success** (reserva confirmada — el hito principal del producto): pantalla completa con animación de check dibujándose (`stroke-dashoffset` de 0 a 100 en ~500ms, easing `ease-out`) en `brass`, seguido de resumen de la cita y CTA `Agregar al calendario` / `Volver al inicio`.

El check de macro-success usa `brass`, no `moss` — es deliberado: refuerza que ese color es el de "decisión/acción completada por la marca", reservando `moss` para estados operativos del día a día (barbería).

---

## 20. Microinteractions

| Elemento | Interacción | Timing/Easing |
|---|---|---|
| Botones | `active:scale-95` | 150ms ease-out |
| Cards tap-eables | `active:scale-[0.98]` | 150ms ease-out |
| Bottom sheet entrada | translateY spring | 320ms `cubic-bezier(0.32,0.72,0,1)` |
| Selección de time slot | fill de brass + leve "bounce" (`scale 1→1.05→1`) | 200ms |
| Tab nav activo | brass tick fade-in | 150ms |
| Skeleton → contenido real | crossfade, nunca corte abrupto | 200ms |
| Pull to refresh | ícono de navaja/clipper simplificado rotando 15° | ligado al gesto, no a un timer |
| Check de éxito | stroke-dashoffset draw | 500ms ease-out |

**Regla general:** ninguna animación supera 400ms salvo el check de éxito (único momento "de celebración" permitido). Todo lo demás prioriza sensación de velocidad — coherente con el objetivo de reserva en 60 segundos.

---

## Breakpoints y comportamiento responsive

```js
screens: {
  'xs': '375px',
  'xs2': '390px',
  'xsl': '430px',
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
}
```

| Rango | Comportamiento clave |
|---|---|
| **320px** (piso mínimo) | 1 columna estricta, `px-4`, time slots en 3 columnas, bottom nav sin labels si no entra el texto (solo íconos + brass tick) |
| **375–390px** | Estándar de diseño base — todos los ejemplos de este documento están calibrados acá |
| **430px** | Time slots pasan a 4 columnas, cards ganan `p-5` en vez de `p-4` |
| **768px (tablet)** | Bottom nav se mantiene (uso táctil sigue siendo primario), pero layouts pasan a 2 columnas en listados (búsqueda, servicios), bottom sheets se limitan a `max-w-md` centrado en vez de full-width |
| **1024px+ (desktop)** | Bottom nav → rail lateral fijo; bento grids (Dashboard) pasan de stack vertical a grilla real 2–3 columnas; contenido con `max-w-6xl mx-auto`; bottom sheets se comportan como modales centrados, no como paneles desde abajo |

---

*Este Design System es la base visual para Loop 5 (Setup del Proyecto) y Loop 6 (Desarrollo por Módulos). Todos los componentes de código de acá en adelante deben derivar sus clases de estos tokens — no introducir colores, radios o sombras fuera de esta paleta.*
