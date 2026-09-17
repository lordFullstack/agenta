// src/rate-limit.middleware.ts
import { Request, Response, NextFunction } from "express";

/**
 * Rate limiter de ventana deslizante, en memoria. Limitación conocida y documentada:
 * no es distribuido — si el backend corre en más de una instancia, cada instancia lleva
 * su propio conteo, así que el límite real efectivo es (max × instancias). Suficiente
 * para el volumen actual del proyecto; si se escala horizontalmente, hay que migrar a un
 * store compartido (Redis) — ver KNOWN_ISSUES.md y DECISIONS_LOG.md DEC-023.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > 60 * 60 * 1000) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

export function rateLimit(options: { windowMs: number; max: number; keyFn?: (req: Request) => string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = options.keyFn ? options.keyFn(req) : req.ip ?? "unknown";
    const key = `${req.method}:${req.path}:${identity}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > options.windowMs) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + options.windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "rate_limited",
        message: "Demasiados intentos. Esperá un momento y probá de nuevo.",
        retryAfterSeconds,
      });
    }

    next();
  };
}

/** Solo para tests — evita que el estado de un test contamine al siguiente. */
export function __resetRateLimitBuckets() {
  buckets.clear();
}

// ── Presets usados en las rutas ──

export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: (req) => `${req.ip}:${req.body?.phone ?? "unknown"}`,
});

export const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

export const mutationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
