// src/auth/auth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { AuthService, InvalidCredentialsError } from "./auth.service";
import { OtpExpiredOrInvalidError, OtpAttemptsExceededError } from "./otp.service";
import { InvalidRefreshTokenError, TokenService } from "./token.service";
import { authenticate } from "./middleware";
import { otpRequestLimiter, loginLimiter } from "../rate-limit.middleware";

export function buildAuthRoutes(auth: AuthService, tokens: TokenService): Router {
  const router = Router();

  router.post("/v1/auth/otp/request", otpRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { phone, email } = req.body;
    if (!phone || !email) return res.status(400).json({ error: "missing_params" });
    try {
      await auth.requestCustomerOtp(phone, email);
      // Respuesta idéntica exista o no el teléfono, para no filtrar qué números están registrados.
      res.status(200).json({ message: "Si los datos son válidos, vas a recibir un código por email." });
    } catch (err) {
      // Express 4 no reenvía rechazos de promesas al error handler solo; sin este catch,
      // una falla de Resend deja la request colgada hasta el timeout de 300s de Vercel
      // en vez de responder rápido (visto en prod: el botón "Enviar código" no hacía nada).
      next(err);
    }
  });

  router.post("/v1/auth/otp/verify", loginLimiter, async (req: Request, res: Response) => {
    const { phone, code, full_name } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "missing_params" });
    try {
      const tokenPair = await auth.verifyCustomerOtpAndLogin(phone, code, full_name);
      res.status(200).json(tokenPair);
    } catch (err) {
      if (err instanceof OtpAttemptsExceededError) return res.status(429).json({ error: "too_many_attempts", message: err.message });
      if (err instanceof OtpExpiredOrInvalidError) return res.status(401).json({ error: "invalid_otp", message: err.message });
      if ((err as any).code === "23505") {
        return res.status(409).json({ error: "email_already_registered", message: "Ese email ya está en uso por otra cuenta." });
      }
      throw err;
    }
  });

  router.post("/v1/auth/login", loginLimiter, async (req: Request, res: Response) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: "missing_params" });
    try {
      const tokenPair = await auth.loginWithPassword(identifier, password);
      res.status(200).json(tokenPair);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) return res.status(401).json({ error: "invalid_credentials", message: err.message });
      throw err;
    }
  });

  router.post("/v1/auth/refresh", async (req: Request, res: Response) => {
    const { refresh_token, expired_access_token } = req.body;
    if (!refresh_token || !expired_access_token) {
      return res.status(400).json({ error: "missing_params", message: "Se requieren refresh_token y expired_access_token." });
    }
    try {
      // Verifica que el access token expirado sea legítimo (firma válida) antes de confiar
      // en su payload — así el `role`/`tenantId`/`customerId` del token nuevo no se
      // re-derivan de cero en cada refresh, pero tampoco se aceptan de un token falsificado.
      const decoded = tokens.decodeExpiredAccessToken(expired_access_token);
      // jwt.sign rechaza payloads que ya traen `exp`/`iat` junto con `expiresIn` —
      // se reconstruye el payload limpio a partir de los campos de dominio únicamente.
      const cleanPayload = { sub: decoded.sub, role: decoded.role, customerId: decoded.customerId, tenantId: decoded.tenantId };
      const tokenPair = await auth.refresh(refresh_token, cleanPayload);
      res.status(200).json(tokenPair);
    } catch (err) {
      if (err instanceof InvalidRefreshTokenError) return res.status(401).json({ error: "invalid_refresh_token", message: err.message });
      return res.status(401).json({ error: "invalid_refresh_token", message: "Sesión inválida." });
    }
  });

  router.post("/v1/auth/logout", authenticate(tokens), async (req: Request, res: Response) => {
    await auth.logout(req.user!.sub);
    res.status(200).json({ message: "Sesión cerrada." });
  });

  return router;
}
