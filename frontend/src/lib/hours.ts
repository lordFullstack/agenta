// frontend/src/lib/hours.ts
// Horario de atención para el perfil público: lista por día y estado "Abierto ahora / Cerrado".
// Todo se calcula en la zona horaria de la BARBERÍA (no la del dispositivo del cliente): quien
// mira el perfil desde otra ciudad debe ver si el local está abierto allá, no acá.

export interface BusinessHourRow {
  day_of_week: string; // "mon" | "tue" | ... | "sun"
  opens_at: string; // "09:00" o "09:00:00"
  closes_at: string;
}

export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const DAY_LABEL: Record<string, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

/** "09:30:00" → 570 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/** "15:30:00" → "3:30 p.m." (mismo estilo que formatTime en format.ts) */
export function formatClock(time: string): string {
  const total = toMinutes(time);
  const h24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
}

export interface DaySchedule {
  day: string;
  label: string;
  ranges: Array<{ opens: string; closes: string }>;
}

/** Lunes a domingo, con los tramos de cada día ordenados. Un día sin filas = cerrado. */
export function weekSchedule(rows: BusinessHourRow[]): DaySchedule[] {
  return DAY_ORDER.map((day) => ({
    day,
    label: DAY_LABEL[day],
    ranges: rows
      .filter((r) => r.day_of_week === day)
      .sort((a, b) => toMinutes(a.opens_at) - toMinutes(b.opens_at))
      .map((r) => ({ opens: r.opens_at, closes: r.closes_at })),
  }));
}

/** Día de la semana y minuto del día ahora mismo, en la zona horaria dada. */
export function nowInTimezone(timezone: string, date: Date = new Date()): { day: string; minutes: number } {
  const read = (tz?: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      ...(tz ? { timeZone: tz } : {}),
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      day: get("weekday").toLowerCase().slice(0, 3),
      minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
    };
  };
  try {
    return read(timezone);
  } catch {
    return read(); // zona inválida: mejor la del dispositivo que romper el perfil
  }
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

/** null si la barbería todavía no cargó su horario (no afirmamos nada). */
export function openStatus(rows: BusinessHourRow[], timezone: string, date: Date = new Date()): OpenStatus | null {
  if (rows.length === 0) return null;
  const { day, minutes } = nowInTimezone(timezone, date);
  const week = weekSchedule(rows);
  const today = week.find((d) => d.day === day);

  const current = today?.ranges.find((r) => minutes >= toMinutes(r.opens) && minutes < toMinutes(r.closes));
  if (current) return { open: true, label: `Abierto ahora · cierra ${formatClock(current.closes)}` };

  const later = today?.ranges.find((r) => toMinutes(r.opens) > minutes);
  if (later) return { open: false, label: `Cerrado · abre hoy ${formatClock(later.opens)}` };

  const startIndex = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]);
  for (let i = 1; i <= 7; i++) {
    const next = week[(startIndex + i) % 7];
    if (next.ranges.length > 0) {
      const when = i === 1 ? "mañana" : `el ${next.label.toLowerCase()}`;
      return { open: false, label: `Cerrado · abre ${when} ${formatClock(next.ranges[0].opens)}` };
    }
  }
  return { open: false, label: "Cerrado" };
}
