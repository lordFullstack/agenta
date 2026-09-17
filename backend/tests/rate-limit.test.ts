// tests/rate-limit.test.ts
import { rateLimit, __resetRateLimitBuckets } from "../src/rate-limit.middleware";

function mockReqRes(overrides: Partial<{ ip: string; path: string; method: string; body: any }> = {}) {
  const req: any = { ip: overrides.ip ?? "1.1.1.1", path: overrides.path ?? "/v1/test", method: overrides.method ?? "POST", body: overrides.body ?? {} };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  __resetRateLimitBuckets();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("rateLimit — comportamiento básico", () => {
  it("permite requests por debajo del límite", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) {
      const { req, res, next } = mockReqRes();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it("rechaza con 429 al superar el límite dentro de la misma ventana", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2 });
    const call = () => {
      const { req, res, next } = mockReqRes();
      middleware(req, res, next);
      return { res, next };
    };

    call();
    call();
    const third = call();

    expect(third.res.status).toHaveBeenCalledWith(429);
    expect(third.next).not.toHaveBeenCalled();
  });

  it("incluye el header Retry-After en la respuesta 429", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const call = () => {
      const { req, res, next } = mockReqRes();
      middleware(req, res, next);
      return res;
    };

    call();
    const res = call();

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("resetea el contador una vez que pasa la ventana de tiempo", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const call = () => {
      const { req, res, next } = mockReqRes();
      middleware(req, res, next);
      return { res, next };
    };

    call();
    const blocked = call();
    expect(blocked.res.status).toHaveBeenCalledWith(429);

    jest.advanceTimersByTime(61_000);

    const afterWindow = call();
    expect(afterWindow.next).toHaveBeenCalled();
  });

  it("aísla el conteo por IP — una IP bloqueada no afecta a otra distinta", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });

    const first = mockReqRes({ ip: "1.1.1.1" });
    middleware(first.req, first.res, first.next);
    const firstBlocked = mockReqRes({ ip: "1.1.1.1" });
    middleware(firstBlocked.req, firstBlocked.res, firstBlocked.next);
    expect(firstBlocked.res.status).toHaveBeenCalledWith(429);

    const secondIp = mockReqRes({ ip: "2.2.2.2" });
    middleware(secondIp.req, secondIp.res, secondIp.next);
    expect(secondIp.next).toHaveBeenCalled();
  });

  it("aísla el conteo por ruta — el límite de un endpoint no consume el de otro", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });

    const a = mockReqRes({ path: "/v1/auth/login" });
    middleware(a.req, a.res, a.next);
    const aBlocked = mockReqRes({ path: "/v1/auth/login" });
    middleware(aBlocked.req, aBlocked.res, aBlocked.next);
    expect(aBlocked.res.status).toHaveBeenCalledWith(429);

    const b = mockReqRes({ path: "/v1/auth/otp/request" });
    middleware(b.req, b.res, b.next);
    expect(b.next).toHaveBeenCalled();
  });

  it("con keyFn personalizado, distintos valores de esa función no se pisan entre sí", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, keyFn: (req) => req.body.phone });

    const phoneA = mockReqRes({ body: { phone: "+549111" } });
    middleware(phoneA.req, phoneA.res, phoneA.next);
    const phoneABlocked = mockReqRes({ body: { phone: "+549111" } });
    middleware(phoneABlocked.req, phoneABlocked.res, phoneABlocked.next);
    expect(phoneABlocked.res.status).toHaveBeenCalledWith(429);

    const phoneB = mockReqRes({ body: { phone: "+549222" } });
    middleware(phoneB.req, phoneB.res, phoneB.next);
    expect(phoneB.next).toHaveBeenCalled();
  });
});
