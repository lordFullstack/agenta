// frontend/tests/booking-api-client.test.ts
import { BookingApiClient, ApiError, NetworkError, TimeoutError, NotAuthenticatedError } from "../src/api/booking-api-client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fetchThatNeverResolvesUnlessAborted() {
  return jest.fn((_url: string, options: any) => {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  });
}

/** Autentica un cliente nuevo simulando un verifyOtp exitoso, sin depender de localStorage. */
async function authenticatedClient(accessToken = "access-1", refreshToken = "refresh-1"): Promise<BookingApiClient> {
  global.fetch = jest.fn(() =>
    Promise.resolve(jsonResponse(200, { accessToken, refreshToken }))
  ) as any;
  const client = new BookingApiClient("http://test");
  await client.verifyOtp("+5491100000000", "123456");
  return client;
}

const appointmentPayload = {
  tenantId: "t",
  branchId: "b",
  barberId: "s",
  serviceIds: ["sv"],
  startsAt: "2026-09-01T14:00:00Z",
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("BookingApiClient — timeout", () => {
  it("lanza TimeoutError (via retry agotado) si el fetch no responde antes del límite", async () => {
    global.fetch = fetchThatNeverResolvesUnlessAborted() as any;
    const client = new BookingApiClient("http://test");
    const promise = client.getAvailability({ tenantId: "t", barberId: "a", branchId: "b", serviceId: "c", date: "2026-09-01" });
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await jest.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});

describe("BookingApiClient — network failure y retry", () => {
  it("reintenta ante un TypeError de red y eventualmente tiene éxito", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount < 3) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve(jsonResponse(200, { slots: [], timezone: "America/Argentina/Buenos_Aires" }));
    }) as any;

    const client = new BookingApiClient("http://test");
    const promise = client.getAvailability({ tenantId: "t", barberId: "a", branchId: "b", serviceId: "c", date: "2026-09-01" });
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(callCount).toBe(3);
    expect(result.slots).toEqual([]);
  });

  it("agota los reintentos y propaga NetworkError si la red nunca se recupera", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch"))) as any;
    const client = new BookingApiClient("http://test");
    const promise = client.getAvailability({ tenantId: "t", barberId: "a", branchId: "b", serviceId: "c", date: "2026-09-01" });
    const assertion = expect(promise).rejects.toBeInstanceOf(NetworkError);
    await jest.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(4);
  });

  it("NUNCA reintenta automáticamente un 409 (slot_no_longer_available)", async () => {
    let callCount = 0;
    const client = await authenticatedClient();
    global.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve(
        jsonResponse(409, { error: "slot_no_longer_available", message: "Ya no está disponible", alternatives: [] })
      );
    }) as any;

    await expect(client.createAppointment(appointmentPayload, "idem-key-1")).rejects.toBeInstanceOf(ApiError);
    expect(callCount).toBe(1);
  });

  it("NUNCA reintenta automáticamente un 422 (conflicto de validación de negocio)", async () => {
    let callCount = 0;
    const client = await authenticatedClient();
    global.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve(jsonResponse(422, { error: "service_not_offered", message: "No disponible" }));
    }) as any;

    await expect(client.createAppointment(appointmentPayload, "idem-key-2")).rejects.toBeInstanceOf(ApiError);
    expect(callCount).toBe(1);
  });
});

describe("BookingApiClient — idempotencia en la creación de citas", () => {
  it("envía el mismo Idempotency-Key en cada reintento por falla de red", async () => {
    const receivedKeys: (string | null)[] = [];
    let callCount = 0;
    const client = await authenticatedClient();

    global.fetch = jest.fn((_url: string, options: any) => {
      callCount++;
      receivedKeys.push(options.headers["Idempotency-Key"]);
      if (callCount < 2) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve(
        jsonResponse(201, { appointment: { id: "appt-1", confirmation_code: "AB12CD", starts_at: "2026-09-01T14:00:00Z" } })
      );
    }) as any;

    const promise = client.createAppointment(appointmentPayload, "same-key-across-retries");
    await jest.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(receivedKeys).toEqual(["same-key-across-retries", "same-key-across-retries"]);
  });
});

describe("BookingApiClient — auth: OTP y tokens (Loop 06/11)", () => {
  it("requestOtp llama al endpoint correcto sin requerir sesión previa", async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse(200, { message: "ok" }))) as any;
    const client = new BookingApiClient("http://test");
    await client.requestOtp("+5491100000000", "cliente@example.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test/v1/auth/otp/request",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("verifyOtp guarda los tokens devueltos y marca al cliente como autenticado", async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse(200, { accessToken: "a1", refreshToken: "r1" }))) as any;
    const client = new BookingApiClient("http://test");
    expect(client.isAuthenticated()).toBe(false);
    await client.verifyOtp("+5491100000000", "123456");
    expect(client.isAuthenticated()).toBe(true);
  });

  it("createAppointment sin sesión lanza NotAuthenticatedError SIN llamar a fetch", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;
    const client = new BookingApiClient("http://test");

    await expect(client.createAppointment(appointmentPayload, "idem-1")).rejects.toBeInstanceOf(NotAuthenticatedError);
    expect(fetchSpy).not.toHaveBeenCalled(); // evita el roundtrip inútil si ya sabemos que no hay sesión
  });

  it("adjunta el header Authorization con el access token en requests autenticadas", async () => {
    const client = await authenticatedClient("token-xyz");
    let capturedAuthHeader: string | undefined;

    global.fetch = jest.fn((_url: string, options: any) => {
      capturedAuthHeader = options.headers.Authorization;
      return Promise.resolve(
        jsonResponse(201, { appointment: { id: "a1", confirmation_code: "X", starts_at: "2026-09-01T14:00:00Z" } })
      );
    }) as any;

    await client.createAppointment(appointmentPayload, "idem-2");
    expect(capturedAuthHeader).toBe("Bearer token-xyz");
  });

  it("ante un 401, intenta refresh UNA vez y reintenta la request original con el token nuevo", async () => {
    const client = await authenticatedClient("token-viejo", "refresh-1");
    const authHeadersSeen: (string | undefined)[] = [];
    let call = 0;

    global.fetch = jest.fn((url: string, options: any) => {
      call++;
      if (url.includes("/v1/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, { accessToken: "token-nuevo", refreshToken: "refresh-2" }));
      }
      authHeadersSeen.push(options.headers.Authorization);
      if (call === 1) return Promise.resolve(jsonResponse(401, { error: "invalid_token" }));
      return Promise.resolve(
        jsonResponse(201, { appointment: { id: "a1", confirmation_code: "X", starts_at: "2026-09-01T14:00:00Z" } })
      );
    }) as any;

    await client.createAppointment(appointmentPayload, "idem-3");

    expect(authHeadersSeen[0]).toBe("Bearer token-viejo"); // intento original
    expect(authHeadersSeen[1]).toBe("Bearer token-nuevo"); // reintento post-refresh
  });

  it("si el refresh también falla, propaga NotAuthenticatedError y limpia los tokens", async () => {
    const client = await authenticatedClient("token-viejo", "refresh-1");

    global.fetch = jest.fn((url: string) => {
      if (url.includes("/v1/auth/refresh")) {
        return Promise.resolve(jsonResponse(401, { error: "invalid_refresh_token" }));
      }
      return Promise.resolve(jsonResponse(401, { error: "invalid_token" }));
    }) as any;

    await expect(client.createAppointment(appointmentPayload, "idem-4")).rejects.toBeInstanceOf(NotAuthenticatedError);
    expect(client.isAuthenticated()).toBe(false);
  });

  it("cancelAppointment y rescheduleAppointment también requieren sesión y adjuntan el token", async () => {
    const client = await authenticatedClient("token-abc");
    let capturedAuthHeader: string | undefined;

    global.fetch = jest.fn((_url: string, options: any) => {
      capturedAuthHeader = options.headers.Authorization;
      return Promise.resolve(jsonResponse(200, { appointment: { id: "a1", status: "cancelled" } }));
    }) as any;

    await client.cancelAppointment("a1", "tenant-1", "no puedo asistir");
    expect(capturedAuthHeader).toBe("Bearer token-abc");
  });
});

describe("BookingApiClient — horario público", () => {
  it("getBusinessHours pide el horario de la sucursal sin necesitar sesión", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse(200, { businessHours: [{ day_of_week: "mon", opens_at: "09:00:00", closes_at: "20:00:00" }] }))
    ) as any;
    const client = new BookingApiClient("http://test");

    const { businessHours } = await client.getBusinessHours("b1");

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("http://test/v1/branches/b1/business-hours");
    expect(businessHours).toHaveLength(1);
  });
});
