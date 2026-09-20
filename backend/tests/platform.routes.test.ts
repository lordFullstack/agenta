// tests/platform.routes.test.ts
// Prueba las rutas de verdad (Express + multer + JWT) contra un servidor HTTP efímero:
// lo importante acá es el control de acceso — solo el administrador puede cambiar los fondos.
import express from "express";
import jwt from "jsonwebtoken";
import { AddressInfo } from "net";
import { Server } from "http";

jest.mock("../src/storage.service", () => ({
  uploadPublicFile: jest.fn(async (folder: string) => `https://cdn.test/${folder}/uuid.jpg`),
}));

import { buildPlatformRoutes } from "../src/platform.routes";
import { PlatformService } from "../src/platform.service";
import { TokenService } from "../src/auth/token.service";
import { uploadPublicFile } from "../src/storage.service";

const SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-in-production";
const tokenFor = (sub: string) => jwt.sign({ sub, role: "owner", tenantId: "t1" }, SECRET, { expiresIn: "5m" });

let server: Server;
let base: string;
let stored: Record<string, string>;

beforeAll(async () => {
  stored = {};
  const pool: any = {
    query: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes("FROM users")) return { rows: [{ phone: params![0] === "admin" ? "+57 300 111 2233" : "+57 399 999 9999" }] };
      if (sql.includes("INSERT INTO platform_branding")) { stored[params![0]] = params![1]; return {}; }
      if (sql.includes("DELETE FROM platform_branding")) { delete stored[params![0]]; return {}; }
      if (sql.includes("FROM platform_branding")) return { rows: Object.entries(stored).map(([slot, image_url]) => ({ slot, image_url })) };
      return {};
    }),
  };
  const app = express();
  app.use(buildPlatformRoutes(new PlatformService(pool, ["573001112233"]), new TokenService(pool)));
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: "internal_error", detail: String(err?.message) }));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const form = () => {
  const f = new FormData();
  f.append("file", new Blob([Buffer.from("fake-jpg")], { type: "image/jpeg" }), "foto.jpg");
  return f;
};
const put = (slot: string, token?: string, body: FormData | undefined = form()) =>
  fetch(`${base}/v1/platform/branding/${slot}`, { method: "PUT", headers: token ? { Authorization: `Bearer ${token}` } : {}, body });

describe("rutas de fondos de la plataforma", () => {
  it("GET /branding es público y devuelve null en lo no cargado", async () => {
    const res = await fetch(`${base}/v1/platform/branding`);
    expect(res.status).toBe(200);
    expect((await res.json()).branding).toEqual({ hero: null, searchBg: null });
  });

  it("subir sin sesión → 401", async () => {
    expect((await put("hero")).status).toBe(401);
  });

  it("un dueño de barbería que NO es admin de la plataforma → 403 y no se sube nada", async () => {
    (uploadPublicFile as jest.Mock).mockClear();
    const res = await put("hero", tokenFor("otro-dueno"));
    expect(res.status).toBe(403);
    expect(uploadPublicFile).not.toHaveBeenCalled();
    expect(stored).toEqual({});
  });

  it("admin-status distingue al admin del resto", async () => {
    const asAdmin = await fetch(`${base}/v1/platform/admin-status`, { headers: { Authorization: `Bearer ${tokenFor("admin")}` } });
    const asOther = await fetch(`${base}/v1/platform/admin-status`, { headers: { Authorization: `Bearer ${tokenFor("otro-dueno")}` } });
    expect((await asAdmin.json()).isPlatformAdmin).toBe(true);
    expect((await asOther.json()).isPlatformAdmin).toBe(false);
  });

  it("slot inexistente → 400", async () => {
    expect((await put("logo", tokenFor("admin"))).status).toBe(400);
  });

  it("admin sin archivo → 400 missing_file", async () => {
    const res = await put("hero", tokenFor("admin"), new FormData());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_file");
  });

  it("el admin sube el fondo y GET lo devuelve a cualquiera", async () => {
    const res = await put("hero", tokenFor("admin"));
    expect(res.status).toBe(200);
    expect(uploadPublicFile).toHaveBeenCalledWith("branding", expect.objectContaining({ mimetype: "image/jpeg" }));
    const pub = await (await fetch(`${base}/v1/platform/branding`)).json();
    expect(pub.branding).toEqual({ hero: "https://cdn.test/branding/uuid.jpg", searchBg: null });
  });

  it("DELETE: solo el admin restaura el fondo por defecto", async () => {
    const denied = await fetch(`${base}/v1/platform/branding/hero`, { method: "DELETE", headers: { Authorization: `Bearer ${tokenFor("otro-dueno")}` } });
    expect(denied.status).toBe(403);
    expect(stored.hero).toBeDefined();
    const ok = await fetch(`${base}/v1/platform/branding/hero`, { method: "DELETE", headers: { Authorization: `Bearer ${tokenFor("admin")}` } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).branding.hero).toBeNull();
  });
});
