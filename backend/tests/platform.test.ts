// tests/platform.test.ts
import { PlatformService, isBrandingSlot, normalizePhone, parseAdminPhones } from "../src/platform.service";

function makePool(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
  return { query: jest.fn(queryImpl) } as any;
}

describe("PlatformService — administrador de la plataforma", () => {
  it("normaliza teléfonos con espacios, guiones y +", () => {
    expect(normalizePhone("+57 300 111-2233")).toBe("573001112233");
    expect(parseAdminPhones("+57 300 111 2233, +57 310 000 0000 ,")).toEqual(["573001112233", "573100000000"]);
    expect(parseAdminPhones(undefined)).toEqual([]);
  });

  it("sin PLATFORM_ADMIN_PHONES nadie es admin y ni siquiera consulta la base", async () => {
    const pool = makePool(async () => ({ rows: [{ phone: "+573001112233" }] }));
    const service = new PlatformService(pool, []);
    expect(await service.isPlatformAdmin("user-1")).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("es admin solo si el teléfono del usuario está en la lista, sin importar el formato", async () => {
    const pool = makePool(async (_sql, params) => ({ rows: [{ phone: params![0] === "user-admin" ? "+57 300 111 2233" : "+57 399 999 9999" }] }));
    const service = new PlatformService(pool, ["573001112233"]);
    expect(await service.isPlatformAdmin("user-admin")).toBe(true);
    expect(await service.isPlatformAdmin("user-otro")).toBe(false);
  });

  it("un usuario sin teléfono (solo email) o inexistente no es admin", async () => {
    const service = new PlatformService(makePool(async () => ({ rows: [{ phone: null }] })), ["573001112233"]);
    expect(await service.isPlatformAdmin("u")).toBe(false);
    const service2 = new PlatformService(makePool(async () => ({ rows: [] })), ["573001112233"]);
    expect(await service2.isPlatformAdmin("u")).toBe(false);
  });
});

describe("PlatformService — fondos", () => {
  it("solo acepta los slots hero y search_bg", () => {
    expect(isBrandingSlot("hero")).toBe(true);
    expect(isBrandingSlot("search_bg")).toBe(true);
    expect(isBrandingSlot("logo")).toBe(false);
    expect(isBrandingSlot("")).toBe(false);
  });

  it("getBranding devuelve null en los fondos sin cargar", async () => {
    const service = new PlatformService(makePool(async () => ({ rows: [{ slot: "hero", image_url: "https://x/hero.jpg" }] })), []);
    expect(await service.getBranding()).toEqual({ hero: "https://x/hero.jpg", searchBg: null });
  });

  it("setBranding hace upsert por slot y devuelve el estado actualizado", async () => {
    const calls: Array<{ sql: string; params?: any[] }> = [];
    const pool = makePool(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT slot")) return { rows: [{ slot: "search_bg", image_url: "https://x/s.jpg" }] };
      return {};
    });
    const result = await new PlatformService(pool, []).setBranding("search_bg", "https://x/s.jpg", "user-1");
    expect(calls[0].sql).toContain("ON CONFLICT (slot) DO UPDATE");
    expect(calls[0].params).toEqual(["search_bg", "https://x/s.jpg", "user-1"]);
    expect(result).toEqual({ hero: null, searchBg: "https://x/s.jpg" });
  });

  it("clearBranding borra el slot para volver a la imagen por defecto", async () => {
    const pool = makePool(async (sql) => (sql.includes("SELECT slot") ? { rows: [] } : {}));
    const result = await new PlatformService(pool, []).clearBranding("hero");
    expect(pool.query.mock.calls[0][0]).toContain("DELETE FROM platform_branding");
    expect(result).toEqual({ hero: null, searchBg: null });
  });
});
