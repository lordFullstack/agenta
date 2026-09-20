// tests/business.routes.profile.test.ts
// PUT /v1/tenants/:id por HTTP de verdad: dirección y redes se normalizan, lo inválido da 422
// con un mensaje que el panel puede mostrar tal cual, y otro tenant no puede editar.
import express from "express";
import jwt from "jsonwebtoken";
import { AddressInfo } from "net";
import { Server } from "http";

jest.mock("../src/storage.service", () => ({ uploadPublicFile: jest.fn() }));

import { buildBusinessRoutes } from "../src/business.routes";
import { BusinessService } from "../src/business.service";
import { TokenService } from "../src/auth/token.service";

const SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-in-production";
const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const tokenFor = (tenantId: string) => jwt.sign({ sub: "u1", role: "owner", tenantId }, SECRET, { expiresIn: "5m" });

let server: Server;
let base: string;
let writes: Array<{ sql: string; params?: any[] }>;

beforeAll(async () => {
  const run = async (sql: string, params?: any[]) => {
    writes.push({ sql: sql.trim().split("\n")[0].trim(), params });
    if (sql.includes("UPDATE tenants")) return { rows: [{ id: TENANT, trade_name: "El Socio", instagram_url: params![5] }] };
    return {};
  };
  const client = { query: jest.fn(run), release: jest.fn() };
  const pool: any = { connect: jest.fn().mockResolvedValue(client), query: jest.fn(run) };
  const tokens = new TokenService(pool);
  const app = express();
  app.use(express.json());
  app.use(buildBusinessRoutes(new BusinessService(pool, tokens), tokens));
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: "internal_error", detail: String(err?.message) }));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => { writes = []; });
afterAll(() => new Promise((resolve) => server.close(resolve)));

const put = (tenantId: string, body: unknown, token = tokenFor(TENANT)) =>
  fetch(`${base}/v1/tenants/${tenantId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

describe("PUT /v1/tenants/:id — dirección y redes", () => {
  it("normaliza Instagram y guarda la dirección", async () => {
    const res = await put(TENANT, { address: "Cra 8 #12-45, Montelíbano", instagram: "@elsocio" });
    expect(res.status).toBe(200);
    const { tenant } = await res.json();
    expect(tenant.address).toBe("Cra 8 #12-45, Montelíbano");
    expect(tenant.instagram_url).toBe("https://www.instagram.com/elsocio");
    expect(writes.some((w) => w.sql.startsWith("UPDATE branches"))).toBe(true);
  });

  it("enlace que no es de Instagram → 422 con mensaje legible y no escribe nada", async () => {
    const res = await put(TENANT, { instagram: "https://evil.com/elsocio" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("invalid_profile");
    expect(body.message).toMatch(/Instagram/);
    expect(writes).toEqual([]);
  });

  it("dirección demasiado larga → 422", async () => {
    const res = await put(TENANT, { address: "x".repeat(300) });
    expect(res.status).toBe(422);
  });

  it("editar la barbería de otro → 403 y no escribe", async () => {
    const res = await put(OTHER, { address: "Calle 1" });
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("sin sesión → 401", async () => {
    const res = await fetch(`${base}/v1/tenants/${TENANT}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
  });
});
