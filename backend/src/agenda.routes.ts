// src/agenda.routes.ts
import { Router, Request, Response } from "express";
import {
  AgendaService,
  TenantMismatchError,
  OwnAppointmentsOnlyError,
  InvalidStatusTransitionError,
  SlotConflictError,
  InvalidPaymentError,
  CallerRole,
} from "./agenda.service";
import { TokenService } from "./auth/token.service";
import { authenticate, requireRole } from "./auth/middleware";
import { validateUuidParams } from "./validate-params.middleware";

export function buildAgendaRoutes(agenda: AgendaService, tokens: TokenService): Router {
  const router = Router();
  const requireAuth = authenticate(tokens);
  const requireStaffRole = requireRole("owner", "branch_admin", "barber");

  function handleDomainError(err: unknown, res: Response) {
    if (err instanceof OwnAppointmentsOnlyError) return res.status(403).json({ error: "own_appointments_only", message: err.message });
    if (err instanceof TenantMismatchError) return res.status(403).json({ error: "forbidden", message: err.message });
    if (err instanceof InvalidStatusTransitionError) return res.status(422).json({ error: "invalid_status_transition", message: err.message });
    if (err instanceof SlotConflictError) return res.status(409).json({ error: "slot_conflict", message: err.message });
    if (err instanceof InvalidPaymentError) return res.status(422).json({ error: "invalid_payment", message: err.message });
    throw err;
  }

  router.get("/v1/admin/agenda", requireAuth, requireStaffRole, async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return res.status(403).json({ error: "forbidden" });

    const appointments = await agenda.getAgenda({
      tenantId,
      branchId: req.query.branch_id as string,
      date: req.query.date as string,
      callerRole: req.user!.role as CallerRole,
      callerStaffId: req.user!.staffId,
      requestedStaffId: req.query.staff_id as string | undefined,
    });
    res.status(200).json({ appointments });
  });

  router.put(
    "/v1/admin/appointments/:id/status",
    requireAuth,
    requireStaffRole,
    validateUuidParams("id"),
    async (req: Request, res: Response) => {
      const tenantId = req.user!.tenantId;
      if (!tenantId) return res.status(403).json({ error: "forbidden" });
      try {
        const result = await agenda.updateAppointmentStatus(
          tenantId,
          req.params.id,
          req.body.status,
          req.user!.role as CallerRole,
          req.user!.staffId,
          req.user!.sub
        );
        res.status(200).json({ appointment: result });
      } catch (err) {
        handleDomainError(err, res);
      }
    }
  );

  router.post(
    "/v1/admin/appointments/:id/payment",
    requireAuth,
    requireStaffRole,
    validateUuidParams("id"),
    async (req: Request, res: Response) => {
      const tenantId = req.user!.tenantId;
      if (!tenantId) return res.status(403).json({ error: "forbidden" });

      const { amount, method, paid_at } = req.body;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return res.status(422).json({ error: "invalid_payment", message: "El monto tiene que ser un número válido." });
      }

      try {
        const payment = await agenda.recordPayment(
          {
            tenantId,
            appointmentId: req.params.id,
            amount,
            method,
            paidAt: paid_at ? new Date(paid_at) : undefined,
          },
          req.user!.role as CallerRole,
          req.user!.staffId
        );
        res.status(201).json({ payment });
      } catch (err) {
        handleDomainError(err, res);
      }
    }
  );

  router.post("/v1/admin/walk-ins", requireAuth, requireStaffRole, async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    // Un barbero solo puede cargarse walk-ins a sí mismo — mismo criterio que el resto de la agenda.
    const staffId = req.body.staff_id;
    if (req.user!.role === "barber" && staffId !== req.user!.staffId) {
      return res.status(403).json({ error: "own_appointments_only", message: "Solo podés cargar walk-ins en tu propia agenda." });
    }
    try {
      const appointment = await agenda.createWalkIn({
        tenantId,
        branchId: req.body.branch_id,
        staffId,
        customerPhone: req.body.customer_phone,
        customerFullName: req.body.customer_full_name,
        serviceIds: req.body.service_ids,
        startsAt: new Date(req.body.starts_at),
        createdBy: req.user!.sub,
      });
      res.status(201).json({ appointment });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  router.post("/v1/admin/blocked-slots", requireAuth, requireStaffRole, async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      const blocked = await agenda.addBlockedSlot(
        {
          tenantId,
          branchId: req.body.branch_id,
          staffId: req.body.staff_id,
          startsAt: new Date(req.body.starts_at),
          endsAt: new Date(req.body.ends_at),
          reason: req.body.reason,
          note: req.body.note,
          createdBy: req.user!.sub,
        },
        req.user!.role as CallerRole,
        req.user!.staffId
      );
      res.status(201).json({ blockedSlot: blocked });
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  router.delete("/v1/admin/blocked-slots/:id", requireAuth, requireStaffRole, validateUuidParams("id"), async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return res.status(403).json({ error: "forbidden" });
    try {
      await agenda.removeBlockedSlot(tenantId, req.params.id, req.user!.role as CallerRole, req.user!.staffId);
      res.status(204).send();
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  return router;
}
