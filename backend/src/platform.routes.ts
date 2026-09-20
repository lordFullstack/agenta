// src/platform.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { PlatformService, isBrandingSlot } from "./platform.service";
import { TokenService } from "./auth/token.service";
import { authenticate } from "./auth/middleware";
import { uploadImage } from "./upload.middleware";
import { uploadPublicFile } from "./storage.service";

export function buildPlatformRoutes(platform: PlatformService, tokens: TokenService): Router {
  const router = Router();
  const requireAuth = authenticate(tokens);

  const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!(await platform.isPlatformAdmin(req.user!.sub))) {
      return res.status(403).json({ error: "forbidden", message: "Solo el administrador de la plataforma puede hacer esto." });
    }
    next();
  };

  const validateSlot = (req: Request, res: Response, next: NextFunction) => {
    if (!isBrandingSlot(req.params.slot)) {
      return res.status(400).json({ error: "invalid_slot", message: "Ese fondo no existe." });
    }
    next();
  };

  // Público: lo usan las pantallas de inicio y búsqueda de cualquier cliente.
  router.get("/v1/platform/branding", async (_req: Request, res: Response) => {
    const branding = await platform.getBranding();
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ branding });
  });

  // Le dice al panel si debe mostrar la sección "Fondos de Agenta".
  router.get("/v1/platform/admin-status", requireAuth, async (req: Request, res: Response) => {
    res.status(200).json({ isPlatformAdmin: await platform.isPlatformAdmin(req.user!.sub) });
  });

  // multipart/form-data, campo "file" — mismo formato y límites que logo/portada.
  router.put(
    "/v1/platform/branding/:slot",
    requireAuth,
    requirePlatformAdmin,
    validateSlot,
    uploadImage,
    async (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ error: "missing_file" });
      const url = await uploadPublicFile("branding", req.file);
      const branding = await platform.setBranding(req.params.slot as any, url, req.user!.sub);
      res.status(200).json({ branding });
    }
  );

  router.delete("/v1/platform/branding/:slot", requireAuth, requirePlatformAdmin, validateSlot, async (req: Request, res: Response) => {
    const branding = await platform.clearBranding(req.params.slot as any);
    res.status(200).json({ branding });
  });

  return router;
}
