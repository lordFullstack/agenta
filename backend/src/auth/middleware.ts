// src/auth/middleware.ts
import { Request, Response, NextFunction } from "express";
import { TokenService, AccessTokenPayload } from "./token.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Verifica el header `Authorization: Bearer <token>` y adjunta `req.user`.
 * No hace nada más — no decide si el usuario PUEDE hacer la acción, eso es `requireRole`.
 */
export function authenticate(tokens: TokenService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_token", message: "Falta el header Authorization." });
    }
    const token = header.slice("Bearer ".length);
    try {
      req.user = tokens.verifyAccessToken(token);
      next();
    } catch {
      return res.status(401).json({ error: "invalid_token", message: "Token inválido o expirado." });
    }
  };
}

/**
 * RBAC — rechaza si `req.user.role` no está en la lista permitida.
 * Requiere que `authenticate` haya corrido antes en la cadena de middlewares.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "not_authenticated", message: "No autenticado." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden", message: "No tenés permiso para esta acción." });
    }
    next();
  };
}

/**
 * Para rutas de cliente: exige que el usuario autenticado tenga un `customerId`
 * (es decir, que haya pasado por el flujo de OTP). Distinto de `requireRole('customer')`
 * porque un `super_admin` navegando como cliente igual necesitaría un `customerId` real
 * para reservar — este middleware es sobre "tiene identidad de cliente", no sobre rol.
 */
export function requireCustomerIdentity(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.customerId) {
    return res.status(403).json({ error: "no_customer_profile", message: "Esta acción requiere un perfil de cliente." });
  }
  next();
}
