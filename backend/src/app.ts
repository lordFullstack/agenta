// src/app.ts
//
// Construye la app Express y el pool de conexiones, sin llamar a `listen()` — así el
// mismo código sirve tanto para el servidor local de larga duración (`src/index.ts`)
// como para el handler serverless de Vercel (`api/index.ts`).
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { Pool } from "pg";

import { AvailabilityService } from "./availability.service";
import { CatalogService } from "./catalog.service";
import { BookingService } from "./booking.service";
import { BusinessService } from "./business.service";
import { CatalogManagementService } from "./catalog-management.service";
import { AgendaService } from "./agenda.service";

import { OtpService } from "./auth/otp.service";
import { TokenService } from "./auth/token.service";
import { AuthService } from "./auth/auth.service";

import { buildRoutes } from "./availability.routes";
import { buildAuthRoutes } from "./auth/auth.routes";
import { buildBusinessRoutes } from "./business.routes";
import { buildCatalogManagementRoutes } from "./catalog-management.routes";
import { buildAgendaRoutes } from "./agenda.routes";
import { logger } from "./logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copiá .env.example a .env y completalo antes de arrancar.");
}

// Supabase (y la mayoría de los Postgres gestionados) exigen SSL; el Postgres local de
// docker-compose no lo soporta. Se detecta automáticamente por el host, con override manual
// vía PGSSL para casos que no encajen en esa heurística.
const useSSL = process.env.PGSSL === "true" || (process.env.PGSSL !== "false" && DATABASE_URL.includes("supabase.co"));

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

// Configuración compartida del motor de disponibilidad — ver validation.ts
export const bookingConfig = {
  minLeadMinutes: Number(process.env.MIN_LEAD_MINUTES ?? 30),
  maxWindowDays: Number(process.env.MAX_WINDOW_DAYS ?? 60),
  timezone: process.env.DEFAULT_TIMEZONE ?? "America/Argentina/Buenos_Aires",
};

// ── Instanciar servicios ──
const availability = new AvailabilityService(pool);
const catalog = new CatalogService(pool);
const booking = new BookingService(pool, availability, bookingConfig);
const business = new BusinessService(pool, new TokenService(pool)); // ver nota abajo
const catalogManagement = new CatalogManagementService(pool);
const agenda = new AgendaService(pool);

const tokens = new TokenService(pool);
const otp = new OtpService(pool);
const auth = new AuthService(pool, otp, tokens);

// Orígenes permitidos para CORS — separados por coma en FRONTEND_URL
// (ej: "https://mi-app.vercel.app,https://miapp.com"). Default a Vite local en dev.
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// ── Armar la app ──
export const app = express();
// crossOriginResourcePolicy en "same-origin" (el default de Helmet) bloquea a nivel de
// navegador cualquier fetch cross-origin a esta API, incluso con CORS bien configurado —
// el frontend vive en otro dominio de Vercel, así que esta API necesita ser consumible
// cross-origin por diseño.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
app.use(express.json());

app.use(buildAuthRoutes(auth, tokens));
app.use(buildRoutes(availability, booking, catalog, bookingConfig, tokens));
app.use(buildBusinessRoutes(business, tokens));
app.use(buildCatalogManagementRoutes(catalogManagement, tokens));
app.use(buildAgendaRoutes(agenda, tokens));

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Manejo de errores no capturados por las rutas — evita que Express devuelva HTML
// de stack trace en producción; ver SECURITY_RULES.md sobre no filtrar detalles internos.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  (req as any).log?.error({ err }, "unhandled_error");
  res.status(500).json({ error: "internal_error", message: "Ocurrió un error inesperado." });
});

// Vercel autodetecta este archivo como un framework "Express" de zero-config y lo invoca
// directamente para la ruta raíz ("/"), en paralelo a api/index.ts + vercel.json — necesita
// su propio default export además del named export que ya usa api/index.ts.
export default app;
