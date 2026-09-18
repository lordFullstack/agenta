// src/catalog-management.routes.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import {
  CatalogManagementService,
  TenantMismatchError,
  NotFoundError,
  InvalidHoursError,
} from "./catalog-management.service";
import { TokenService } from "./auth/token.service";
import { authenticate, requireRole } from "./auth/middleware";
import { validateUuidParams } from "./validate-params.middleware";
import { uploadImage } from "./upload.middleware";
import { uploadPublicFile } from "./storage.service";

export function buildCatalogManagementRoutes(mgmt: CatalogManagementService, tokens: TokenService): Router {
  const router = Router();
  const requireAuth = authenticate(tokens);
  const requireOwnerOrAdmin = requireRole("owner", "branch_admin");

  function tenantIdOf(req: Request): string | null {
    return req.user?.tenantId ?? null;
  }

  function handleDomainError(err: unknown, res: Response) {
    if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: "not_found", message: err.message });
    if (err instanceof InvalidHoursError) return res.status(422).json({ error: "invalid_hours", message: err.message });
    throw err;
  }

  // ── Lectura para la UI de gestión ──
  router.get("/v1/admin/staff", requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    const staff = await mgmt.listStaff(tenantId);
    res.status(200).json({ staff });
  });

  router.get("/v1/admin/staff/:staffId/services", requireAuth, requireOwnerOrAdmin, validateUuidParams("staffId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const services = await mgmt.getStaffServices(tenantId, req.params.staffId);
      res.status(200).json({ services });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // ── Servicios ──
  router.post("/v1/admin/services", requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    const service = await mgmt.createService(tenantId, {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      basePrice: req.body.base_price,
      baseDurationMinutes: req.body.base_duration_minutes,
    });
    res.status(201).json({ service });
  });

  router.put("/v1/admin/services/:serviceId", requireAuth, requireOwnerOrAdmin, validateUuidParams("serviceId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const service = await mgmt.updateService(tenantId, req.params.serviceId, {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        basePrice: req.body.base_price,
        baseDurationMinutes: req.body.base_duration_minutes,
      });
      res.status(200).json({ service });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  router.delete("/v1/admin/services/:serviceId", requireAuth, requireOwnerOrAdmin, validateUuidParams("serviceId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      await mgmt.deactivateService(tenantId, req.params.serviceId);
      res.status(204).send();
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // ── Barberos ──
  router.post("/v1/admin/staff", requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    if (!req.body.phone || !req.body.full_name || !req.body.temp_password) {
      return res.status(400).json({ error: "missing_params" });
    }
    try {
      const tempPasswordHash = await bcrypt.hash(req.body.temp_password, 12);
      const staff = await mgmt.inviteStaffMember(tenantId, req.body.branch_id, {
        phone: req.body.phone,
        fullName: req.body.full_name,
        tempPasswordHash,
      });
      res.status(201).json({ staff });
    } catch (err) {
      if ((err as any).code === "23505") {
        return res.status(409).json({ error: "phone_already_registered", message: "Ese teléfono ya tiene una cuenta." });
      }
      handleDomainError(err, res);
    }
  });

  router.put("/v1/admin/staff/:staffId", requireAuth, requireOwnerOrAdmin, validateUuidParams("staffId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const staff = await mgmt.updateStaffMember(tenantId, req.params.staffId, {
        bio: req.body.bio,
        status: req.body.status,
        bufferBeforeMinutes: req.body.buffer_before_minutes,
        bufferAfterMinutes: req.body.buffer_after_minutes,
        acceptsWalkIns: req.body.accepts_walk_ins,
      });
      res.status(200).json({ staff });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  router.put(
    "/v1/admin/staff/:staffId/photo",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("staffId"),
    uploadImage,
    async (req: Request, res: Response) => {
      const tenantId = tenantIdOf(req);
      if (!tenantId) return res.status(403).json({ error: "forbidden" });
      if (!req.file) return res.status(400).json({ error: "missing_file" });
      try {
        const url = await uploadPublicFile("staff", req.file);
        const user = await mgmt.setStaffPhoto(tenantId, req.params.staffId, url);
        res.status(200).json({ user });
      } catch (err) {
        handleDomainError(err, res);
      }
    }
  );

  // ── Asignación de servicios ──
  router.put(
    "/v1/admin/staff/:staffId/services/:serviceId",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("staffId", "serviceId"),
    async (req: Request, res: Response) => {
      const tenantId = tenantIdOf(req);
      if (!tenantId) return res.status(403).json({ error: "forbidden" });
      try {
        const assignment = await mgmt.assignService(tenantId, req.params.staffId, req.params.serviceId, {
          priceOverride: req.body.price_override,
          durationOverrideMinutes: req.body.duration_override_minutes,
        });
        res.status(200).json({ assignment });
      } catch (err) {
        handleDomainError(err, res);
      }
    }
  );

  router.delete(
    "/v1/admin/staff/:staffId/services/:serviceId",
    requireAuth,
    requireOwnerOrAdmin,
    validateUuidParams("staffId", "serviceId"),
    async (req: Request, res: Response) => {
      const tenantId = tenantIdOf(req);
      if (!tenantId) return res.status(403).json({ error: "forbidden" });
      try {
        await mgmt.removeServiceFromStaff(tenantId, req.params.staffId, req.params.serviceId);
        res.status(204).send();
      } catch (err) {
        handleDomainError(err, res);
      }
    }
  );

  // ── Horario del barbero ──
  router.put("/v1/admin/staff/:staffId/hours", requireAuth, requireOwnerOrAdmin, validateUuidParams("staffId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const hours = await mgmt.setStaffHours(tenantId, req.params.staffId, req.body.hours ?? []);
      res.status(200).json({ staffHours: hours });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // ── Vacaciones / licencias ──
  router.post("/v1/admin/staff/:staffId/time-off", requireAuth, requireOwnerOrAdmin, validateUuidParams("staffId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const timeOff = await mgmt.addTimeOff(tenantId, req.params.staffId, {
        startsOn: req.body.starts_on,
        endsOn: req.body.ends_on,
        reason: req.body.reason,
        note: req.body.note,
      });
      res.status(201).json({ timeOff });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  router.delete("/v1/admin/time-off/:timeOffId", requireAuth, requireOwnerOrAdmin, validateUuidParams("timeOffId"), async (req: Request, res: Response) => {
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      await mgmt.cancelTimeOff(tenantId, req.params.timeOffId);
      res.status(204).send();
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  return router;
}
