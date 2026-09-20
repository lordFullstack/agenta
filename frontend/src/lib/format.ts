// frontend/src/lib/format.ts
// Formatos de presentación del lado cliente (es-CO). Deterministas a propósito:
// no dependen de los datos regionales del navegador para los nombres de mes.

const MONTHS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 25000 → "$25.000" */
export function formatCOP(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-CO")}`;
}

/** "2026-09-17T15:00:00Z" → "10:00 a.m." (en la zona del dispositivo) */
export function formatTime(iso: string): string {
  const raw = new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
  return raw.replace(/\s*a\.\s?m\./i, " a.m.").replace(/\s*p\.\s?m\./i, " p.m.").trim();
}

/** Date | ISO → "17 sep. 2026" */
export function formatShortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}. ${d.getFullYear()}`;
}

/** Date → "Septiembre 2026" */
export function formatMonthYear(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date → "2026-09-17" (fecha local, no UTC) */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
