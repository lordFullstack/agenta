// tests/catalog-management.test.ts
import {
  CatalogManagementService,
  TenantMismatchError,
  NotFoundError,
  InvalidHoursError,
} from "../src/catalog-management.service";

function makeMockPool(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
  const client = { query: jest.fn(queryImpl), release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client), query: jest.fn(queryImpl) } as any, client };
}

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";

describe("CatalogManagementService — lectura para la UI de gestión", () => {
  it("listStaff devuelve solo los barberos del tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("FROM staff_members sm")) {
        return { rows: [{ id: "staff-1", full_name: "Diego", status: "active" }] };
      }
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.listStaff(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe("Diego");
  });

  it("getStaffServices rechaza si el barbero es de otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: OTHER_TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.getStaffServices(TENANT, "staff-ajeno")).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("getStaffServices devuelve los servicios asignados cuando el barbero es propio", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: TENANT }] };
      if (sql.includes("FROM staff_services ss")) return { rows: [{ service_id: "sv1", name: "Corte" }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.getStaffServices(TENANT, "staff-1");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Corte");
  });
});

describe("CatalogManagementService — servicios", () => {
  it("crea un servicio dentro del contexto de tenant correcto", async () => {
    const setConfigCalls: any[] = [];
    const { pool } = makeMockPool(async (sql: string, params?: any[]) => {
      if (sql.includes("set_config")) setConfigCalls.push(params?.[0]);
      if (sql.includes("INSERT INTO services")) {
        return { rows: [{ id: "sv1", name: "Corte", base_price: 2500, base_duration_minutes: 30 }] };
      }
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.createService(TENANT, { name: "Corte", basePrice: 2500, baseDurationMinutes: 30 });

    expect(result.id).toBe("sv1");
    expect(setConfigCalls).toEqual([TENANT]); // confirma que el contexto de tenant se seteó
  });

  it("updateService rechaza silenciosamente (0 filas) si el servicio es de otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE services")) return { rows: [] }; // el WHERE tenant_id = $2 filtró todo
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.updateService(TENANT, "sv-ajeno", { name: "Nuevo nombre" })).rejects.toBeInstanceOf(
      TenantMismatchError
    );
  });

  it("deactivateService hace soft delete (is_active=false, deleted_at) en vez de borrar", async () => {
    let capturedSql = "";
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE services")) {
        capturedSql = sql;
        return { rows: [{ id: "sv1" }] };
      }
      return {};
    });
    const service = new CatalogManagementService(pool);

    await service.deactivateService(TENANT, "sv1");
    expect(capturedSql).toContain("is_active = false");
    expect(capturedSql).toContain("deleted_at = now()");
  });
});

describe("CatalogManagementService — barberos", () => {
  it("inviteStaffMember rechaza si la sucursal pertenece a otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM branches")) return { rows: [{ tenant_id: OTHER_TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(
      service.inviteStaffMember(TENANT, "branch-ajena", { phone: "+549111", fullName: "Diego", tempPasswordHash: "hash" })
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("inviteStaffMember crea usuario y staff_member cuando la sucursal es propia", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM branches")) return { rows: [{ tenant_id: TENANT }] };
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1" }] };
      if (sql.includes("INSERT INTO staff_members")) return { rows: [{ id: "staff-1", status: "active" }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.inviteStaffMember(TENANT, "branch-1", {
      phone: "+549111",
      fullName: "Diego",
      tempPasswordHash: "hash",
    });
    expect(result.id).toBe("staff-1");
  });

  it("updateStaffMember rechaza si el barbero es de otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE staff_members")) return { rows: [] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.updateStaffMember(TENANT, "staff-ajeno", { status: "paused" })).rejects.toBeInstanceOf(
      TenantMismatchError
    );
  });
});

describe("CatalogManagementService — asignación de servicios (cruce de dos tablas)", () => {
  it("rechaza si el BARBERO es de otro tenant, aunque el servicio sea propio", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("staff_tenant")) return { rows: [{ staff_tenant: OTHER_TENANT, service_tenant: TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.assignService(TENANT, "staff-ajeno", "sv-propio", {})).rejects.toBeInstanceOf(
      TenantMismatchError
    );
  });

  it("rechaza si el SERVICIO es de otro tenant, aunque el barbero sea propio", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("staff_tenant")) return { rows: [{ staff_tenant: TENANT, service_tenant: OTHER_TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.assignService(TENANT, "staff-propio", "sv-ajeno", {})).rejects.toBeInstanceOf(
      TenantMismatchError
    );
  });

  it("asigna correctamente cuando ambos (barbero y servicio) son del mismo tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("staff_tenant")) return { rows: [{ staff_tenant: TENANT, service_tenant: TENANT }] };
      if (sql.includes("INSERT INTO staff_services")) {
        return { rows: [{ id: "ss1", staff_id: "staff-1", service_id: "sv1", is_active: true }] };
      }
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.assignService(TENANT, "staff-1", "sv1", { priceOverride: 3000 });
    expect(result.id).toBe("ss1");
  });
});

describe("CatalogManagementService — horario de barbero", () => {
  it("rechaza si el barbero es de otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: OTHER_TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(
      service.setStaffHours(TENANT, "staff-ajeno", [{ dayOfWeek: "mon", startsAt: "09:00", endsAt: "18:00" }])
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("rechaza un horario con fin <= inicio", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(
      service.setStaffHours(TENANT, "staff-1", [{ dayOfWeek: "mon", startsAt: "18:00", endsAt: "09:00" }])
    ).rejects.toBeInstanceOf(InvalidHoursError);
  });

  it("reemplaza el horario completo (borra e inserta) cuando es válido", async () => {
    const queries: string[] = [];
    const { pool } = makeMockPool(async (sql: string) => {
      queries.push(sql.trim().split("\n")[0].trim());
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: TENANT }] };
      if (sql.includes("SELECT day_of_week, starts_at, ends_at FROM staff_hours")) {
        return { rows: [{ day_of_week: "mon", starts_at: "09:00", ends_at: "18:00" }] };
      }
      return {};
    });
    const service = new CatalogManagementService(pool);

    const result = await service.setStaffHours(TENANT, "staff-1", [{ dayOfWeek: "mon", startsAt: "09:00", endsAt: "18:00" }]);
    expect(queries.some((q) => q.startsWith("DELETE FROM staff_hours"))).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe("CatalogManagementService — time_off", () => {
  it("addTimeOff rechaza si el barbero es de otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM staff_members")) return { rows: [{ tenant_id: OTHER_TENANT }] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(
      service.addTimeOff(TENANT, "staff-ajeno", { startsOn: "2026-12-01", endsOn: "2026-12-10" })
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("cancelTimeOff devuelve NotFoundError si no hay ninguna fila afectada", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("DELETE FROM time_off")) return { rows: [] };
      return {};
    });
    const service = new CatalogManagementService(pool);

    await expect(service.cancelTimeOff(TENANT, "time-off-inexistente")).rejects.toBeInstanceOf(NotFoundError);
  });
});
