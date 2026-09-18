// src/business.routes.ts
import { Router, Request, Response } from "express";
import { BusinessService, TenantMismatchError, InvalidBusinessHoursError, SlugGenerationError } from "./business.service";
import { TokenService } from "./auth/token.service";
import { authenticate, requireRole } from "./auth/middleware";
import { loginLimiter } from "./rate-limit.middleware";
import { validateUuidParams } from "./validate-params.middleware";
import { uploadImage } from "./upload.middleware";
import { uploadPublicFile } from "./storage.service";

export function buildBusinessRoutes(business: BusinessService, tokens: TokenService): Router {
  const router = Router();
  const requireAuth = authenticate(tokens);
  const requireOwnerOrAdmin = requireRole("owner", "branch_admin");

  // ── Onboarding — público, es el punto de entrada para una barbería nueva ──
  router.post("/v1/business/register", loginLimiter, async (req: Request, res: Response) => {
    const { owner_phone, owner_password, owner_full_name, trade_name, legal_name, timezone } = req.body;
    if (!owner_phone || !owner_password || !trade_name || !legal_name) {
      return res.status(400).json({ error: "missing_params" });
    }
    try {
      const result = await business.registerBarbershop({
        ownerPhone: owner_phone,
        ownerPassword: owner_password,
        ownerFullName: owner_full_name ?? "Dueño/a",
        tradeName: trade_name,
        legalName: legal_name,
        timezone: timezone ?? "America/Argentina/Buenos_Aires",
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof SlugGenerationError) return res.status(422).json({ error: "slug_generation_failed", message: err.message });
      if ((err as any).code === "23505") {
        return res.status(409).json({ error: "phone_already_registered", message: "Ese teléfono ya tiene una cuenta." });
      }
      throw err;
    }
  });

  // ── Sucursal principal del caller — permite loguear sin conocer el branchId de antemano ──
  router.get("/v1/admin/my-branch", requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    if (!req.user!.tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const branch = await business.getPrimaryBranch(req.user!.tenantId);
      res.status(200).json({ branch });
    } catch (err) {
      if (err instanceof TenantMismatchError) return res.status(404).json({ error: "not_found", message: err.message });
      throw err;
    }
  });

  // ── Perfil del negocio — requiere ser owner/branch_admin DE ESE tenant, no de cualquiera ──
  router.get("/v1/tenants/:tenantId", requireAuth, requireOwnerOrAdmin, validateUuidParams("tenantId"), async (req: Request, res: Response) => {
    if (req.user!.tenantId !== req.params.tenantId) {
      return res.status(403).json({ error: "forbidden", message: "No podés ver una barbería que no es la tuya." });
    }
    try {
      const tenant = await business.getTenantProfile(req.params.tenantId, req.user!.tenantId!);
      res.status(200).json({ tenant });
    } catch (err) {
      if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
      throw err;
    }
  });

  router.put("/v1/tenants/:tenantId", requireAuth, requireOwnerOrAdmin, validateUuidParams("tenantId"), async (req: Request, res: Response) => {
    // Este chequeo es la primera capa (evita el roundtrip inútil); `updateTenantProfile`
    // repite la verificación adentro porque `tenants` no tiene RLS — ver el comentario
    // en business.service.ts sobre por qué acá no alcanza con una sola capa.
    if (req.user!.tenantId !== req.params.tenantId) {
      return res.status(403).json({ error: "forbidden", message: "No podés editar una barbería que no es la tuya." });
    }
    try {
      const tenant = await business.updateTenantProfile(req.params.tenantId, req.user!.tenantId!, {
        tradeName: req.body.trade_name,
        description: req.body.description,
        timezone: req.body.timezone,
      });
      res.status(200).json({ tenant });
    } catch (err) {
      if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
      throw err;
    }
  });

  // ── Logo y portada — multipart/form-data, campo "file" ──
  router.put(
    "/v1/tenants/:tenantId/logo",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("tenantId"),
    uploadImage,
    async (req: Request, res: Response) => {
      if (req.user!.tenantId !== req.params.tenantId) {
        return res.status(403).json({ error: "forbidden", message: "No podés editar una barbería que no es la tuya." });
      }
      if (!req.file) return res.status(400).json({ error: "missing_file" });
      try {
        const url = await uploadPublicFile("logos", req.file);
        const tenant = await business.setTenantLogo(req.params.tenantId, req.user!.tenantId!, url);
        res.status(200).json({ tenant });
      } catch (err) {
        if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
        throw err;
      }
    }
  );

  router.put(
    "/v1/tenants/:tenantId/cover",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("tenantId"),
    uploadImage,
    async (req: Request, res: Response) => {
      if (req.user!.tenantId !== req.params.tenantId) {
        return res.status(403).json({ error: "forbidden", message: "No podés editar una barbería que no es la tuya." });
      }
      if (!req.file) return res.status(400).json({ error: "missing_file" });
      try {
        const url = await uploadPublicFile("covers", req.file);
        const tenant = await business.setTenantCover(req.params.tenantId, req.user!.tenantId!, url);
        res.status(200).json({ tenant });
      } catch (err) {
        if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
        throw err;
      }
    }
  );

  // ── Horario general de la sucursal — lectura pública, escritura protegida ──
  router.get("/v1/branches/:branchId/business-hours", validateUuidParams("branchId"), async (req: Request, res: Response) => {
    const hours = await business.getBusinessHours(req.params.branchId);
    res.status(200).json({ businessHours: hours });
  });

  router.put(
    "/v1/branches/:branchId/business-hours",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("branchId"),
    async (req: Request, res: Response) => {
      if (!req.user!.tenantId) {
        return res.status(403).json({ error: "forbidden", message: "Tu usuario no está asociado a ninguna barbería." });
      }
      try {
        const hours = await business.setBusinessHours(req.params.branchId, req.user!.tenantId, req.body.hours ?? []);
        res.status(200).json({ businessHours: hours });
      } catch (err) {
        if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
        if (err instanceof InvalidBusinessHoursError) return res.status(422).json({ error: "invalid_business_hours", message: err.message });
        throw err;
      }
    }
  );

  // ── Pausar/reactivar la sucursal ──
  router.put("/v1/branches/:branchId/active", requireAuth, requireOwnerOrAdmin, validateUuidParams("branchId"), async (req: Request, res: Response) => {
    if (!req.user!.tenantId) {
      return res.status(403).json({ error: "forbidden", message: "Tu usuario no está asociado a ninguna barbería." });
    }
    try {
      const branch = await business.setBranchActive(req.params.branchId, req.user!.tenantId, Boolean(req.body.is_active));
      res.status(200).json({ branch });
    } catch (err) {
      if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
      throw err;
    }
  });

  return router;
}
