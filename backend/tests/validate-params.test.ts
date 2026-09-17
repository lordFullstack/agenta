// tests/validate-params.test.ts
import { validateUuidParams } from "../src/validate-params.middleware";

function mockReqRes(params: Record<string, string>) {
  const req: any = { params };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
}

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("validateUuidParams", () => {
  it("permite pasar si todos los parámetros son UUIDs válidos", () => {
    const middleware = validateUuidParams("staffId", "serviceId");
    const { req, res, next } = mockReqRes({ staffId: VALID_UUID, serviceId: VALID_UUID });

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si un parámetro no es un UUID válido", () => {
    const middleware = validateUuidParams("staffId");
    const { req, res, next } = mockReqRes({ staffId: "no-es-un-uuid" });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si el parámetro está ausente", () => {
    const middleware = validateUuidParams("staffId");
    const { req, res, next } = mockReqRes({});

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("con múltiples parámetros, rechaza si CUALQUIERA de ellos es inválido", () => {
    const middleware = validateUuidParams("staffId", "serviceId");
    const { req, res, next } = mockReqRes({ staffId: VALID_UUID, serviceId: "invalido" });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza intentos de SQL injection disfrazados de ID en la URL", () => {
    const middleware = validateUuidParams("id");
    const { req, res, next } = mockReqRes({ id: "1' OR '1'='1" });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
