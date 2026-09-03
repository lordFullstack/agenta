// tests/auth.test.ts
import jwt from "jsonwebtoken";
import { TokenService } from "../src/auth/token.service";
import { authenticate, requireRole, requireCustomerIdentity } from "../src/auth/middleware";

function makeMockPool(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
  return { query: jest.fn(queryImpl) } as any;
}

describe("TokenService", () => {
  const pool = makeMockPool(async () => ({ rows: [] }));
  const tokens = new TokenService(pool);

  it("firma y verifica un access token válido", () => {
    const token = tokens.signAccessToken({ sub: "u1", role: "customer", customerId: "c1" });
    const decoded = tokens.verifyAccessToken(token);
    expect(decoded.sub).toBe("u1");
    expect(decoded.customerId).toBe("c1");
  });

  it("rechaza un token con firma inválida", () => {
    const foreignToken = jwt.sign({ sub: "u1", role: "customer" }, "otra-clave-distinta");
    expect(() => tokens.verifyAccessToken(foreignToken)).toThrow();
  });

  it("verifyAccessToken rechaza un token expirado, pero decodeExpiredAccessToken sí lo acepta", () => {
    const expired = jwt.sign({ sub: "u1", role: "customer" }, process.env.JWT_SECRET ?? "dev-only-secret-change-in-production", {
      expiresIn: -10, // ya expirado
    });
    expect(() => tokens.verifyAccessToken(expired)).toThrow();
    expect(tokens.decodeExpiredAccessToken(expired).sub).toBe("u1");
  });

  it("issueTokenPair persiste el refresh token hasheado, no en claro", async () => {
    let insertedHash: string | undefined;
    const trackingPool = makeMockPool(async (sql: string, params?: any[]) => {
      if (sql.includes("INSERT INTO refresh_tokens")) insertedHash = params?.[1];
      return { rows: [] };
    });
    const svc = new TokenService(trackingPool);
    const pair = await svc.issueTokenPair({ sub: "u1", role: "customer" });

    expect(insertedHash).toBeDefined();
    expect(insertedHash).not.toBe(pair.refreshToken); // nunca se guarda el token en claro
    expect(insertedHash!.length).toBe(64); // sha256 hex
  });

  it("rotateTokenPair rechaza un refresh token no encontrado/revocado", async () => {
    const emptyPool = makeMockPool(async () => ({ rows: [] }));
    const svc = new TokenService(emptyPool);
    await expect(svc.rotateTokenPair("token-inexistente", { sub: "u1", role: "customer" })).rejects.toThrow(
      "sesión expiró"
    );
  });
});

describe("Middleware — authenticate", () => {
  const pool = makeMockPool(async () => ({ rows: [] }));
  const tokens = new TokenService(pool);
  const middleware = authenticate(tokens);

  function mockReqRes(authHeader?: string) {
    const req: any = { header: (name: string) => (name === "Authorization" ? authHeader : undefined) };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    return { req, res, next };
  }

  it("rechaza con 401 si falta el header Authorization", () => {
    const { req, res, next } = mockReqRes(undefined);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza con 401 si el token es inválido", () => {
    const { req, res, next } = mockReqRes("Bearer token-basura");
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("adjunta req.user y llama next() con un token válido", () => {
    const token = tokens.signAccessToken({ sub: "u1", role: "customer", customerId: "c1" });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe("u1");
  });
});

describe("Middleware — requireRole (RBAC)", () => {
  function mockReqRes(user?: any) {
    const req: any = { user };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    return { req, res, next };
  }

  it("rechaza con 401 si no hay usuario autenticado", () => {
    const { req, res, next } = mockReqRes(undefined);
    requireRole("owner")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rechaza con 403 si el rol no está permitido", () => {
    const { req, res, next } = mockReqRes({ sub: "u1", role: "customer" });
    requireRole("owner", "branch_admin")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("permite pasar si el rol está en la lista permitida", () => {
    const { req, res, next } = mockReqRes({ sub: "u1", role: "owner" });
    requireRole("owner", "branch_admin")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("Middleware — requireCustomerIdentity", () => {
  function mockReqRes(user?: any) {
    const req: any = { user };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    return { req, res, next };
  }

  it("rechaza con 403 si el usuario autenticado no tiene customerId (ej. un owner puro)", () => {
    const { req, res, next } = mockReqRes({ sub: "u1", role: "owner" });
    requireCustomerIdentity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("permite pasar si el usuario tiene customerId", () => {
    const { req, res, next } = mockReqRes({ sub: "u1", role: "customer", customerId: "c1" });
    requireCustomerIdentity(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
