// src/index.ts
import express from "express";
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

const PORT = process.env.PORT ?? 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error("Falta DATABASE_URL. Copiá .env.example a .env y completalo antes de arrancar.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Configuración compartida del motor de disponibilidad — ver validation.ts
const bookingConfig = {
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

// ── Armar la app ──
const app = express();
app.use(express.json());

app.use(buildAuthRoutes(auth, tokens));
app.use(buildRoutes(availability, booking, catalog, bookingConfig, tokens));
app.use(buildBusinessRoutes(business, tokens));
app.use(buildCatalogManagementRoutes(catalogManagement, tokens));
app.use(buildAgendaRoutes(agenda, tokens));

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Manejo de errores no capturados por las rutas — evita que Express devuelva HTML
// de stack trace en producción; ver SECURITY_RULES.md sobre no filtrar detalles internos.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Ocurrió un error inesperado." });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
