// tests/business.test.ts
import { BusinessService, TenantMismatchError, InvalidBusinessHoursError, SlugGenerationError } from "../src/business.service";
import { TokenService } from "../src/auth/token.service";

function makeMockPool(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
  const client = { query: jest.fn(queryImpl), release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client), query: jest.fn(queryImpl) } as any, client };
}

describe("BusinessService — registerBarbershop", () => {
  const input = {
    ownerPhone: "+5491100000000",
    ownerPassword: "una-password-segura",
    ownerFullName: "Mariano Dueño",
    tradeName: "Barbería El Corte",
    legalName: "El Corte SRL",
    timezone: "America/Argentina/Buenos_Aires",
  };

  it("crea usuario + tenant + branch + membership en una sola transacción y devuelve tokens", async () => {
    const calls: string[] = [];
    const { pool } = makeMockPool(async (sql: string) => {
      calls.push(sql.trim().split("\n")[0].trim());
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1" }] };
      if (sql.includes("INSERT INTO tenants")) return { rows: [{ id: "tenant-1" }] };
      if (sql.includes("INSERT INTO branches")) return { rows: [{ id: "branch-1" }] };
      if (sql.includes("INSERT INTO tenant_memberships")) return {};
      return {};
    });

    const tokens = new TokenService(pool);
    jest.spyOn(tokens, "issueTokenPair").mockResolvedValue({ accessToken: "a", refreshToken: "r" });

    const service = new BusinessService(pool, tokens);
    const result = await service.registerBarbershop(input);

    expect(result.tenantId).toBe("tenant-1");
    expect(result.branchId).toBe("branch-1");
    expect(result.accessToken).toBe("a");
    expect(calls.some((c) => c.startsWith("BEGIN"))).toBe(true);
    expect(calls.some((c) => c.startsWith("COMMIT"))).toBe(true);
    expect(tokens.issueTokenPair).toHaveBeenCalledWith({ sub: "user-1", role: "owner", tenantId: "tenant-1" });
  });

  it("reintenta con un slug sufijado si el nombre elegido ya existe (colisión 23505)", async () => {
    let tenantInsertAttempts = 0;
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1" }] };
      if (sql.includes("INSERT INTO tenants")) {
        tenantInsertAttempts++;
        if (tenantInsertAttempts === 1) {
          const err: any = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
        return { rows: [{ id: "tenant-2" }] };
      }
      if (sql.includes("INSERT INTO branches")) return { rows: [{ id: "branch-1" }] };
      return {};
    });

    const tokens = new TokenService(pool);
    jest.spyOn(tokens, "issueTokenPair").mockResolvedValue({ accessToken: "a", refreshToken: "r" });

    const service = new BusinessService(pool, tokens);
    const result = await service.registerBarbershop(input);

    expect(tenantInsertAttempts).toBe(2); // 1 colisión + 1 éxito con slug sufijado
    expect(result.tenantId).toBe("tenant-2");
  });

  it("hace ROLLBACK y propaga el error si algo falla a mitad de la transacción", async () => {
    const calls: string[] = [];
    const { pool } = makeMockPool(async (sql: string) => {
      calls.push(sql.trim().split("\n")[0].trim());
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1" }] };
      if (sql.includes("INSERT INTO tenants")) return { rows: [{ id: "tenant-1" }] };
      if (sql.includes("INSERT INTO branches")) throw new Error("fallo inesperado de red");
      return {};
    });

    const tokens = new TokenService(pool);
    const service = new BusinessService(pool, tokens);

    await expect(service.registerBarbershop(input)).rejects.toThrow("fallo inesperado de red");
    expect(calls.some((c) => c.startsWith("ROLLBACK"))).toBe(true);
  });
});

describe("BusinessService — getTenantProfile", () => {
  it("rechaza si el tenantId de la URL no coincide con el del caller", async () => {
    const { pool } = makeMockPool(async () => ({ rows: [] }));
    const service = new BusinessService(pool, new TokenService(pool));

    await expect(service.getTenantProfile("tenant-ajeno", "mi-tenant")).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("devuelve el perfil cuando el tenantId coincide", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT id, trade_name")) return { rows: [{ id: "t1", trade_name: "El Corte" }] };
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    const result = await service.getTenantProfile("t1", "t1");
    expect(result.trade_name).toBe("El Corte");
  });
});

describe("BusinessService — updateTenantProfile (guard de tenant sin RLS)", () => {
  it("rechaza si el tenantId de la URL no coincide con el tenant del token", async () => {
    const { pool } = makeMockPool(async () => ({ rows: [] }));
    const service = new BusinessService(pool, new TokenService(pool));

    await expect(
      service.updateTenantProfile("tenant-ajeno", "tenant-del-caller", { tradeName: "Nuevo nombre" })
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("permite actualizar cuando el tenantId coincide", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE tenants")) return { rows: [{ id: "t1", trade_name: "Nuevo nombre" }] };
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    const result = await service.updateTenantProfile("t1", "t1", { tradeName: "Nuevo nombre" });
    expect(result.trade_name).toBe("Nuevo nombre");
  });
});

describe("BusinessService — setBusinessHours", () => {
  it("rechaza si la sucursal pertenece a otro tenant", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM branches")) return { rows: [{ tenant_id: "otro-tenant" }] };
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    await expect(
      service.setBusinessHours("branch-1", "mi-tenant", [{ dayOfWeek: "mon", opensAt: "09:00", closesAt: "18:00" }])
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it("rechaza un horario donde el cierre es antes (o igual) que la apertura", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("SELECT tenant_id FROM branches")) return { rows: [{ tenant_id: "mi-tenant" }] };
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    await expect(
      service.setBusinessHours("branch-1", "mi-tenant", [{ dayOfWeek: "mon", opensAt: "18:00", closesAt: "09:00" }])
    ).rejects.toBeInstanceOf(InvalidBusinessHoursError);
  });

  it("reemplaza el horario completo (borra e inserta) cuando todo es válido", async () => {
    const executedQueries: string[] = [];
    const { pool } = makeMockPool(async (sql: string) => {
      executedQueries.push(sql.trim().split("\n")[0].trim());
      if (sql.includes("SELECT tenant_id FROM branches")) return { rows: [{ tenant_id: "mi-tenant" }] };
      if (sql.includes("SELECT day_of_week, opens_at, closes_at FROM business_hours")) {
        return { rows: [{ day_of_week: "mon", opens_at: "09:00", closes_at: "18:00" }] };
      }
      return {};
    });

    const service = new BusinessService(pool, new TokenService(pool));
    const result = await service.setBusinessHours("branch-1", "mi-tenant", [
      { dayOfWeek: "mon", opensAt: "09:00", closesAt: "18:00" },
    ]);

    expect(executedQueries.some((q) => q.startsWith("DELETE FROM business_hours"))).toBe(true);
    expect(executedQueries.some((q) => q.startsWith("INSERT INTO business_hours"))).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe("BusinessService — setBranchActive", () => {
  it("pausa la sucursal cuando pertenece al tenant del caller", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE branches")) return { rows: [{ id: "branch-1", is_active: false }] };
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    const result = await service.setBranchActive("branch-1", "mi-tenant", false);
    expect(result.is_active).toBe(false);
  });

  it("rechaza si el UPDATE no afecta ninguna fila (sucursal de otro tenant)", async () => {
    const { pool } = makeMockPool(async (sql: string) => {
      if (sql.includes("UPDATE branches")) return { rows: [] }; // el WHERE tenant_id = $3 filtró todo
      return {};
    });
    const service = new BusinessService(pool, new TokenService(pool));

    await expect(service.setBranchActive("branch-1", "tenant-ajeno", false)).rejects.toBeInstanceOf(TenantMismatchError);
  });
});
