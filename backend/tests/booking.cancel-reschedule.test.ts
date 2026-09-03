// tests/booking.cancel-reschedule.test.ts
import {
  BookingService,
  CancellationWindowError,
  InvalidStatusTransitionError,
  SlotNoLongerAvailableError,
  ValidationConflict,
} from "../src/booking.service";
import { AvailabilityService } from "../src/availability.service";

function makeMockPool(queryImpl: (sql: string, params: any[]) => Promise<any>) {
  const client = { query: jest.fn(queryImpl), release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client), query: jest.fn(queryImpl) } as any, client };
}

const config = { minLeadMinutes: 30, maxWindowDays: 60, timezone: "America/Argentina/Buenos_Aires" };

describe("BookingService — cancelación", () => {
  it("rechaza cancelar dentro de la ventana mínima (CancellationWindowError)", async () => {
    const appointmentStart = new Date(Date.now() + 60 * 60 * 1000); // en 1h
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT id, starts_at, status, tenant_id FROM appointments")) {
        return { rows: [{ id: "a1", starts_at: appointmentStart, status: "confirmed", tenant_id: "t1" }] };
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    // política: mínimo 120 minutos de anticipación para cancelar, la cita es en 60 min
    await expect(
      booking.cancelAppointment({
      tenantId: "t1",
      appointmentId: "a1", cancelledBy: "u1", minCancellationLeadMinutes: 120 })
    ).rejects.toBeInstanceOf(CancellationWindowError);
  });

  it("permite cancelar fuera de la ventana mínima y registra el motivo", async () => {
    const appointmentStart = new Date(Date.now() + 5 * 60 * 60 * 1000); // en 5h
    let updatedReason: string | null = null;

    const { pool } = makeMockPool(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT id, starts_at, status, tenant_id FROM appointments")) {
        return { rows: [{ id: "a1", starts_at: appointmentStart, status: "confirmed", tenant_id: "t1" }] };
      }
      if (sql.includes("UPDATE appointments") && sql.includes("cancelled")) {
        updatedReason = params[1];
        return { rows: [{ id: "a1", status: "cancelled" }] };
      }
      return { rows: [] };
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const result = await booking.cancelAppointment({
      tenantId: "t1",
      appointmentId: "a1",
      cancelledBy: "u1",
      reason: "El cliente no puede asistir",
      minCancellationLeadMinutes: 120,
    });

    expect(result.status).toBe("cancelled");
    expect(updatedReason).toBe("El cliente no puede asistir");
  });

  it("rechaza cancelar una cita inexistente", async () => {
    const { pool } = makeMockPool(async () => ({ rows: [] }));
    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    await expect(booking.cancelAppointment({
      tenantId: "t1",
      appointmentId: "no-existe", cancelledBy: "u1" })).rejects.toBeInstanceOf(
      ValidationConflict
    );
  });

  it("mapea el rechazo del trigger de máquina de estados (ej. cancelar una cita ya completada) a InvalidStatusTransitionError", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT id, starts_at, status, tenant_id FROM appointments")) {
        return { rows: [{ id: "a1", starts_at: new Date(Date.now() + 10 * 60 * 60 * 1000), status: "completed", tenant_id: "t1" }] };
      }
      if (sql.includes("UPDATE appointments") && sql.includes("cancelled")) {
        const err: any = new Error("Transición de estado inválida: completed -> cancelled");
        err.code = "P0001";
        throw err;
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    await expect(
      booking.cancelAppointment({
      tenantId: "t1",
      appointmentId: "a1", cancelledBy: "u1", minCancellationLeadMinutes: 0 })
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});

describe("BookingService — reprogramación", () => {
  const currentAppointment = {
    id: "a1",
    staff_id: "s1",
    starts_at: new Date("2026-09-01T14:00:00Z"),
    ends_at: new Date("2026-09-01T14:30:00Z"),
    status: "confirmed",
    tenant_id: "t1",
    branch_id: "b1",
    duration_minutes: 30,
  };

  it("reprograma exitosamente y registra el cambio en appointment_reschedules", async () => {
    let rescheduleLogged = false;
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("SELECT a.id, a.staff_id")) return { rows: [currentAppointment] };
      if (sql.includes("SELECT service_id FROM appointment_items")) return { rows: [{ service_id: "sv1" }] };
      if (sql.includes("UPDATE appointments") && sql.includes("starts_at = $2")) {
        return { rows: [{ id: "a1", starts_at: "2026-09-01T16:00:00Z", ends_at: "2026-09-01T16:30:00Z", status: "confirmed", confirmation_code: "AB12CD" }] };
      }
      if (sql.includes("INSERT INTO appointment_reschedules")) {
        rescheduleLogged = true;
        return {};
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const result = await booking.rescheduleAppointment({
      tenantId: "t1",
      appointmentId: "a1",
      newStartsAt: new Date("2026-09-01T16:00:00Z"),
      rescheduledBy: "u1",
      idempotencyKey: "resched-1",
    });

    expect(result.id).toBe("a1"); // mismo id — no se creó una cita nueva
    expect(rescheduleLogged).toBe(true);
  });

  it("rechaza reprogramar una cita 'completed' (fuera de la máquina de estados permitida)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("SELECT a.id, a.staff_id")) {
        return { rows: [{ ...currentAppointment, status: "completed" }] };
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    await expect(
      booking.rescheduleAppointment({
      tenantId: "t1",
      appointmentId: "a1",
        newStartsAt: new Date("2026-09-01T16:00:00Z"),
        rescheduledBy: "u1",
        idempotencyKey: "resched-2",
      })
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("si el nuevo horario choca con otra cita (EXCLUDE), devuelve SlotNoLongerAvailableError con alternativas", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("idempotency_keys")) return { rows: [] };
      if (sql.includes("SELECT a.id, a.staff_id")) return { rows: [currentAppointment] };
      if (sql.includes("SELECT service_id FROM appointment_items")) return { rows: [{ service_id: "sv1" }] };
      if (sql.includes("UPDATE appointments") && sql.includes("starts_at = $2")) {
        const err: any = new Error("conflicting key value violates exclusion constraint");
        err.code = "23P01";
        throw err;
      }
      return {};
    });

    const availability = new AvailabilityService(pool);
    jest.spyOn(availability, "getAvailableSlots").mockResolvedValue([
      { start: new Date("2026-09-01T17:00:00Z"), end: new Date("2026-09-01T17:30:00Z") },
    ]);

    const booking = new BookingService(pool, availability, config);

    await expect(
      booking.rescheduleAppointment({
      tenantId: "t1",
      appointmentId: "a1",
        newStartsAt: new Date("2026-09-01T16:00:00Z"),
        rescheduledBy: "u1",
        idempotencyKey: "resched-3",
      })
    ).rejects.toBeInstanceOf(SlotNoLongerAvailableError);
  });

  it("idempotencia: reintentar la reprogramación con la misma key devuelve el mismo resultado sin volver a mutar", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT appointment_id FROM idempotency_keys")) {
        return { rows: [{ appointment_id: "a1" }] };
      }
      if (sql.includes("SELECT id, starts_at, ends_at, status, confirmation_code FROM appointments")) {
        return { rows: [{ id: "a1", starts_at: "2026-09-01T16:00:00Z", status: "confirmed" }] };
      }
      return { rows: [] };
    });

    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const result = await booking.rescheduleAppointment({
      tenantId: "t1",
      appointmentId: "a1",
      newStartsAt: new Date("2026-09-01T16:00:00Z"),
      rescheduledBy: "u1",
      idempotencyKey: "already-processed-key",
    });

    expect(result.id).toBe("a1");
  });
});
