// tests/booking.integration.test.ts
//
// Este test corre contra una base de datos Postgres REAL con las migraciones aplicadas
// (no mockea nada) — es el único test que prueba la garantía real de "no doble booking",
// porque esa garantía vive en el motor de Postgres (constraint EXCLUDE), no en JavaScript.
//
// Requiere: DATABASE_URL apuntando a una DB de test con las migraciones 001-012 aplicadas.
// Correr con: DATABASE_URL=postgres://... npx jest booking.integration.test.ts

import { Pool } from "pg";
import { AvailabilityService } from "../src/availability.service";
import { BookingService, SlotNoLongerAvailableError } from "../src/booking.service";
import { seedTestBarbershop, cleanupTestData, TestFixture } from "./helpers/seed";

const config = { minLeadMinutes: 5, maxWindowDays: 60, timezone: "America/Argentina/Buenos_Aires" };

describe("Doble booking bajo concurrencia real", () => {
  let pool: Pool;
  let fixture: TestFixture;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    fixture = await seedTestBarbershop(pool);
  });

  afterAll(async () => {
    await cleanupTestData(pool, fixture);
    await pool.end();
  });

  it("de dos requests simultáneos al MISMO slot, exactamente uno tiene éxito", async () => {
    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const startsAt = new Date(Date.now() + 60 * 60 * 1000); // dentro de 1h, dentro de horario de prueba

    const baseInput = {
      tenantId: fixture.tenantId,
      branchId: fixture.branchId,
      barberId: fixture.staffId,
      serviceIds: [fixture.serviceId],
      startsAt,
      createdBy: fixture.customerUserId,
    };

    // Dos "clientes" distintos, mismo slot exacto, disparados en paralelo real
    const results = await Promise.allSettled([
      booking.createAppointment({ ...baseInput, customerId: fixture.customerAId, idempotencyKey: "req-a" }),
      booking.createAppointment({ ...baseInput, customerId: fixture.customerBId, idempotencyKey: "req-b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotNoLongerAvailableError);

    // Confirma en la base de datos real que solo existe UNA cita activa en ese rango
    const { rows } = await pool.query(
      `SELECT count(*) FROM appointments
       WHERE staff_id = $1 AND starts_at = $2 AND status NOT IN ('cancelled','no_show')`,
      [fixture.staffId, startsAt]
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it("respeta el buffer: una segunda cita a menos del buffer de distancia es rechazada", async () => {
    const availability = new AvailabilityService(pool);
    const booking = new BookingService(pool, availability, config);

    const firstStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const first = await booking.createAppointment({
      tenantId: fixture.tenantId,
      branchId: fixture.branchId,
      barberId: fixture.staffId,
      customerId: fixture.customerAId,
      serviceIds: [fixture.serviceId], // fixture.serviceId dura 30 min, buffer_after de prueba = 10 min
      startsAt: firstStart,
      createdBy: fixture.customerUserId,
      idempotencyKey: "buffer-test-1",
    });

    // Intento de reservar a los 5 min de que termina el servicio (dentro del buffer de 10 min)
    const secondStart = new Date(firstStart.getTime() + 35 * 60 * 1000);

    await expect(
      booking.createAppointment({
        tenantId: fixture.tenantId,
        branchId: fixture.branchId,
        barberId: fixture.staffId,
        customerId: fixture.customerBId,
        serviceIds: [fixture.serviceId],
        startsAt: secondStart,
        createdBy: fixture.customerUserId,
        idempotencyKey: "buffer-test-2",
      })
    ).rejects.toThrow(SlotNoLongerAvailableError);
  });
});
