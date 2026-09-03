// tests/validation.test.ts
import {
  assertWithinBookingWindow,
  assertMeetsMinimumLeadTime,
  assertValidAvailabilityRequest,
  toLocalDateString,
  ValidationError,
} from "../src/validation";

describe("toLocalDateString", () => {
  it("resuelve la fecha correcta en un timezone distinto a UTC", () => {
    // 2026-09-01T02:00:00Z es 2026-08-31 23:00 en Buenos Aires (UTC-3)
    const date = new Date("2026-09-01T02:00:00Z");
    expect(toLocalDateString(date, "America/Argentina/Buenos_Aires")).toBe("2026-08-31");
    expect(toLocalDateString(date, "UTC")).toBe("2026-09-01");
  });
});

describe("assertWithinBookingWindow", () => {
  const config = { minLeadMinutes: 30, maxWindowDays: 60, timezone: "America/Argentina/Buenos_Aires" };
  const now = new Date("2026-08-26T15:00:00Z"); // ~12:00 en Buenos Aires

  it("acepta una fecha de hoy", () => {
    expect(() => assertWithinBookingWindow("2026-08-26", now, config)).not.toThrow();
  });

  it("rechaza una fecha en el pasado", () => {
    expect(() => assertWithinBookingWindow("2026-08-25", now, config)).toThrow(ValidationError);
  });

  it("acepta una fecha justo en el borde de la ventana máxima", () => {
    expect(() => assertWithinBookingWindow("2026-10-25", now, config)).not.toThrow();
  });

  it("rechaza una fecha más allá de la ventana máxima", () => {
    expect(() => assertWithinBookingWindow("2027-01-01", now, config)).toThrow(ValidationError);
  });

  it("el error de fecha pasada tiene el código correcto para que la API responda bien", () => {
    try {
      assertWithinBookingWindow("2020-01-01", now, config);
      fail("debía lanzar ValidationError");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe("date_in_past");
    }
  });
});

describe("assertMeetsMinimumLeadTime", () => {
  const now = new Date("2026-08-26T15:00:00Z");

  it("rechaza un slot a 10 minutos si el mínimo es 30", () => {
    const slot = new Date(now.getTime() + 10 * 60 * 1000);
    expect(() => assertMeetsMinimumLeadTime(slot, now, 30)).toThrow(ValidationError);
  });

  it("acepta un slot a 31 minutos si el mínimo es 30", () => {
    const slot = new Date(now.getTime() + 31 * 60 * 1000);
    expect(() => assertMeetsMinimumLeadTime(slot, now, 30)).not.toThrow();
  });

  it("caso límite: exactamente el mínimo se acepta (no es estrictamente mayor)", () => {
    const slot = new Date(now.getTime() + 30 * 60 * 1000);
    expect(() => assertMeetsMinimumLeadTime(slot, now, 30)).not.toThrow();
  });
});

describe("assertValidAvailabilityRequest", () => {
  const valid = {
    barberId: "123e4567-e89b-12d3-a456-426614174000",
    branchId: "123e4567-e89b-12d3-a456-426614174001",
    serviceId: "123e4567-e89b-12d3-a456-426614174002",
    date: "2026-09-01",
  };

  it("acepta una request completa y válida", () => {
    expect(() => assertValidAvailabilityRequest(valid)).not.toThrow();
  });

  it("rechaza si falta barberId", () => {
    const { barberId, ...rest } = valid;
    expect(() => assertValidAvailabilityRequest(rest)).toThrow(ValidationError);
  });

  it("rechaza un UUID mal formado", () => {
    expect(() => assertValidAvailabilityRequest({ ...valid, barberId: "no-es-un-uuid" })).toThrow(ValidationError);
  });

  it("rechaza una fecha en formato incorrecto", () => {
    expect(() => assertValidAvailabilityRequest({ ...valid, date: "01/09/2026" })).toThrow(ValidationError);
  });
});
