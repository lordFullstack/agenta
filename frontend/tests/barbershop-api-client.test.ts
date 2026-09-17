// frontend/tests/barbershop-api-client.test.ts
import { BarbershopApiClient, ApiError, NotAuthenticatedError } from "../src/barbershop/api/barbershop-api-client";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function fakeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

async function loggedInClient(payload: object) {
  global.fetch = jest.fn(() =>
    Promise.resolve(jsonResponse(200, { accessToken: fakeJwt(payload), refreshToken: "r1" }))
  ) as any;
  const client = new BarbershopApiClient("http://test");
  await client.login("owner@test.com", "pw");
  return client;
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("BarbershopApiClient — login y sesión", () => {
  it("login guarda tokens y getSession decodifica el payload", async () => {
    const client = await loggedInClient({ sub: "u1", role: "owner", tenantId: "t1" });
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getSession()).toEqual({ role: "owner", tenantId: "t1", staffId: undefined });
  });

  it("login con credenciales inválidas propaga ApiError sin autenticar", async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse(401, { error: "invalid_credentials", message: "Credenciales inválidas" }))) as any;
    const client = new BarbershopApiClient("http://test");
    await expect(client.login("x", "y")).rejects.toBeInstanceOf(ApiError);
    expect(client.isAuthenticated()).toBe(false);
  });

  it("registerBarbershop autentica automáticamente tras el registro", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse(201, { accessToken: fakeJwt({ sub: "u1", role: "owner" }), refreshToken: "r1", tenantId: "t1", branchId: "b1" }))
    ) as any;
    const client = new BarbershopApiClient("http://test");
    const result = await client.registerBarbershop({
      ownerPhone: "+549111",
      ownerPassword: "pw",
      tradeName: "El Corte",
      legalName: "El Corte SRL",
    });
    expect(result.tenantId).toBe("t1");
    expect(client.isAuthenticated()).toBe(true);
  });
});

describe("BarbershopApiClient — llamadas autenticadas", () => {
  it("getAgenda sin sesión lanza NotAuthenticatedError sin llamar a fetch", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;
    const client = new BarbershopApiClient("http://test");
    await expect(client.getAgenda("branch-1", "2026-09-05")).rejects.toBeInstanceOf(NotAuthenticatedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("adjunta Authorization y arma la query string correctamente en getAgenda", async () => {
    const client = await loggedInClient({ sub: "u1", role: "owner", tenantId: "t1" });
    let capturedUrl = "";
    let capturedAuth: string | undefined;
    global.fetch = jest.fn((url: string, options: any) => {
      capturedUrl = url;
      capturedAuth = options.headers.Authorization;
      return Promise.resolve(jsonResponse(200, { appointments: [] }));
    }) as any;

    await client.getAgenda("branch-1", "2026-09-05", "staff-1");

    expect(capturedAuth).toMatch(/^Bearer /);
    expect(capturedUrl).toContain("branch_id=branch-1");
    expect(capturedUrl).toContain("date=2026-09-05");
    expect(capturedUrl).toContain("staff_id=staff-1");
  });

  it("updateAppointmentStatus refresca el token ante un 401 y reintenta una vez", async () => {
    const client = await loggedInClient({ sub: "u1", role: "owner", tenantId: "t1" });
    let call = 0;
    global.fetch = jest.fn((url: string) => {
      call++;
      if (url.includes("/v1/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, { accessToken: fakeJwt({ sub: "u1", role: "owner", tenantId: "t1" }), refreshToken: "r2" }));
      }
      if (call === 1) return Promise.resolve(jsonResponse(401, { error: "invalid_token" }));
      return Promise.resolve(jsonResponse(200, { appointment: { id: "a1", status: "confirmed" } }));
    }) as any;

    const result = await client.updateAppointmentStatus("a1", "confirmed");
    expect(result.appointment.status).toBe("confirmed");
  });

  it("createWalkIn manda el body con los campos esperados", async () => {
    const client = await loggedInClient({ sub: "u1", role: "barber", tenantId: "t1", staffId: "s1" });
    let capturedBody: any;
    global.fetch = jest.fn((_url: string, options: any) => {
      capturedBody = JSON.parse(options.body);
      return Promise.resolve(jsonResponse(201, { appointment: { id: "a1" } }));
    }) as any;

    await client.createWalkIn({
      branch_id: "b1",
      staff_id: "s1",
      customer_phone: "+549111",
      service_ids: ["sv1"],
      starts_at: "2026-09-05T15:00:00",
    });

    expect(capturedBody).toEqual({
      branch_id: "b1",
      staff_id: "s1",
      customer_phone: "+549111",
      customer_full_name: undefined,
      service_ids: ["sv1"],
      starts_at: "2026-09-05T15:00:00",
    });
  });

  it("logout es best-effort: si el request de red falla, igual limpia la sesión local", async () => {
    const client = await loggedInClient({ sub: "u1", role: "owner", tenantId: "t1" });
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch"))) as any;

    const promise = client.logout();
    await jest.advanceTimersByTimeAsync(10_000);
    await promise;

    expect(client.isAuthenticated()).toBe(false);
  });
});
