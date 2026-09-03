const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync(__dirname + "/booking-flow.html", "utf8");

async function run() {
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true });
  const { window } = dom;

  // esperar a que el script inline corra (showScreen('home') al final del IIFE) —
  // en el sandbox de testing, la CDN de Tailwind/Google Fonts está bloqueada por red,
  // lo cual retrasa la cola de recursos de jsdom antes de ejecutar el script propio.
  // En producción esto no ocurre (la CDN carga normalmente), pero el test necesita margen.
  await new Promise((r) => setTimeout(r, 400));
  const doc = window.document;

  function assert(cond, label) {
    console.log((cond ? "✓ " : "✗ FALLÓ: ") + label);
    if (!cond) process.exitCode = 1;
  }

  // 1. Pantalla inicial es Home
  assert(doc.querySelector('[data-screen="home"]').classList.contains("screen-active"), "Home está activa al cargar");
  assert(!doc.querySelector('[data-screen="buscar"]').classList.contains("screen-active"), "Buscar NO está activa al cargar");

  // 2. Navegar Home -> Buscar
  doc.querySelector('[data-nav="buscar"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.querySelector('[data-screen="buscar"]').classList.contains("screen-active"), "Navega a Buscar tras click en botón Home->Buscar");
  assert(doc.querySelector('[data-nav="buscar"][data-tab]').getAttribute("aria-current") === "page", "El tab de Buscar queda marcado aria-current=page");
  assert(doc.querySelector('[data-nav="home"][data-tab]').getAttribute("aria-current") === null, "El tab de Home pierde aria-current");

  // 3. Flujo completo: Barbería -> Servicios -> Barberos -> Calendario
  doc.querySelector('[data-nav="barberia"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.querySelector('[data-screen="barberia"]').classList.contains("screen-active"), "Navega a Barbería");

  const reservarBtn = doc.querySelector('[data-screen="barberia"] [data-nav="servicios"]');
  reservarBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.querySelector('[data-screen="servicios"]').classList.contains("screen-active"), "Navega a Servicios");

  // 4. Selección de servicios: el CTA arranca deshabilitado y se habilita al elegir uno
  const continueBtn = doc.getElementById("services-continue");
  assert(continueBtn.disabled === true, "CTA de Servicios arranca deshabilitado sin selección");

  const firstCheckbox = doc.querySelector(".service-checkbox");
  firstCheckbox.checked = true;
  firstCheckbox.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(continueBtn.disabled === false, "CTA de Servicios se habilita al elegir un servicio");
  assert(doc.getElementById("services-summary").textContent.includes("$2500"), "El resumen sticky muestra el precio correcto");

  // 5. Bottom sheet de confirmación: abre, tiene foco atrapable y cierra con Escape
  doc.getElementById("main-content"); // noop, asegura contexto
  const slotWithSheet = doc.querySelector('[data-open-sheet="confirmacion"]');
  slotWithSheet.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const sheet = doc.getElementById("sheet-confirmacion");
  assert(sheet.hidden === false, "El bottom sheet de confirmación se abre al tocar un slot");
  assert(doc.activeElement && sheet.contains(doc.activeElement), "El foco se mueve dentro del sheet al abrirlo (accesibilidad)");

  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(sheet.hidden === true, "Escape cierra el bottom sheet");

  // 6. Confirmar reserva -> loading -> pantalla de éxito
  slotWithSheet.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const confirmBtn = doc.getElementById("confirm-submit");
  confirmBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.getElementById("confirm-submit-label").textContent === "Confirmando…", "Muestra estado 'Confirmando…' al tocar Confirmar reserva");
  assert(confirmBtn.disabled === true, "El botón de confirmar se deshabilita durante el envío (evita doble-tap)");

  await new Promise((r) => setTimeout(r, 1000));
  assert(doc.querySelector('[data-screen="exito"]').classList.contains("screen-active"), "Tras confirmar, se muestra la pantalla de Reserva exitosa");

  // 7. Estados demo de Búsqueda: loading / empty / error / success
  doc.querySelector('[data-nav="home"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  doc.querySelector('[data-nav="buscar"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  doc.querySelector('[data-demo="buscar:loading"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.querySelectorAll("#buscar-results .skeleton").length > 0, "Estado 'loading' de Búsqueda muestra skeletons");

  doc.querySelector('[data-demo="buscar:empty"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.getElementById("buscar-results").textContent.includes("No encontramos barberías"), "Estado 'empty' de Búsqueda muestra mensaje correcto");

  doc.querySelector('[data-demo="buscar:error"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.getElementById("buscar-results").textContent.includes("No pudimos cargar"), "Estado 'error' de Búsqueda muestra mensaje correcto");

  // 8. Cancelación: abre sheet, elige motivo, confirma, vuelve a Mis Citas
  doc.querySelector('[data-jump="detalle-cita"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  doc.querySelector('[data-open-sheet="cancelar"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.getElementById("sheet-cancelar").hidden === false, "El sheet de cancelación se abre desde Detalle de cita");

  doc.getElementById("cancel-confirm-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert(doc.querySelector('[data-screen="mis-citas"]').classList.contains("screen-active"), "Tras confirmar la cancelación, vuelve a Mis Citas");

  // 9. Accesibilidad: todos los botones solo-ícono (sin texto visible) tienen aria-label
  const iconOnlyButtons = Array.from(doc.querySelectorAll("button")).filter((b) => {
    const hasSvg = !!b.querySelector("svg");
    const textContent = b.textContent.replace(/\s+/g, "").trim();
    return hasSvg && textContent.length === 0;
  });
  const allHaveLabel = iconOnlyButtons.every((b) => b.hasAttribute("aria-label"));
  assert(allHaveLabel, `Todos los botones solo-ícono (${iconOnlyButtons.length}) tienen aria-label`);

  console.log("\n" + (process.exitCode === 1 ? "❌ Hay tests fallidos" : "✅ Todos los tests de humo pasaron"));
}

run();
