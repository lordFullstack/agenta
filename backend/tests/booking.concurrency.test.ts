// tests/booking.concurrency.test.ts
//
// Estos tests mockean el cliente de Postgres para validar que la capa de servicio
// mapea correctamente el error 23P01 (exclusion_violation) a un conflicto de negocio.
// La garantía real de "no doble booking" la da el constraint EXCLUDE de la migración 011 —
// eso se valida en tests/booking.integration.test.ts contra una base de datos real.

import { BookingService, SlotNoLongerAvailableError, ValidationConflict } from "../src/booking.service";
import { AvailabilityService } from "../src/availability.service";

function makeMockPool(queryImpl: (sql: string, params: any[]) => Promise<any>) {
  const client = {
    query: jest.fn(queryImpl),
    release: jest.fn(),
  };
  return {
    pool: {
      connect: jest.fn().mockResolvedValue(client),
      query: jest.fn(queryImpl), // usado por findByIdempotencyKey (fuera de la transacción)
    } as any,
    client,
  };
}

const config = { minLeadMinutes: 30, maxWindowDays: 60, timezone: "America/Argentina/Buenos_Aires" };

const baseInput = {
  tenantId: "t1",
  branchId: "b1",
  barberId: "s1",
  customerId: "c1",
  serviceIds: ["sv1"],
  startsAt: new Date("2026-09-01T14:00:00Z"),
  createdBy: "u1",
  idempotencyKey: "key-abc",
};

describe("BookingService — manejo de conflicto de concurrencia", () => {
  it("mapea el error 23P01 (exclusion_violation) a SlotNoLongerAvailableError con alternativas", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: 45 }] };
      if (sql.includes("SUM(COALESCE(ss.price_override")) return { rows: [{ total: "2500" }] };
      if (sql.includes("INSERT INTO appointments")) {
        const err: any = new Error("conflicting key value violates exclusion constraint");
        err.code = "23P01";
        throw err;
      }
      if (sql.includes("BEGIN") || sql.includes("ROLLBACK") || sql.includes("COMMIT")) return {};
      return { rows: [] };
    });

    const availability = new AvailabilityService(pool);
    jest.spyOn(availability, "getAvailableSlots").mockResolvedValue([
      { start: new Date("2026-09-01T15:00:00Z"), end: new Date("2026-09-01T15:45:00Z") },
    ]);

    const booking = new BookingService(pool, availability, config);

    await expect(booking.createAppointment(baseInput)).rejects.toThrow(SlotNoLongerAvailableError);

    try {
      await booking.createAppointment(baseInput);
    } catch (err) {
      expect(err).toBeInstanceOf(SlotNoLongerAvailableError);
      expect((err as SlotNoLongerAvailableError).alternatives.length).toBeGreaterThan(0);
    }
  });

  it("hace ROLLBACK cuando el insert falla, antes de propagar el error", async () => {
    const calls: string[] = [];
    const { pool } = makeMockPool(async (sql: string) => {
      calls.push(sql.trim().split("\n")[0]);
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: 45 }] };
      if (sql.includes("SUM(COALESCE(ss.price_override")) return { rows: [{ total: "2500" }] };
      if (sql.includes("INSERT INTO appointments")) {
        const err: any = new Error("exclusion violation");
        err.code = "23P01";
        throw err;
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    jest.spyOn(availability, "getAvailableSlots").mockResolvedValue([]);
    const booking = new BookingService(pool, availability, config);

    await expect(booking.createAppointment(baseInput)).rejects.toThrow();
    expect(calls.some((c) => c.includes("ROLLBACK"))).toBe(true);
  });

  it("devuelve ValidationConflict si el barbero no ofrece el servicio (resolve_appointment_duration = NULL)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: null }] };
      return {};
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    await expect(booking.createAppointment(baseInput)).rejects.toThrow(ValidationConflict);
  });

  it("idempotencia: si la key ya existe, devuelve la cita existente sin volver a insertar", async () => {
    const insertSpy = jest.fn();
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT appointment_id FROM idempotency_keys")) {
        return { rows: [{ appointment_id: "appt-existente" }] };
      }
      if (sql.includes("SELECT id, starts_at, ends_at, status")) {
        return { rows: [{ id: "appt-existente", status: "pending" }] };
      }
      if (sql.includes("INSERT INTO appointments")) insertSpy();
      return { rows: [] };
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const result = await booking.createAppointment(baseInput);
    expect(result.id).toBe("appt-existente");
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
