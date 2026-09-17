// src/logger.ts
import pino from "pino";

// Logs JSON estructurados — Vercel/Railway/cualquier plataforma los captura de stdout
// sin configuración adicional. En desarrollo local, pretty-print legible.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
