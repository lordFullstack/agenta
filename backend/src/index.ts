// src/index.ts
//
// Entrypoint para correr el servidor de larga duración (desarrollo local, Docker, VPS,
// Railway/Render). El deploy serverless en Vercel usa `api/index.ts`, que reexporta la
// misma app de `./app` sin llamar a `listen()`.
import { app, pool } from "./app";
import { logger } from "./logger";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} recibido, cerrando servidor...`);
  server.close(async () => {
    await pool.end();
    logger.info("Conexiones cerradas. Adiós.");
    process.exit(0);
  });
  // Si algo cuelga el cierre ordenado, no dejar el proceso zombie para siempre.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
