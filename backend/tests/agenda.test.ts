// tests/agenda.test.ts
import {
  AgendaService,
  OwnAppointmentsOnlyError,
  TenantMismatchError,
  InvalidStatusTransitionError,
  SlotConflictError,
} from "../src/agenda.service";

function makeMockPool(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
  const client = { query: jest.fn(queryImpl), release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client), query: jest.fn(queryImpl) } as any, client };
}

const TENANT = "tenant-1";
const BRANCH = "branch-1";

describe("AgendaService — getAgenda (DEC-022: barber solo ve lo suyo)", () => {
  it("un owner sin filtro de staff ve TODAS las citas del día (no fuerza ningún staff_id)", async () => {
    const paramsSeen: any[][] = [];
    const { pool } = makeMockPool(async (sql: string, params?: any[]) => {
      if (sql.includes("FROM appointments")) {
        paramsSeen.push(params ?? []);
        return { rows: [{ id: "a1" }, { id: "a2" }] };
      }
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.getAgenda({
      tenantId: TENANT,
      branchId: BRANCH,
      date: "2026-09-05",
      callerRole: "owner",
    });

    expect(result).toHaveLength(2);
    expect(paramsSeen[0]).toEqual([TENANT, BRANCH, "2026-09-05"]); // sin filtro de staff_id
  });

  it("un owner CON filtro de staff sí lo honra", async () => {
    const paramsSeen: any[][] = [];
    const { pool } = makeMockPool(async (sql: string, params?: any[]) => {
      if (sql.includes("FROM appointments")) {
        paramsSeen.push(params ?? []);
        return { rows: [] };
      }
      return {};
    });
    const service = new AgendaService(pool);

    await service.getAgenda({
      tenantId: TENANT,
      branchId: BRANCH,
      date: "2026-09-05",
      callerRole: "owner",
      requestedStaffId: "staff-5",
    });

    expect(paramsSeen[0]).toEqual([TENANT, BRANCH, "2026-09-05", "staff-5"]);
  });

  it("un barber SIEMPRE queda forzado a su propio staffId, aunque pida ver a otro", async () => {
    const paramsSeen: any[][] = [];
    const { pool } = makeMockPool(async (sql: string, params?: any[]) => {
      if (sql.includes("FROM appointments")) {
        paramsSeen.push(params ?? []);
        return { rows: [] };
      }
      return {};
    });
    const service = new AgendaService(pool);

    await service.getAgenda({
      tenantId: TENANT,
      branchId: BRANCH,
      date: "2026-09-05",
      callerRole: "barber",
      callerStaffId: "staff-yo",
      requestedStaffId: "staff-otro", // intento de ver la agenda de otro barbero
    });

    // el filtro real que se aplicó es staff-yo, NUNCA staff-otro
    expect(paramsSeen[0]).toEqual([TENANT, BRANCH, "2026-09-05", "staff-yo"]);
  });
});

describe("AgendaService — updateAppointmentStatus", () => {
  it("un barber puede actualizar SU PROPIA cita", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM appointments")) return { rows: [{ staff_id: "staff-yo" }] };
      if (sql.includes("UPDATE appointments SET status")) return { rows: [{ id: "a1", status: "in_progress" }] };
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.updateAppointmentStatus(TENANT, "a1", "in_progress", "barber", "staff-yo", "user-1");
    expect(result.status).toBe("in_progress");
  });

  it("un barber NO puede actualizar la cita de OTRO barbero (OwnAppointmentsOnlyError)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM appointments")) return { rows: [{ staff_id: "staff-otro" }] };
      return {};
    });
    const service = new AgendaService(pool);

    await expect(
      service.updateAppointmentStatus(TENANT, "a1", "in_progress", "barber", "staff-yo", "user-1")
    ).rejects.toBeInstanceOf(OwnAppointmentsOnlyError);
  });

  it("un owner puede actualizar la cita de CUALQUIER barbero de su tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM appointments")) return { rows: [{ staff_id: "cualquier-staff" }] };
      if (sql.includes("UPDATE appointments SET status")) return { rows: [{ id: "a1", status: "completed" }] };
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.updateAppointmentStatus(TENANT, "a1", "completed", "owner", undefined, "user-1");
    expect(result.status).toBe("completed");
  });

  it("mapea el rechazo del trigger de máquina de estados a InvalidStatusTransitionError", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM appointments")) return { rows: [{ staff_id: "staff-yo" }] };
      if (sql.includes("UPDATE appointments SET status")) {
        const err: any = new Error("Transición de estado inválida: completed -> pending");
        err.code = "P0001";
        throw err;
      }
      return {};
    });
    const service = new AgendaService(pool);

    await expect(
      service.updateAppointmentStatus(TENANT, "a1", "pending", "barber", "staff-yo", "user-1")
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("rechaza con TenantMismatchError si la cita no existe (o es de otro tenant, invisible por RLS)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM appointments")) return { rows: [] };
      return {};
    });
    const service = new AgendaService(pool);

    await expect(
      service.updateAppointmentStatus(TENANT, "a-inexistente", "completed", "owner", undefined, "user-1")
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });
});

describe("AgendaService — createWalkIn", () => {
  const walkInInput = {
    tenantId: TENANT,
    branchId: BRANCH,
    staffId: "staff-1",
    customerPhone: "+5491100000000",
    serviceIds: ["sv1"],
    startsAt: new Date("2026-09-05T15:00:00Z"),
    createdBy: "user-1",
  };

  it("crea el walk-in, encontrando o creando el cliente por teléfono", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: 30 }] };
      if (sql.includes("SELECT id FROM users WHERE phone")) return { rows: [] }; // cliente nuevo
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "new-user" }] };
      if (sql.includes("SELECT id FROM customers WHERE user_id")) return { rows: [] };
      if (sql.includes("INSERT INTO customers")) return { rows: [{ id: "new-customer" }] };
      if (sql.includes("SUM(COALESCE(ss.price_override")) return { rows: [{ total: "2500" }] };
      if (sql.includes("INSERT INTO appointments")) {
        return { rows: [{ id: "appt-1", status: "confirmed", confirmation_code: "AB12CD" }] };
      }
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.createWalkIn(walkInInput);
    expect(result.id).toBe("appt-1");
    expect(result.status).toBe("confirmed"); // walk-in entra directo confirmado, no pending
  });

  it("rechaza si el barbero no ofrece el servicio (duration = null)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: null }] };
      return {};
    });
    const service = new AgendaService(pool);

    await expect(service.createWalkIn(walkInInput)).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("mapea un choque de horario (EXCLUDE) a SlotConflictError", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("resolve_appointment_duration")) return { rows: [{ duration: 30 }] };
      if (sql.includes("SELECT id FROM users WHERE phone")) return { rows: [{ id: "user-1" }] };
      if (sql.includes("SELECT id FROM customers WHERE user_id")) return { rows: [{ id: "cust-1" }] };
      if (sql.includes("SUM(COALESCE(ss.price_override")) return { rows: [{ total: "2500" }] };
      if (sql.includes("INSERT INTO appointments")) {
        const err: any = new Error("conflicting key value violates exclusion constraint");
        err.code = "23P01";
        throw err;
      }
      return {};
    });
    const service = new AgendaService(pool);

    await expect(service.createWalkIn(walkInInput)).rejects.toBeInstanceOf(SlotConflictError);
  });
});

describe("AgendaService — bloqueos de urgencia", () => {
  const blockInput = {
    tenantId: TENANT,
    branchId: BRANCH,
    staffId: "staff-yo",
    startsAt: new Date("2026-09-05T15:00:00Z"),
    endsAt: new Date("2026-09-05T15:30:00Z"),
    createdBy: "user-1",
  };

  it("un barber puede bloquear su propio horario", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("INSERT INTO blocked_slots")) return { rows: [{ id: "block-1" }] };
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.addBlockedSlot(blockInput, "barber", "staff-yo");
    expect(result.id).toBe("block-1");
  });

  it("un barber NO puede bloquear el horario de otro barbero", async () => {
    const { pool } = makeMockPool(async () => ({}));
    const service = new AgendaService(pool);

    await expect(
      service.addBlockedSlot({ ...blockInput, staffId: "staff-otro" }, "barber", "staff-yo")
    ).rejects.toBeInstanceOf(OwnAppointmentsOnlyError);
  });

  it("un owner puede bloquear toda la sucursal (staffId ausente)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("INSERT INTO blocked_slots")) return { rows: [{ id: "block-2" }] };
      return {};
    });
    const service = new AgendaService(pool);

    const result = await service.addBlockedSlot({ ...blockInput, staffId: undefined }, "owner", undefined);
    expect(result.id).toBe("block-2");
  });

  it("removeBlockedSlot rechaza si un barber intenta borrar el bloqueo de otro", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT staff_id FROM blocked_slots")) return { rows: [{ staff_id: "staff-otro" }] };
      return {};
    });
    const service = new AgendaService(pool);

    await expect(service.removeBlockedSlot(TENANT, "block-1", "barber", "staff-yo")).rejects.toBeInstanceOf(
      OwnAppointmentsOnlyError
    );
  });
});
