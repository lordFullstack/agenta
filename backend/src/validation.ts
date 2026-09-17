// src/validation.ts
// Funciones puras — sin I/O — para que sean 100% unit-testeables sin mockear la base de datos.

export interface BookingWindowConfig {
  minLeadMinutes: number;
  maxWindowDays: number;
  timezone: string;
}

export class ValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Convierte un Date a la fecha calendario (YYYY-MM-DD) tal como se ve en un timezone dado.
 * Evita el error clásico de usar Date.toISOString() (siempre UTC) para decidir "hoy".
 */
export function toLocalDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA produce YYYY-MM-DD directamente
}

/**
 * Valida que la fecha pedida esté dentro de la ventana de reserva permitida
 * (no en el pasado, no más allá de maxWindowDays), resuelta en el timezone del tenant.
 */
export function assertWithinBookingWindow(
  requestedDate: string, // YYYY-MM-DD
  now: Date,
  config: BookingWindowConfig
): void {
  const todayLocal = toLocalDateString(now, config.timezone);
  const maxDate = new Date(now.getTime() + config.maxWindowDays * 24 * 60 * 60 * 1000);
  const maxLocal = toLocalDateString(maxDate, config.timezone);

  if (requestedDate < todayLocal) {
    throw new ValidationError("date_in_past", "No se puede reservar en una fecha pasada.");
  }
  if (requestedDate > maxLocal) {
    throw new ValidationError(
      "date_beyond_max_window",
      `No se puede reservar más allá de ${config.maxWindowDays} días de anticipación.`
    );
  }
}

/**
 * Valida que el horario elegido respete la anticipación mínima configurada.
 */
export function assertMeetsMinimumLeadTime(
  slotStart: Date,
  now: Date,
  minLeadMinutes: number
): void {
  const earliestAllowed = new Date(now.getTime() + minLeadMinutes * 60 * 1000);
  if (slotStart < earliestAllowed) {
    throw new ValidationError(
      "lead_time_too_short",
      `Este horario requiere reservarse con al menos ${minLeadMinutes} minutos de anticipación.`
    );
  }
}

/**
 * Valida el shape básico de la request de disponibilidad antes de tocar la base de datos.
 */
export function assertValidAvailabilityRequest(params: {
  barberId?: string;
  branchId?: string;
  serviceId?: string;
  date?: string;
}): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (const field of ["barberId", "branchId", "serviceId"] as const) {
    const value = params[field];
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError("invalid_param", `${field} inválido o ausente.`);
    }
  }
  if (!params.date || !dateRegex.test(params.date)) {
    throw new ValidationError("invalid_param", "date debe tener formato YYYY-MM-DD.");
  }
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}
