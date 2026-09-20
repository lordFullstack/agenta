// tests/hours-links.test.ts
import { formatClock, openStatus, weekSchedule, nowInTimezone, BusinessHourRow } from "../src/lib/hours";
import { directionsUrl, isSafeHttpUrl } from "../src/lib/links";

const TZ = "America/Bogota"; // UTC-5 todo el año
// Lunes 21-sep-2026 (los tests fijan la hora; Bogotá = UTC-5).
const at = (isoLocalBogota: string) => new Date(`${isoLocalBogota}-05:00`);

const rows: BusinessHourRow[] = [
  ...["mon", "tue", "wed", "thu", "fri"].map((d) => ({ day_of_week: d, opens_at: "09:00:00", closes_at: "20:00:00" })),
  { day_of_week: "sat", opens_at: "09:00:00", closes_at: "13:00:00" },
  { day_of_week: "sat", opens_at: "15:00:00", closes_at: "19:00:00" },
];

describe("formatClock", () => {
  it.each([
    ["09:00:00", "9:00 a.m."],
    ["09:30", "9:30 a.m."],
    ["12:00:00", "12:00 p.m."],
    ["00:15:00", "12:15 a.m."],
    ["20:00:00", "8:00 p.m."],
  ])("%s → %s", (input, expected) => expect(formatClock(input)).toBe(expected));
});

describe("nowInTimezone", () => {
  it("usa la zona de la barbería, no la del dispositivo", () => {
    // 01:30 UTC del martes = lunes 8:30 p.m. en Bogotá
    expect(nowInTimezone(TZ, new Date("2026-09-22T01:30:00Z"))).toEqual({ day: "mon", minutes: 20 * 60 + 30 });
  });
  it("una zona inválida no rompe el perfil", () => {
    expect(() => nowInTimezone("No/Existe", new Date())).not.toThrow();
  });
});

describe("openStatus", () => {
  it("sin horario cargado no afirma nada", () => {
    expect(openStatus([], TZ)).toBeNull();
  });
  it("abierto: dice a qué hora cierra", () => {
    expect(openStatus(rows, TZ, at("2026-09-21T10:00:00"))).toEqual({ open: true, label: "Abierto ahora · cierra 8:00 p.m." });
  });
  it("antes de abrir: abre hoy", () => {
    expect(openStatus(rows, TZ, at("2026-09-21T07:00:00"))).toEqual({ open: false, label: "Cerrado · abre hoy 9:00 a.m." });
  });
  it("después de cerrar: abre mañana", () => {
    expect(openStatus(rows, TZ, at("2026-09-21T21:00:00"))).toEqual({ open: false, label: "Cerrado · abre mañana 9:00 a.m." });
  });
  it("sábado con dos tramos: en el descanso, abre hoy en el segundo", () => {
    expect(openStatus(rows, TZ, at("2026-09-26T14:00:00"))).toEqual({ open: false, label: "Cerrado · abre hoy 3:00 p.m." });
  });
  it("sábado tarde, domingo cerrado: abre el lunes", () => {
    expect(openStatus(rows, TZ, at("2026-09-26T19:30:00"))).toEqual({ open: false, label: "Cerrado · abre el lunes 9:00 a.m." });
  });
  it("la hora exacta de cierre ya cuenta como cerrado", () => {
    expect(openStatus(rows, TZ, at("2026-09-21T20:00:00"))?.open).toBe(false);
  });
});

describe("weekSchedule", () => {
  it("siempre lunes a domingo; un día sin filas queda vacío (cerrado)", () => {
    const week = weekSchedule(rows);
    expect(week.map((d) => d.label)).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);
    expect(week[5].ranges).toHaveLength(2);
    expect(week[6].ranges).toEqual([]);
  });
});

describe("links", () => {
  it("directionsUrl codifica la dirección", () => {
    expect(directionsUrl("Cra 8 #12-45, Montelíbano")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Cra%208%20%2312-45%2C%20Montel%C3%ADbano"
    );
  });
  it("isSafeHttpUrl solo acepta http(s)", () => {
    expect(isSafeHttpUrl("https://www.instagram.com/x")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});
