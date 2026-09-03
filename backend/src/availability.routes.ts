// src/availability.routes.ts
import { Router, Request, Response } from "express";
import { AvailabilityService } from "./availability.service";
import {
  BookingService,
  SlotNoLongerAvailableError,
  ValidationConflict,
  InvalidStatusTransitionError,
  CancellationWindowError,
} from "./booking.service";
import { CatalogService } from "./catalog.service";
import { ValidationError, BookingWindowConfig } from "./validation";
import { TokenService } from "./auth/token.service";
import { authenticate, requireCustomerIdentity } from "./auth/middleware";

export function buildRoutes(
  availability: AvailabilityService,
  booking: BookingService,
  catalog: CatalogService,
  config: BookingWindowConfig,
  tokens: TokenService
): Router {
  const router = Router();
  const requireAuth = authenticate(tokens);

  // ── Pasos 1-3: catálogo — público, sin auth (ver DEC-015: RLS de catálogo permite SELECT público) ──
  router.get("/v1/barbershops/:slug", async (req: Request, res: Response) => {
    const shop = await catalog.getBarbershopBySlug(req.params.slug);
    if (!shop) return res.status(404).json({ error: "not_found" });
    res.status(200).json({ barbershop: shop });
  });

  router.get("/v1/barbershops/:tenantId/services", async (req: Request, res: Response) => {
    const services = await catalog.getServices(req.params.tenantId);
    res.status(200).json({ services });
  });

  router.get("/v1/branches/:branchId/staff", async (req: Request, res: Response) => {
    const serviceIds = (req.query.service_ids as string)?.split(",") ?? [];
    if (serviceIds.length === 0) {
      return res.status(400).json({ error: "missing_service_ids" });
    }
    const staff = await catalog.getStaffForServices(req.params.branchId, serviceIds);
    res.status(200).json({ staff });
  });

  // ── Disponibilidad — pública para lectura (mostrar horarios no requiere login) ──
  router.get("/v1/availability", async (req: Request, res: Response) => {
    try {
      const slots = await availability.getAvailableSlots(
        {
          tenantId: req.query.tenant_id as string,
          barberId: req.query.barber_id as string,
          branchId: req.query.branch_id as string,
          serviceId: req.query.service_id as string,
          date: req.query.date as string,
        },
        config
      );
      res.status(200).json({ slots, timezone: config.timezone });
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // ── Crear cita — requiere sesión de cliente (OTP verificado). customer_id/created_by
  //    se derivan de req.user, NUNCA del body — es el fix central de este loop (ISSUE-002). ──
  router.post("/v1/appointments", requireAuth, requireCustomerIdentity, async (req: Request, res: Response) => {
    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey) {
      return res.status(400).json({ error: "missing_idempotency_key", message: "El header Idempotency-Key es obligatorio." });
    }

    try {
      const appointment = await booking.createAppointment({
        tenantId: req.body.tenant_id,
        branchId: req.body.branch_id,
        barberId: req.body.barber_id,
        customerId: req.user!.customerId!,
        serviceIds: req.body.service_ids,
        startsAt: new Date(req.body.starts_at),
        createdBy: req.user!.sub,
        customerNote: req.body.customer_note,
        idempotencyKey,
      });
      res.status(201).json({ appointment });
    } catch (err) {
      if (err instanceof SlotNoLongerAvailableError) {
        return res.status(409).json({ error: "slot_no_longer_available", alternatives: err.alternatives });
      }
      if (err instanceof ValidationConflict) {
        return res.status(422).json({ error: err.code, message: err.message });
      }
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // ── Cancelación — requiere sesión. cancelled_by se deriva del token. ──
  router.post("/v1/appointments/:id/cancel", requireAuth, async (req: Request, res: Response) => {
    if (!req.body.tenant_id) {
      return res.status(400).json({ error: "missing_tenant_id" });
    }
    try {
      const result = await booking.cancelAppointment({
        tenantId: req.body.tenant_id,
        appointmentId: req.params.id,
        cancelledBy: req.user!.sub,
        reason: req.body.reason,
        minCancellationLeadMinutes: req.body.min_cancellation_lead_minutes,
      });
      res.status(200).json({ appointment: result });
    } catch (err) {
      if (err instanceof CancellationWindowError) {
        return res.status(422).json({ error: "cancellation_window_expired", message: err.message, minutesRequired: err.minutesRequired });
      }
      if (err instanceof InvalidStatusTransitionError) {
        return res.status(422).json({ error: "invalid_status_transition", message: err.message });
      }
      if (err instanceof ValidationConflict) {
        const status = err.code === "not_found" ? 404 : 422;
        return res.status(status).json({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // ── Reprogramación — requiere sesión. rescheduled_by se deriva del token. ──
  router.post("/v1/appointments/:id/reschedule", requireAuth, async (req: Request, res: Response) => {
    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey) {
      return res.status(400).json({ error: "missing_idempotency_key", message: "El header Idempotency-Key es obligatorio." });
    }
    if (!req.body.tenant_id) {
      return res.status(400).json({ error: "missing_tenant_id" });
    }

    try {
      const result = await booking.rescheduleAppointment({
        tenantId: req.body.tenant_id,
        appointmentId: req.params.id,
        newStartsAt: new Date(req.body.new_starts_at),
        rescheduledBy: req.user!.sub,
        reason: req.body.reason,
        idempotencyKey,
      });
      res.status(200).json({ appointment: result });
    } catch (err) {
      if (err instanceof SlotNoLongerAvailableError) {
        return res.status(409).json({ error: "slot_no_longer_available", alternatives: err.alternatives });
      }
      if (err instanceof InvalidStatusTransitionError) {
        return res.status(422).json({ error: "invalid_status_transition", message: err.message });
      }
      if (err instanceof ValidationConflict) {
        const status = err.code === "not_found" ? 404 : 422;
        return res.status(status).json({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  return router;
}
